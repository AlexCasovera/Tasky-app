// @ts-nocheck

export default function CompletionModal({
  completionPrompt,
  setCompletionPrompt,
  selectedTask,
  executeCompletion,
  teamMembers
}) {
  if (!completionPrompt) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]" onMouseDown={() => setCompletionPrompt(null)}>
      <div className="bg-white max-w-md w-full rounded-lg shadow-2xl p-6 border border-gray-300 flex flex-col gap-4 animate-fade-in" onMouseDown={(e) => e.stopPropagation()}>
        <div className="border-b pb-2">
          <span className="text-xs font-bold text-[#A9B1A6] uppercase tracking-wider">Complete Task Confirmation</span>
          <h3 className="text-xl font-serif font-bold text-gray-900 mt-0.5">{selectedTask?.title}</h3>
        </div>

        {!completionPrompt.showForm ? (
          <>
            <p className="text-sm text-gray-700 leading-relaxed">
              Is this task fully resolved, or do you need to branch a new sub task to address unexpected issues (e.g., ordering parts, rescheduling vendor)?
            </p>
            
            <div className="flex flex-col gap-2 mt-2">
              <button 
                onClick={() => executeCompletion(false)}
                className="bg-gray-100 text-gray-800 border border-gray-300 py-2.5 px-4 rounded text-sm font-bold hover:bg-gray-200 transition text-center">
                ✓ Mark Fully Complete & Close
              </button>

              <button 
                onClick={() => setCompletionPrompt({ ...completionPrompt, showForm: true })}
                className="bg-[#333333] text-white py-2.5 px-4 rounded text-sm font-bold hover:bg-black transition text-center">
                + Create Sub Task
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <h4 className="font-bold text-sm text-gray-800">Sub Task Details</h4>
            
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Title</label>
              <input 
                type="text" 
                value={completionPrompt.title} 
                onChange={(e) => setCompletionPrompt({ ...completionPrompt, title: e.target.value })} 
                placeholder="Enter a title for the new sub task..."
                className="w-full p-2 text-sm border rounded bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#A9B1A6]" />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Details / Notes</label>
              <textarea 
                rows={2}
                value={completionPrompt.desc} 
                onChange={(e) => setCompletionPrompt({ ...completionPrompt, desc: e.target.value })} 
                placeholder="Why is this sub task needed?"
                className="w-full p-2 text-sm border rounded bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#A9B1A6]"></textarea>
            </div>

            <div className="flex gap-3">
              <div className="w-1/2">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Assigned To</label>
                <select 
                  value={completionPrompt.assignee} 
                  onChange={(e) => setCompletionPrompt({ ...completionPrompt, assignee: e.target.value })} 
                  className="w-full p-2 border rounded bg-white text-xs focus:outline-none">
                  {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </div>

              <div className="w-1/2">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Schedule For</label>
                <input 
                  type="date" 
                  value={completionPrompt.targetDate} 
                  onChange={(e) => setCompletionPrompt({ ...completionPrompt, targetDate: e.target.value })} 
                  className="w-full p-1.5 text-sm border rounded bg-white focus:outline-none" />
              </div>
            </div>

            <div className="flex gap-2 mt-2 pt-3 border-t">
              <button 
                onClick={() => setCompletionPrompt(null)}
                className="w-1/3 bg-gray-100 text-gray-600 font-bold py-2 rounded text-xs hover:bg-gray-200 transition">
                Cancel
              </button>
              <button 
                onClick={() => executeCompletion(true)}
                className="w-2/3 bg-[#A9B1A6] text-white font-bold py-2 rounded text-xs hover:bg-gray-600 transition shadow-sm">
                Complete Original & Deploy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}