import { createClient } from "@supabase/supabase-js";

// Vite exposes env vars prefixed with VITE_ to the browser.
// Set these in .env.local (see .env.example).
const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // Show a readable message instead of a blank page. createClient() throws
  // synchronously on an empty url ("supabaseUrl is required."), which would
  // crash the app before React mounts — so we stop here with clear guidance.
  const msg =
    "Missing Supabase config: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set in this build. " +
    "On Vercel, add them in Project Settings → Environment Variables (Production), then redeploy.";
  console.error(msg);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML =
      '<div style="font-family:sans-serif;max-width:640px;margin:80px auto;padding:24px;color:#334155">' +
      "<h2>Configuration error</h2><p>" + msg + "</p></div>";
  }
  throw new Error(msg);
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
