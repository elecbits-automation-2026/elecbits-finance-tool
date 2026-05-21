export function FlowPreview({ steps }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <div className="text-xs font-bold text-blue-900 mb-2">📋 Approval Flow Preview</div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={`px-2 py-1 rounded border ${i === 0 ? "bg-white border-blue-300" : i === steps.length - 1 ? "bg-emerald-100 border-emerald-300 font-semibold" : "bg-white border-blue-200"}`}>{step}</span>
            {i < steps.length - 1 && <span className="text-blue-400">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
