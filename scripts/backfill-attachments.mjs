// backfill-attachments.mjs
// One-time migration: move legacy base64 attachments out of the row JSONB and
// into the `attachments` Storage bucket, replacing each { name,size,type,data }
// with a pointer { name,size,type,path }.
//
// Safe by default: DRY RUN (reports what it would do, writes nothing).
// Pass --commit to actually upload files and update rows.
//
// Prereqs:
//   - migration 0030 applied (bucket + policies exist)
//   - .env.local has VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
//
// Run:
//   node scripts/backfill-attachments.mjs           # dry run
//   node scripts/backfill-attachments.mjs --commit  # do it

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const COMMIT = process.argv.includes("--commit");
const BUCKET = "attachments";
const TABLES = ["requests", "pos", "budgets"];

// -- load env from .env.local (no dotenv dependency) -------------------------
function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* fall through to process.env */
  }
  return { ...env, ...process.env };
}
const env = loadEnv();
const URL = env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

// -- helpers -----------------------------------------------------------------
let idCounter = 0;
function randomKey(name) {
  const dot = name?.lastIndexOf?.(".") ?? -1;
  const ext = dot >= 0 ? name.slice(dot) : "";
  idCounter += 1;
  return `backfill-${Date.now().toString(36)}-${idCounter}${ext}`;
}

// An attachment-like node: has a base64 data-URL in `data` and a filename.
function isLegacyAttachment(v) {
  return v && typeof v === "object" && typeof v.data === "string"
    && v.data.startsWith("data:") && typeof v.name === "string" && !v.path;
}

function dataUrlToBuffer(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const meta = dataUrl.slice(5, comma); // after "data:"
  const b64 = dataUrl.slice(comma + 1);
  const contentType = meta.split(";")[0] || "application/octet-stream";
  return { buffer: Buffer.from(b64, "base64"), contentType };
}

// Recursively find legacy attachment nodes anywhere in the object graph.
function collect(node, out) {
  if (Array.isArray(node)) { node.forEach((n) => collect(n, out)); return; }
  if (node && typeof node === "object") {
    if (isLegacyAttachment(node)) { out.push(node); return; }
    for (const k of Object.keys(node)) collect(node[k], out);
  }
}

// -- run ---------------------------------------------------------------------
console.log(COMMIT ? "=== COMMIT MODE — will upload + update ===" : "=== DRY RUN — no writes (use --commit) ===");
let totalFiles = 0, totalRows = 0, totalBytes = 0, failures = 0;

for (const table of TABLES) {
  const { data: rows, error } = await supabase.from(table).select("id, data");
  if (error) { console.error(`[${table}] fetch failed:`, error.message); continue; }
  let tableFiles = 0, tableRows = 0;

  for (const row of rows) {
    const atts = [];
    collect(row.data, atts);
    if (atts.length === 0) continue;

    let rowChanged = false;
    for (const att of atts) {
      const { buffer, contentType } = dataUrlToBuffer(att.data);
      const path = randomKey(att.name);
      totalBytes += buffer.length;
      if (COMMIT) {
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buffer, {
          contentType: att.type || contentType, upsert: false,
        });
        if (upErr) { console.error(`  [${table}/${row.id}] upload failed for ${att.name}:`, upErr.message); failures++; continue; }
        att.path = path;          // mutate in place
        delete att.data;          // drop the base64
        rowChanged = true;
      }
      tableFiles++; totalFiles++;
      console.log(`  [${table}/${row.id}] ${att.name} (${(buffer.length / 1024).toFixed(0)} KB) -> ${path}`);
    }

    if (COMMIT && rowChanged) {
      const { error: updErr } = await supabase.from(table).update({ data: row.data }).eq("id", row.id);
      if (updErr) { console.error(`  [${table}/${row.id}] row update failed:`, updErr.message); failures++; continue; }
      tableRows++; totalRows++;
    } else if (!COMMIT) {
      tableRows++; totalRows++;
    }
  }
  console.log(`[${table}] ${tableFiles} file(s) across ${tableRows} row(s)`);
}

console.log("---");
console.log(`${COMMIT ? "Migrated" : "Would migrate"} ${totalFiles} file(s) in ${totalRows} row(s), ~${(totalBytes / 1048576).toFixed(1)} MB. Failures: ${failures}.`);
if (!COMMIT) console.log("Re-run with --commit to apply.");
