import { supabase } from "./supabase";

// ============================================================================
// Attachment storage. Files live in a PRIVATE Supabase Storage bucket; the DB
// row keeps only a lightweight pointer { name, size, type, path, uploadedAt }.
// A short-lived signed URL is minted on demand for viewing/downloading.
//
// Backward compatible: legacy attachments stored as base64 in the row carry a
// `data` field instead of `path`. getAttachmentUrl() returns that base64 URL
// directly, so old records keep rendering until they are backfilled.
// ============================================================================

const BUCKET = "attachments";
const SIGNED_TTL_SECONDS = 60 * 10; // 10 minutes — long enough to view/download

type AttachmentPointer = {
  name: string;
  size: number;
  type: string;
  path: string;
  uploadedAt: string;
};

function randomId(): string {
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Upload a File to the attachments bucket and return the DB pointer to store.
// Uses the caller's logged-in session, so it is subject to the bucket's RLS.
export async function uploadAttachment(file: File): Promise<AttachmentPointer> {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot) : "";
  // Random object key (unguessable); the human filename is kept in the pointer.
  const path = `${randomId()}${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    path,
    uploadedAt: new Date().toISOString(),
  };
}

// Resolve a usable URL for an attachment pointer OR a legacy base64 attachment.
// Returns null if neither is present or the signed-URL request fails.
export async function getAttachmentUrl(att: any): Promise<string | null> {
  if (!att) return null;
  if (att.path) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(att.path, SIGNED_TTL_SECONDS);
    if (error) return null;
    return data?.signedUrl ?? null;
  }
  if (att.data) return att.data; // legacy base64 data-URL
  return null;
}

// Best-effort delete of a stored object (e.g. when an attachment is replaced or
// its record cancelled). No-op for legacy base64 attachments. Never throws.
export async function removeAttachment(att: any): Promise<void> {
  if (att?.path) {
    try {
      await supabase.storage.from(BUCKET).remove([att.path]);
    } catch {
      /* orphan cleanup is best-effort; ignore */
    }
  }
}
