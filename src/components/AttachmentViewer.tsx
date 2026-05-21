import { Paperclip, X, FileText } from "lucide-react";
import { isImageFile, isPdfFile } from "../lib/finance";

export function AttachmentViewer({ attachment, onClose }) {
  if (!attachment) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2"><Paperclip className="w-5 h-5 text-slate-600" /><div><div className="font-semibold">{attachment.name}</div><div className="text-xs text-slate-500">{(attachment.size / 1024).toFixed(1)} KB</div></div></div>
          <div className="flex gap-2">{attachment.data && <a href={attachment.data} download={attachment.name} className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg">Download</a>}<button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button></div>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-slate-50">
          {attachment.data ? (isImageFile(attachment.type) ? <img src={attachment.data} alt={attachment.name} className="max-w-full mx-auto rounded" /> : isPdfFile(attachment.type) ? <iframe src={attachment.data} className="w-full h-[70vh] rounded border border-slate-200" title={attachment.name} /> : <div className="text-center py-10"><FileText className="w-16 h-16 text-slate-300 mx-auto mb-3" /><p className="text-slate-600 text-sm mb-3">Preview not available.</p><a href={attachment.data} download={attachment.name} className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm">Download</a></div>) : <div className="text-center py-10"><FileText className="w-16 h-16 text-slate-300 mx-auto mb-3" /><p className="text-slate-600 text-sm">File data not available.</p></div>}
        </div>
      </div>
    </div>
  );
}
