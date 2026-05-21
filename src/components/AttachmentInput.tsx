import { Upload, Paperclip, X } from "lucide-react";

export function AttachmentInput({ form, setForm, handleFileUpload, required = false, label = "Attachment (Invoice / Quote / Receipt)" }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label} {required && <span className="text-red-500">*</span>}</label>
      {!form.attachment ? (
        <label className="flex flex-col items-center justify-center px-4 py-6 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50">
          <Upload className="w-6 h-6 text-slate-400 mb-2" />
          <span className="text-sm font-medium text-slate-700">Click to upload</span>
          <span className="text-xs text-slate-500 mt-1">PDF, PNG, JPG, DOC up to 2MB</span>
          <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={handleFileUpload} />
        </label>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><Paperclip className="w-4 h-4 text-emerald-700" /><div className="text-sm"><div className="font-semibold text-emerald-900">{form.attachment.name}</div><div className="text-xs text-emerald-700">{(form.attachment.size / 1024).toFixed(1)} KB</div></div></div>
          <button onClick={() => setForm({ ...form, attachment: null })} className="text-red-600 hover:bg-red-100 p-1 rounded"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
