import { useState } from 'react';

export default function App() {
  const [currentView, setCurrentView] = useState('list'); // 'list' | 'create'
  const [userRole, setUserRole] = useState('admin'); // 'admin' | 'assignee'
  const [selectedTask, setSelectedTask] = useState(null); // Active modal task
  const [isEditing, setIsEditing] = useState(false); // Admin edit state inside modal

  // Form State for Builder / Editor
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [hasSpecificTime, setHasSpecificTime] = useState(false);
  const [taskTime, setTaskTime] = useState('09:00');
  const [recurrenceType, setRecurrenceType] = useState('once');
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [requiresComment, setRequiresComment] = useState(false);
  
  // Execution State inside Modal
  const [executionComment, setExecutionComment] = useState('');
  const [photoUploaded, setPhotoUploaded] = useState(false);

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const teamMembers = ['Alex M.', 'Adrian R.', 'Marc S.'];

  // Default In-Memory Initial Task List
  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: 'Meeting with Matt',
      desc: 'Q3 strategy alignment and operations review.',
      assignees: ['Alex M.'],
      time: '09:00 AM',
      priority: 'High',
      requiresPhoto: false,
      requiresComment: true,
      type: 'timed',
      status: 'pending'
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
      type: 'timed',
      status: 'pending'
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
      type: 'flexible',
      status: 'pending'
    }
  ]);

  // Helper Functions
  const resetForm = () => {
    setTaskTitle('');
    setTaskDesc('');
    setSelectedAssignees([]);
    setTaskPriority('Medium');
    setHasSpecificTime(false);
    setTaskTime('09:00');
    setRecurrenceType('once');
    setRequiresPhoto(false);
    setRequiresComment(false);
  };

  const handleAddAssignee = (name) => {
    if (name && !selectedAssignees.includes(name)) {
      setSelectedAssignees([...selectedAssignees, name]);
    }
  };

  const handleRemoveAssignee = (name) => {
    setSelectedAssignees(selectedAssignees.filter(a => a !== name));
  };

  const handleDeployTask = () => {
    if (!taskTitle.trim()) return alert('Please provide a task title.');

    const newTask = {
      id: Date.now(),
      title: taskTitle,
      desc: taskDesc,
      assignees: selectedAssignees.length > 0 ? selectedAssignees : ['Unassigned'],
      time: hasSpecificTime ? taskTime : 'All-Day',
      priority: taskPriority,
      requiresPhoto,
      requiresComment,
      type: hasSpecificTime ? 'timed' : 'flexible',
      status: 'pending'
    };

    setTasks([newTask, ...tasks]);
    resetForm();
    setCurrentView('list');
  };

  const handleOpenModal = (task) => {
    setSelectedTask(task);
    setIsEditing(false);
    setExecutionComment('');
    setPhotoUploaded(false);
    // Populate form fields for potential edit
    setTaskTitle(task.title);
    setTaskDesc(task.desc);
    setSelectedAssignees(task.assignees);
    setTaskPriority(task.priority);
    setRequiresPhoto(task.requiresPhoto);
    setRequiresComment(task.requiresComment);
  };

  const handleSaveChanges = () => {
    setTasks(tasks.map(t => {
      if (t.id === selectedTask.id) {
        return {
          ...t,
          title: taskTitle,
          desc: taskDesc,
          assignees: selectedAssignees,
          priority: taskPriority,
          requiresPhoto,
          requiresComment
        };
      }
      return t;
    }));
    setSelectedTask(null);
    setIsEditing(false);
  };

  const handleDeleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
    setSelectedTask(null);
  };

  const handleCompleteTask = (id) => {
    if (selectedTask.requiresPhoto && !photoUploaded) {
      return alert('A photo upload is required to complete this task.');
    }
    if (selectedTask.requiresComment && !executionComment.trim()) {
      return alert('An execution comment is required to complete this task.');
    }

    setTasks(tasks.map(t => t.id === id ? { ...t, status: 'completed' } : t));
    setSelectedTask(null);
  };

  // Role Filtering Logic
  const visibleTasks = userRole === 'admin' 
    ? tasks 
    : tasks.filter(t => t.assignees.includes('Adrian R.'));

  return (
    <div className="min-h-screen bg-[#A9B1A6] p-8 font-sans text-[#333333]">
      <div className="max-w-6xl mx-auto bg-[#F4F3ED] p-6 rounded-lg shadow-sm min-h-[800px] flex flex-col relative">
        
        {/* ROLE SIMULATION TOOLBAR */}
        <div className="bg-[#333333] text-white px-4 py-2 rounded-md mb-6 flex justify-between items-center text-xs shadow-md">
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
            {userRole === 'admin' ? 'Showing full team operations' : 'Filtered to assigned tasks'}
          </span>
        </div>

        {/* COMMAND CENTER LIST VIEW */}
        {currentView === 'list' && (
          <>
            <div className="flex justify-between items-center mb-6 border-b border-gray-300 pb-4">
              <div>
                <h1 className="text-3xl font-serif font-bold">Command Center</h1>
                <p className="text-xs text-gray-500 mt-1">
                  {userRole === 'admin' ? 'Master Operations Hub' : 'Personal Queue for Adrian R.'}
                </p>
              </div>
              <div className="flex gap-3">
                {userRole === 'admin' && (
                  <button 
                    onClick={() => { resetForm(); setCurrentView('create'); }}
                    className="bg-[#A9B1A6] text-white px-5 py-2 rounded text-sm font-bold shadow-sm hover:bg-gray-600 transition">
                    + New Task
                  </button>
                )}
              </div>
            </div>

            <div className="flex-col flex gap-6 overflow-y-auto pr-2">
              
              {/* TIMED TASKS */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Scheduled Time Slots</h2>
                </div>
                
                <div className="flex flex-col gap-3">
                  {visibleTasks.filter(t => t.type === 'timed' && t.status !== 'completed').map(task => (
                    <div 
                      key={task.id}
                      onClick={() => handleOpenModal(task)}
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
                        <div className="flex -space-x-2">
                          {task.assignees.map((a, idx) => (
                            <div key={idx} className="w-8 h-8 rounded-full border-2 border-[#F4F3ED] bg-gray-600 flex items-center justify-center text-xs text-white shadow-sm font-bold">
                              {a.split(' ').map(n=>n[0]).join('')}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {visibleTasks.filter(t => t.type === 'timed' && t.status !== 'completed').length === 0 && (
                    <p className="text-xs text-gray-400 italic py-2">No active scheduled time slots.</p>
                  )}
                </div>
              </div>

              {/* FLEXIBLE TASKS */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-[#A9B1A6]"></span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Flexible Tasks (Anytime Today)</h2>
                </div>

                <div className="flex flex-col gap-3">
                  {visibleTasks.filter(t => t.type === 'flexible' && t.status !== 'completed').map(task => (
                    <div 
                      key={task.id}
                      onClick={() => handleOpenModal(task)}
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
                        <div className="flex -space-x-2">
                          {task.assignees.map((a, idx) => (
                            <div key={idx} className="w-8 h-8 rounded-full border-2 border-[#F4F3ED] bg-gray-700 flex items-center justify-center text-xs text-white shadow-sm font-bold">
                              {a.split(' ').map(n=>n[0]).join('')}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {visibleTasks.filter(t => t.type === 'flexible' && t.status !== 'completed').length === 0 && (
                    <p className="text-xs text-gray-400 italic py-2">No active flexible tasks.</p>
                  )}
                </div>
              </div>

              {/* COMPLETED TASKS ARCHIVE */}
              {tasks.some(t => t.status === 'completed') && (
                <div className="pt-4 border-t border-gray-300">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Completed Archive</h2>
                  <div className="flex flex-col gap-2">
                    {tasks.filter(t => t.status === 'completed').map(task => (
                      <div key={task.id} className="bg-gray-200/60 p-3 rounded flex justify-between items-center opacity-60">
                        <span className="line-through text-sm font-bold text-gray-600">{task.title}</span>
                        <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">Completed</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                  <input 
                    type="text" 
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g., Check Water Meter" 
                    className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#A9B1A6]" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                  <textarea 
                    rows={4} 
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    placeholder="Add instructions for this task..." 
                    className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#A9B1A6]"></textarea>
                </div>

                <div className="flex gap-4">
                  <div className="w-1/2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Assignees</label>
                    <select 
                      onChange={(e) => handleAddAssignee(e.target.value)}
                      className="w-full px-4 py-2 rounded border border-gray-300 bg-white mb-2 text-sm focus:outline-none">
                      <option value="">Select team members...</option>
                      {teamMembers.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    
                    <div className="flex flex-wrap gap-2">
                      {selectedAssignees.map(name => (
                        <span key={name} className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded flex items-center gap-1">
                          {name}
                          <button onClick={() => handleRemoveAssignee(name)} className="hover:text-red-700 font-bold ml-1">✕</button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="w-1/2 flex flex-col gap-2">
                    <label className="block text-sm font-bold text-gray-700">Priority</label>
                    <select 
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value)}
                      className="w-full px-4 py-2 rounded border border-gray-300 bg-white text-sm mb-2 focus:outline-none">
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Routine">Routine</option>
                    </select>

                    <div className="flex items-center gap-2 mt-1">
                      <input 
                        type="checkbox" 
                        id="timeToggle"
                        checked={hasSpecificTime}
                        onChange={(e) => setHasSpecificTime(e.target.checked)}
                        className="accent-[#A9B1A6] w-4 h-4 cursor-pointer" 
                      />
                      <label htmlFor="timeToggle" className="text-xs text-gray-600 cursor-pointer">Add specific time slot</label>
                    </div>

                    {hasSpecificTime && (
                      <input 
                        type="time" 
                        value={taskTime}
                        onChange={(e) => setTaskTime(e.target.value)}
                        className="w-full px-3 py-1.5 rounded border border-gray-300 bg-white text-sm focus:outline-none" />
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
                </div>

                <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-sm mb-2">Proof of Work Controls</h4>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={requiresPhoto}
                        onChange={(e) => setRequiresPhoto(e.target.checked)}
                        className="accent-[#A9B1A6] w-4 h-4" />
                      Require photo upload to complete
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={requiresComment}
                        onChange={(e) => setRequiresComment(e.target.checked)}
                        className="accent-[#A9B1A6] w-4 h-4" />
                      Require execution notes/comment to complete
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-gray-300 flex justify-end">
              <button 
                onClick={handleDeployTask}
                className="bg-[#333333] text-white px-8 py-3 rounded font-bold shadow-sm hover:bg-black transition">
                Deploy Task
              </button>
            </div>
          </div>
        )}

        {/* TASK EXECUTION & INSPECTOR MODAL */}
        {selectedTask && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#F4F3ED] max-w-lg w-full rounded-lg shadow-xl p-6 border border-gray-300 flex flex-col gap-4 animate-fade-in">
              <div className="flex justify-between items-start border-b border-gray-300 pb-3">
                <div>
                  <span className="text-xs font-bold text-[#A9B1A6] uppercase tracking-wider">
                    {userRole === 'admin' ? (isEditing ? 'Admin Editor' : 'Admin Inspector Mode') : 'Assignee Execution View'}
                  </span>
                  <h2 className="text-2xl font-serif font-bold">{selectedTask.title}</h2>
                </div>
                <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
              </div>

              {/* READ-ONLY VIEW OR ADMIN EDIT FORM */}
              {!isEditing ? (
                <>
                  <p className="text-sm text-gray-600 bg-white p-3 rounded border border-gray-200">{selectedTask.desc}</p>

                  <div className="flex justify-between text-xs text-gray-500 bg-gray-100 p-2 rounded">
                    <span>Assignees: <strong>{selectedTask.assignees.join(', ')}</strong></span>
                    <span>Deadline: <strong>{selectedTask.time}</strong></span>
                  </div>

                  <div className="flex flex-col gap-3 my-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500">Completion Requirements</h4>
                    
                    {selectedTask.requiresPhoto && (
                      <div className="bg-white p-3 rounded border border-amber-300 flex justify-between items-center">
                        <span className="text-xs font-semibold text-amber-800">
                          📷 {photoUploaded ? 'Photo Attached!' : 'Photo Upload Required'}
                        </span>
                        <button 
                          onClick={() => setPhotoUploaded(!photoUploaded)}
                          className={`text-xs font-bold px-3 py-1 rounded transition ${photoUploaded ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>
                          {photoUploaded ? '✓ Attached' : 'Simulate Photo Upload'}
                        </button>
                      </div>
                    )}

                    {selectedTask.requiresComment && (
                      <div className="bg-white p-3 rounded border border-blue-300 flex flex-col gap-2">
                        <span className="text-xs font-semibold text-blue-800">💬 Notes required to complete</span>
                        <textarea 
                          rows={2} 
                          value={executionComment}
                          onChange={(e) => setExecutionComment(e.target.value)}
                          placeholder="Type status notes here..." 
                          className="w-full p-2 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#A9B1A6]"></textarea>
                      </div>
                    )}

                    {!selectedTask.requiresPhoto && !selectedTask.requiresComment && (
                      <p className="text-xs text-gray-400 italic">No proof-of-work required. Ready to mark complete.</p>
                    )}
                  </div>
                </>
              ) : (
                /* IN-MODAL ADMIN EDIT FORM */
                <div className="flex flex-col gap-3 text-sm">
                  <div>
                    <label className="block font-bold text-xs mb-1">Title</label>
                    <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="w-full p-2 border rounded text-xs" />
                  </div>
                  <div>
                    <label className="block font-bold text-xs mb-1">Description</label>
                    <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} className="w-full p-2 border rounded text-xs" rows={3}></textarea>
                  </div>
                  <div>
                    <label className="block font-bold text-xs mb-1">Assignees</label>
                    <select onChange={(e) => handleAddAssignee(e.target.value)} className="w-full p-2 border rounded text-xs mb-1">
                      <option value="">Add assignee...</option>
                      {teamMembers.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <div className="flex flex-wrap gap-1">
                      {selectedAssignees.map(name => (
                        <span key={name} className="bg-gray-200 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                          {name}
                          <button onClick={() => handleRemoveAssignee(name)} className="font-bold text-red-600">✕</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ACTION FOOTER */}
              <div className="flex justify-between items-center pt-3 border-t border-gray-300 mt-2">
                {userRole === 'admin' && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsEditing(!isEditing)} 
                      className="text-xs text-blue-700 font-bold hover:underline">
                      {isEditing ? 'Cancel Edit' : 'Edit Settings'}
                    </button>
                    <button 
                      onClick={() => handleDeleteTask(selectedTask.id)} 
                      className="text-xs text-red-600 font-bold hover:underline">
                      Delete Task
                    </button>
                  </div>
                )}
                
                <div className="flex gap-2 ml-auto">
                  {isEditing ? (
                    <button 
                      onClick={handleSaveChanges}
                      className="bg-[#333333] text-white px-4 py-2 rounded text-xs font-bold hover:bg-black">
                      Save Changes
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleCompleteTask(selectedTask.id)}
                      className="bg-[#A9B1A6] text-white px-5 py-2 rounded text-xs font-bold shadow-sm hover:bg-gray-600 transition">
                      Mark Task Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}