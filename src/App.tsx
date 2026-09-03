export default function App() {
  return (
    <div className="min-h-screen bg-[#A9B1A6] p-8 font-sans text-[#333333]">
      <div className="max-w-6xl mx-auto bg-[#F4F3ED] p-6 rounded-lg shadow-sm h-[800px] flex flex-col">
        
        {/* HEADER & SORTING CONTROLS */}
        <div className="flex justify-between items-center mb-6 border-b border-gray-300 pb-4">
          <h1 className="text-3xl font-serif font-bold">Command Center</h1>
          <div className="flex gap-3">
            <input type="text" placeholder="Search tasks..." className="px-4 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#A9B1A6]" />
            <select className="bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded text-sm cursor-pointer focus:outline-none">
              <option>Sort by: Priority (High to Low)</option>
              <option>Sort by: Due Date (Earliest)</option>
              <option>Sort by: Assignee</option>
            </select>
          </div>
        </div>

        {/* LIST OF TASKS */}
        <div className="flex-col flex gap-3 overflow-y-auto pr-2">
          
          {/* Task Row: High Priority */}
          <div className="bg-white p-4 rounded border-l-4 border-red-500 shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50 transition">
            <div className="w-1/2">
              <h3 className="font-bold text-lg">Client Follow-up</h3>
              <p className="text-sm text-gray-500 truncate">Call the Smith estate regarding the recurring housekeeping schedule adjustment.</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-red-700 bg-red-100 px-3 py-1 rounded-full w-20 text-center">High</span>
              <span className="text-sm font-semibold text-red-600 w-32 text-right">Due: Today, 2 PM</span>
              <div className="w-8 h-8 rounded-full border-2 border-[#F4F3ED] bg-gray-600 flex items-center justify-center text-xs text-white shadow-sm">AM</div>
            </div>
          </div>

          {/* Task Row: Medium Priority */}
          <div className="bg-white p-4 rounded border-l-4 border-amber-400 shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50 transition">
            <div className="w-1/2">
              <h3 className="font-bold text-lg">Print Flyers</h3>
              <p className="text-sm text-gray-500 truncate">Create the files for the company event. Using the premium cardstock...</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full w-20 text-center">Medium</span>
              <span className="text-sm font-semibold text-gray-600 w-32 text-right">Tomorrow, 5 PM</span>
              <div className="w-8 h-8 rounded-full border-2 border-[#F4F3ED] bg-gray-500 flex items-center justify-center text-xs text-white shadow-sm">MV</div>
            </div>
          </div>

          {/* Task Row: Completed */}
          <div className="bg-white p-4 rounded border-l-4 border-[#A9B1A6] shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50 transition opacity-75">
            <div className="w-1/2">
              <h3 className="font-bold text-lg text-gray-500 line-through">Restock Cleaning Supplies</h3>
              <p className="text-sm text-gray-400 truncate">Inventory check and order placed for next month.</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-white bg-[#A9B1A6] px-3 py-1 rounded-full w-20 text-center">Done</span>
              <span className="text-sm font-semibold text-gray-400 w-32 text-right">Completed</span>
              <div className="w-8 h-8 rounded-full border-2 border-[#F4F3ED] bg-gray-600 flex items-center justify-center text-xs text-white shadow-sm">AM</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}