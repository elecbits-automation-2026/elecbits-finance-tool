import { useState } from "react";
import { Upload, Paperclip, X, Loader2 } from "lucide-react";
import { uploadAttachment, attList, ATTACHMENT_ACCEPT } from "../lib/storage";

// Multi-file attachment picker. Self-managing: uploads each picked file to Storage
// and stores an ARRAY of pointers under form[field]. Backward compatible with a
// single legacy object (attList normalises). When empty it stores null, so a form's
// `if (!form.attachment)` required-check still works.
export function AttachmentInput({
  form, setForm, field = "attachment", required = false,
  label = "Attachment (Invoice / Quote / Receipt)",
  accept = ATTACHMENT_ACCEPT, maxBytes = 2 * 1024 * 1024,
  // handleFileUpload is accepted for backward compat but ignored (self-managing).
  handleFileUpload,
}: any) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const files = attList(form[field]);

  async function onPick(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = ""; // let the same file be re-picked later
    if (!picked.length) return;
    const tooBig = picked.find((f: any) => f.size > maxBytes);
    if (tooBig) { setErr(`"${(tooBig as any).name}" is too large (max ${(maxBytes / 1048576).toFixed(0)}MB each).`); return; }
    setErr(""); setBusy(true);
    try {
      const uploaded = [];
      for (const f of picked) uploaded.push(await uploadAttachment(f));
      setForm((prev) => ({ ...prev, [field]: [...attList(prev[field]), ...uploaded] }));
    } catch (er: any) {
      setErr("Upload failed: " + (er?.message || "please try again"));
    }
    setBusy(false);
  }

  function removeAt(i) {
    setForm((prev) => {
      const next = attList(prev[field]).filter((_, idx) => idx !== i);
      return { ...prev, [field]: next.length ? next : null };
    });
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label} {required && <span className="text-red-500">*</span>}</label>
      {files.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {files.map((f, i) => (
            <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0"><Paperclip className="w-4 h-4 text-emerald-700 shrink-0" /><div className="min-w-0"><div className="font-semibold text-emerald-900 text-sm truncate">{f.name}</div>{f.size != null && <div className="text-xs text-emerald-700">{(f.size / 1024).toFixed(1)} KB</div>}</div></div>
              <button type="button" onClick={() => removeAt(i)} className="text-red-600 hover:bg-red-100 p-1 rounded shrink-0"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
      <label className="flex flex-col items-center justify-center px-4 py-5 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50">
        {busy ? <Loader2 className="w-6 h-6 text-slate-400 mb-2 animate-spin" /> : <Upload className="w-6 h-6 text-slate-400 mb-2" />}
        <span className="text-sm font-medium text-slate-700">{busy ? "Uploading…" : files.length ? "Add more files" : "Click to upload"}</span>
        <span className="text-xs text-slate-500 mt-1">PDF, image, Word, Excel/CSV — up to 2MB each · multiple allowed</span>
        <input type="file" multiple className="hidden" accept={accept} onChange={onPick} />
      </label>
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
}
