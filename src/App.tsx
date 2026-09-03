import { useState } from 'react';

export default function App() {
  const [currentView, setCurrentView] = useState('list');
  const [recurrenceType, setRecurrenceType] = useState('fixed');
  const [activeDays, setActiveDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [hasSpecificTime, setHasSpecificTime] = useState(false);

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDay = (day) => {
    setActiveDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="min-h-screen bg-[#A9B1A6] p-8 font-sans text-[#333333]">
      <div className="max-w-6xl mx-auto bg-[#F4F3ED] p-6 rounded-lg shadow-sm min-h-[800px] flex flex-col">
        
        {currentView === 'list' && (
          <>
            <div className="flex justify-between items-center mb-6 border-b border-gray-300 pb-4">
              <div>
                <h1 className="text-3xl font-serif font-bold">Command Center</h1>
                <p className="text-xs text-gray-500 mt-1">Daily execution agenda for team assignees</p>
              </div>
              <div className="flex gap-3">
                <input type="text" placeholder="Search tasks..." className="px-4 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#A9B1A6]" />
                <button 
                  onClick={() => setCurrentView('create')}
                  className="bg-[#A9B1A6] text-white px-5 py-2 rounded text-sm font-bold shadow-sm hover:bg-gray-600 transition">
                  + New Task
                </button>
              </div>
            </div>

            <div className="flex-col flex gap-6 overflow-y-auto pr-2">
              
              {/* SECTION 1: TIMED COMMITMENTS */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Scheduled Time Slots</h2>
                </div>
                
                <div className="flex flex-col gap-3">
                  {/* Timed Task 1 */}
                  <div className="bg-white p-4 rounded border-l-4 border-red-500 shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50 transition">
                    <div className="w-1/2 flex items-center gap-4">
                      <span className="font-mono text-sm font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">09:00 AM</span>
                      <div>
                        <h3 className="font-bold text-lg">Meeting with Matt</h3>
                        <p className="text-sm text-gray-500 truncate">Q3 strategy alignment and operations review.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-semibold text-red-700 bg-red-100 px-3 py-1 rounded-full w-20 text-center">High</span>
                      <div className="w-8 h-8 rounded-full border-2 border-[#F4F3ED] bg-gray-600 flex items-center justify-center text-xs text-white shadow-sm">AM</div>
                    </div>
                  </div>

                  {/* Timed Task 2 */}
                  <div className="bg-white p-4 rounded border-l-4 border-amber-400 shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50 transition">
                    <div className="w-1/2 flex items-center gap-4">
                      <span className="font-mono text-sm font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">02:00 PM</span>
                      <div>
                        <h3 className="font-bold text-lg">Client Follow-up</h3>
                        <p className="text-sm text-gray-500 truncate">Call the Smith estate regarding housekeeping adjustments.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full w-20 text-center">Medium</span>
                      <div className="w-8 h-8 rounded-full border-2 border-[#F4F3ED] bg-gray-500 flex items-center justify-center text-xs text-white shadow-sm">AR</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: ANYTIME TODAY TASKS */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-[#A9B1A6]"></span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Flexible Tasks (Anytime Today)</h2>
                </div>

                <div className="flex flex-col gap-3">
                  {/* Flexible Task 1 */}
                  <div className="bg-white/80 p-4 rounded border-l-4 border-[#A9B1A6] shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50 transition">
                    <div className="w-1/2 flex items-center gap-4">
                      <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-200 uppercase">All-Day</span>
                      <div>
                        <h3 className="font-bold text-base text-gray-800">Wash Laundry & Linens</h3>
                        <p className="text-sm text-gray-500 truncate">Complete routine wash for main guest quarters.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full w-20 text-center">Routine</span>
                      <div className="w-8 h-8 rounded-full border-2 border-[#F4F3ED] bg-gray-700 flex items-center justify-center text-xs text-white shadow-sm">MS</div>
                    </div>
                  </div>

                  {/* Flexible Task 2 */}
                  <div className="bg-white/80 p-4 rounded border-l-4 border-[#A9B1A6] shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50 transition">
                    <div className="w-1/2 flex items-center gap-4">
                      <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-200 uppercase">All-Day</span>
                      <div>
                        <h3 className="font-bold text-base text-gray-800">Check Water Meter</h3>
                        <p className="text-sm text-gray-500 truncate">Log daily levels in maintenance sheet.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full w-20 text-center">Routine</span>
                      <div className="w-8 h-8 rounded-full border-2 border-[#F4F3ED] bg-gray-600 flex items-center justify-center text-xs text-white shadow-sm">AM</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </>
        )}

        {currentView === 'create' && (
          <div className="flex flex-col h-full animate-fade-in">
            <div className="flex justify-between items-center mb-6 border-b border-gray-300 pb-4">
              <h1 className="text-3xl font-serif font-bold">Task Builder</h1>
              <button 
                onClick={() => setCurrentView('list')}
                className="text-gray-500 hover:text-gray-800 font-semibold text-sm transition">
                ✕ Cancel
              </button>
            </div>

            <div className="flex gap-8 h-full">
              <div className="w-1/2 flex flex-col gap-5 border-r border-gray-300 pr-8">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Task Title</label>
                  <input type="text" placeholder="e.g., Check Water Meter" className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#A9B1A6]" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                  <textarea rows={4} placeholder="Add instructions for this task..." className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#A9B1A6]"></textarea>
                </div>

                <div className="flex gap-4">
                  <div className="w-1/2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Assignees</label>
                    <select className="w-full px-4 py-2 rounded border border-gray-300 bg-white mb-2">
                      <option>Select team members...</option>
                      <option>Alex M.</option>
                      <option>Adrian R.</option>
                      <option>Marc S.</option>
                    </select>
                    <div className="flex flex-wrap gap-2">
                      <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded flex items-center gap-1 cursor-pointer hover:bg-red-100 hover:text-red-700 transition">Adrian R. ✕</span>
                      <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded flex items-center gap-1 cursor-pointer hover:bg-red-100 hover:text-red-700 transition">Marc S. ✕</span>
                    </div>
                  </div>

                  <div className="w-1/2 flex flex-col gap-2">
                    <label className="block text-sm font-bold text-gray-700">Initial Deadline</label>
                    <input type="date" className="w-full px-4 py-2 rounded border border-gray-300 bg-white text-sm" />
                    
                    <div className="flex items-center gap-2 mt-1">
                      <input 
                        type="checkbox" 
                        id="timeToggle"
                        checked={hasSpecificTime}
                        onChange={(e) => setHasSpecificTime(e.target.checked)}
                        className="accent-[#A9B1A6] w-4 h-4 cursor-pointer" 
                      />
                      <label htmlFor="timeToggle" className="text-xs text-gray-600 cursor-pointer select-none">
                        Add specific time
                      </label>
                    </div>

                    {hasSpecificTime && (
                      <input 
                        type="time" 
                        defaultValue="09:00" 
                        className="w-full px-3 py-1.5 rounded border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#A9B1A6] animate-fade-in" 
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="w-1/2 flex flex-col gap-4 overflow-y-auto pb-4">
                <h3 className="font-bold text-gray-500 uppercase tracking-wider text-xs mb-1">Modular Logic Settings</h3>
                
                <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-sm mb-2">Recurrence Engine</h4>
                  <select 
                    value={recurrenceType}
                    onChange={(e) => setRecurrenceType(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded border border-gray-300 bg-gray-50 mb-2 focus:outline-none">
                    <option value="once">One-time Task</option>
                    <option value="fixed">Fixed Calendar Schedule</option>
                    <option value="completion">Completion-Triggered</option>
                  </select>

                  {recurrenceType === 'fixed' && (
                    <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-gray-100">
                      <div>
                        <span className="block text-xs font-semibold text-gray-600 mb-2">Active Days:</span>
                        <div className="flex gap-1">
                          {daysOfWeek.map(day => (
                            <button 
                              key={day}
                              onClick={() => toggleDay(day)}
                              className={`flex-1 py-1 text-xs font-bold rounded border ${activeDays.includes(day) ? 'bg-[#A9B1A6] text-white border-[#A9B1A6]' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'} transition`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-600">Generation Time:</span>
                        <input type="time" defaultValue="13:00" className="border border-gray-300 rounded px-2 py-1 text-sm w-32 focus:outline-none" />
                      </div>
                    </div>
                  )}

                  {recurrenceType === 'completion' && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                      <span className="text-sm text-gray-600">Re-deploy task</span>
                      <input type="number" defaultValue={14} className="border border-gray-300 rounded px-2 py-1 text-sm w-16 text-center focus:outline-none" />
                      <span className="text-sm text-gray-600">days after completion</span>
                    </div>
                  )}
                </div>

                <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-sm mb-2">Task Chaining</h4>
                  <p className="text-xs text-gray-500 mb-3">Automatically generate a follow-up task upon completion.</p>
                  <button className="text-xs font-bold text-[#A9B1A6] border border-[#A9B1A6] px-3 py-1 rounded hover:bg-[#A9B1A6] hover:text-white transition">
                    + Add Next Step
                  </button>
                </div>

                <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-sm mb-2">Proof of Work</h4>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" className="accent-[#A9B1A6] w-4 h-4" />
                      Require photo upload to complete task
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" className="accent-[#A9B1A6] w-4 h-4" />
                      Require comment update to complete task
                    </label>
                  </div>
                </div>

                <div className="bg-[#A9B1A6]/10 p-4 rounded border border-[#A9B1A6]/30">
                  <h4 className="font-bold text-sm mb-2 text-gray-800">Admin Notification Rules</h4>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" className="accent-[#A9B1A6] w-4 h-4" defaultChecked />
                      Notify me when task is completed
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" className="accent-[#A9B1A6] w-4 h-4" />
                      Notify me on new task comments
                    </label>
                  </div>
                </div>

              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-gray-300 flex justify-end">
              <button 
                onClick={() => setCurrentView('list')}
                className="bg-[#333333] text-white px-8 py-3 rounded font-bold shadow-sm hover:bg-black transition">
                Deploy Task
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}