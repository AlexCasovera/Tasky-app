import { useState } from 'react';

export default function App() {
  const [currentView, setCurrentView] = useState('list');
  const [userRole, setUserRole] = useState('admin'); // 'admin' | 'assignee'
  const [selectedTask, setSelectedTask] = useState(null); // Controls task detail modal
  
  // Builder States
  const [recurrenceType, setRecurrenceType] = useState('fixed');
  const [activeDays, setActiveDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [hasSpecificTime, setHasSpecificTime] = useState(false);

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Dummy Task Data
  const sampleTasks = [
    {
      id: 1,
      title: 'Meeting with Matt',
      desc: 'Q3 strategy alignment and operations review.',
      assignees: ['Alex M.'],
      time: '09:00 AM',
      priority: 'High',
      requiresPhoto: false,
      requiresComment: true,
      type: 'timed'
    },
    {
      id: 2,
      title: 'Client Follow-up',
      desc: 'Call the Smith estate regarding housekeeping adjustments.',
      assignees: ['Adrian R.'],
      time: '02:00 PM',
      priority: 'Medium',
      requiresPhoto: false,
      requiresComment: false,
      type: 'timed'
    },
    {
      id: 3,
      title: 'Wash Laundry & Linens',
      desc: 'Complete routine wash for main guest quarters.',
      assignees: ['Marc S.'],
      time: 'All-Day',
      priority: 'Routine',
      requiresPhoto: true,
      requiresComment: false,
      type: 'flexible'
    }
  ];

  const toggleDay = (day) => {
    setActiveDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Filter tasks based on role (Assignee only sees 'Adrian R.' tasks for demo)
  const visibleTasks = userRole === 'admin' 
    ? sampleTasks 
    : sampleTasks.filter(t => t.assignees.includes('Adrian R.'));

  return (
    <div className="min-h-screen bg-[#A9B1A6] p-8 font-sans text-[#333333]">
      <div className="max-w-6xl mx-auto bg-[#F4F3ED] p-6 rounded-lg shadow-sm min-h-[800px] flex flex-col relative">
        
        {/* TOP ROLE SWITCHER BAR */}
        <div className="bg-[#333333] text-white px-4 py-2 rounded-md mb-6 flex justify-between items-center text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-400 uppercase tracking-wider">Simulate Role:</span>
            <button 
              onClick={() => setUserRole('admin')}
              className={`px-3 py-1 rounded font-bold transition ${userRole === 'admin' ? 'bg-[#A9B1A6] text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              Admin View (All Tasks)
            </button>
            <button 
              onClick={() => setUserRole('assignee')}
              className={`px-3 py-1 rounded font-bold transition ${userRole === 'assignee' ? 'bg-[#A9B1A6] text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              Assignee View (Adrian R. Only)
            </button>
          </div>
          <span className="text-gray-400 italic">
            {userRole === 'admin' ? 'Showing all team tasks' : 'Filtered to assigned tasks only'}
          </span>
        </div>

        {/* COMMAND CENTER (LIST VIEW) */}
        {currentView === 'list' && (
          <>
            <div className="flex justify-between items-center mb-6 border-b border-gray-300 pb-4">
              <div>
                <h1 className="text-3xl font-serif font-bold">Command Center</h1>
                <p className="text-xs text-gray-500 mt-1">
                  {userRole === 'admin' ? 'Master Admin View' : 'Personal Work Queue for Adrian R.'}
                </p>
              </div>
              <div className="flex gap-3">
                <input type="text" placeholder="Search tasks..." className="px-4 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#A9B1A6]" />
                {userRole === 'admin' && (
                  <button 
                    onClick={() => setCurrentView('create')}
                    className="bg-[#A9B1A6] text-white px-5 py-2 rounded text-sm font-bold shadow-sm hover:bg-gray-600 transition">
                    + New Task
                  </button>
                )}
              </div>
            </div>

            <div className="flex-col flex gap-6 overflow-y-auto pr-2">
              
              {/* TIMED SECTION */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Scheduled Time Slots</h2>
                </div>
                
                <div className="flex flex-col gap-3">
                  {visibleTasks.filter(t => t.type === 'timed').map(task => (
                    <div 
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="bg-white p-4 rounded border-l-4 border-red-500 shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50 transition">
                      <div className="w-1/2 flex items-center gap-4">
                        <span className="font-mono text-sm font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">{task.time}</span>
                        <div>
                          <h3 className="font-bold text-lg">{task.title}</h3>
                          <p className="text-sm text-gray-500 truncate">{task.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-semibold text-red-700 bg-red-100 px-3 py-1 rounded-full w-20 text-center">{task.priority}</span>
                        <div className="w-8 h-8 rounded-full border-2 border-[#F4F3ED] bg-gray-600 flex items-center justify-center text-xs text-white shadow-sm">
                          {task.assignees[0].split(' ').map(n=>n[0]).join('')}
                        </div>
                      </div>
                    </div>
                  ))}
                  {visibleTasks.filter(t => t.type === 'timed').length === 0 && (
                    <p className="text-xs text-gray-400 italic py-2">No timed tasks assigned.</p>
                  )}
                </div>
              </div>

              {/* FLEXIBLE SECTION */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-[#A9B1A6]"></span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Flexible Tasks (Anytime Today)</h2>
                </div>

                <div className="flex flex-col gap-3">
                  {visibleTasks.filter(t => t.type === 'flexible').map(task => (
                    <div 
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="bg-white/80 p-4 rounded border-l-4 border-[#A9B1A6] shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50 transition">
                      <div className="w-1/2 flex items-center gap-4">
                        <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-200 uppercase">{task.time}</span>
                        <div>
                          <h3 className="font-bold text-base text-gray-800">{task.title}</h3>
                          <p className="text-sm text-gray-500 truncate">{task.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full w-20 text-center">{task.priority}</span>
                        <div className="w-8 h-8 rounded-full border-2 border-[#F4F3ED] bg-gray-700 flex items-center justify-center text-xs text-white shadow-sm">
                          {task.assignees[0].split(' ').map(n=>n[0]).join('')}
                        </div>
                      </div>
                    </div>
                  ))}
                  {visibleTasks.filter(t => t.type === 'flexible').length === 0 && (
                    <p className="text-xs text-gray-400 italic py-2">No flexible tasks assigned.</p>
                  )}
                </div>
              </div>

            </div>
          </>
        )}

        {/* CREATE TASK BUILDER */}
        {currentView === 'create' && (
          <div className="flex flex-col h-full animate-fade-in">
            <div className="flex justify-between items-center mb-6 border-b border-gray-300 pb-4">
              <h1 className="text-3xl font-serif font-bold">Task Builder</h1>
              <button onClick={() => setCurrentView('list')} className="text-gray-500 hover:text-gray-800 font-semibold text-sm">✕ Cancel</button>
            </div>

            <div className="flex gap-8 h-full">
              <div className="w-1/2 flex flex-col gap-5 border-r border-gray-300 pr-8">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Task Title</label>
                  <input type="text" placeholder="e.g., Check Water Meter" className="w-full px-4 py-2 rounded border border-gray-300" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                  <textarea rows={4} placeholder="Add instructions for this task..." className="w-full px-4 py-2 rounded border border-gray-300"></textarea>
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
                  </div>
                  <div className="w-1/2 flex flex-col gap-2">
                    <label className="block text-sm font-bold text-gray-700">Initial Deadline</label>
                    <input type="date" className="w-full px-4 py-2 rounded border border-gray-300 bg-white text-sm" />
                    <div className="flex items-center gap-2 mt-1">
                      <input type="checkbox" id="timeToggle" checked={hasSpecificTime} onChange={(e) => setHasSpecificTime(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4 cursor-pointer" />
                      <label htmlFor="timeToggle" className="text-xs text-gray-600 cursor-pointer">Add specific time</label>
                    </div>
                    {hasSpecificTime && <input type="time" defaultValue="09:00" className="w-full px-3 py-1.5 rounded border border-gray-300 bg-white text-sm" />}
                  </div>
                </div>
              </div>

              <div className="w-1/2 flex flex-col gap-4 overflow-y-auto pb-4">
                <h3 className="font-bold text-gray-500 uppercase tracking-wider text-xs mb-1">Modular Logic Settings</h3>
                <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-sm mb-2">Recurrence Engine</h4>
                  <select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)} className="w-full px-3 py-2 text-sm rounded border border-gray-300 bg-gray-50 mb-2">
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
                            <button key={day} onClick={() => toggleDay(day)} className={`flex-1 py-1 text-xs font-bold rounded border ${activeDays.includes(day) ? 'bg-[#A9B1A6] text-white border-[#A9B1A6]' : 'bg-white text-gray-500 border-gray-300'}`}>{day}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-gray-300 flex justify-end">
              <button onClick={() => setCurrentView('list')} className="bg-[#333333] text-white px-8 py-3 rounded font-bold shadow-sm hover:bg-black transition">Deploy Task</button>
            </div>
          </div>
        )}

        {/* TASK DETAIL / ASSIGNEE EXECUTION MODAL */}
        {selectedTask && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#F4F3ED] max-w-lg w-full rounded-lg shadow-xl p-6 border border-gray-300 flex flex-col gap-4 animate-fade-in">
              <div className="flex justify-between items-start border-b border-gray-300 pb-3">
                <div>
                  <span className="text-xs font-bold text-[#A9B1A6] uppercase tracking-wider">
                    {userRole === 'admin' ? 'Admin Inspector Mode' : 'Assignee Execution View'}
                  </span>
                  <h2 className="text-2xl font-serif font-bold">{selectedTask.title}</h2>
                </div>
                <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
              </div>

              <p className="text-sm text-gray-600 bg-white p-3 rounded border border-gray-200">{selectedTask.desc}</p>

              <div className="flex justify-between text-xs text-gray-500 bg-gray-100 p-2 rounded">
                <span>Assignee: <strong>{selectedTask.assignees.join(', ')}</strong></span>
                <span>Due: <strong>{selectedTask.time}</strong></span>
              </div>

              {/* PROOF OF WORK REQUIREMENTS */}
              <div className="flex flex-col gap-3 my-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500">Completion Requirements</h4>
                
                {selectedTask.requiresPhoto && (
                  <div className="bg-white p-3 rounded border border-amber-300 flex justify-between items-center">
                    <span className="text-xs font-semibold text-amber-800">📷 Photo Upload Required</span>
                    <button className="text-xs bg-amber-100 text-amber-800 font-bold px-3 py-1 rounded hover:bg-amber-200">Upload Photo</button>
                  </div>
                )}

                {selectedTask.requiresComment && (
                  <div className="bg-white p-3 rounded border border-blue-300 flex flex-col gap-2">
                    <span className="text-xs font-semibold text-blue-800">💬 Comment Required before completion</span>
                    <textarea rows={2} placeholder="Add your execution notes here..." className="w-full p-2 text-xs border border-gray-200 rounded focus:outline-none"></textarea>
                  </div>
                )}

                {!selectedTask.requiresPhoto && !selectedTask.requiresComment && (
                  <p className="text-xs text-gray-400 italic">No proof-of-work required. Ready to mark complete.</p>
                )}
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex justify-between items-center pt-3 border-t border-gray-300">
                {userRole === 'admin' && (
                  <button className="text-xs text-red-600 font-bold hover:underline">Reassign or Delete</button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => setSelectedTask(null)} className="px-4 py-2 rounded text-xs font-bold text-gray-600 hover:bg-gray-200">Close</button>
                  <button 
                    onClick={() => setSelectedTask(null)}
                    className="bg-[#A9B1A6] text-white px-5 py-2 rounded text-xs font-bold shadow-sm hover:bg-gray-600 transition">
                    Mark Task Complete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}