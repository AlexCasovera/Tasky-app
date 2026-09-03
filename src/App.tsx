import { useState } from 'react';

export default function App() {
  const [currentView, setCurrentView] = useState('day'); // 'list' | 'day' | 'week' | 'month' | 'create'
  const [userRole, setUserRole] = useState('admin'); // 'admin' | 'assignee'
  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form State for Builder / Editor
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskDate, setTaskDate] = useState('2026-09-04');
  const [hasSpecificTime, setHasSpecificTime] = useState(true);
  const [taskStartHour, setTaskStartHour] = useState(9);
  const [taskDuration, setTaskDuration] = useState(2);

  // Recurrence Engine States
  const [recurrenceType, setRecurrenceType] = useState('once');
  const [activeDays, setActiveDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [cadenceDays, setCadenceDays] = useState(14);

  // Proof of Work Controls
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [requiresComment, setRequiresComment] = useState(false);
  
  // Execution State inside Modal
  const [executionComment, setExecutionComment] = useState('');
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [additionalNote, setAdditionalNote] = useState('');

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const timeSlots = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]; // 8 AM to 5 PM
  
  // Team Member Identity Configuration (Colors & Avatars)
  const teamMembers = [
    { name: 'Alex M.', initials: 'AM', color: 'bg-[#E63946]', border: 'border-red-600', badge: 'bg-red-100 text-red-800' },
    { name: 'Adrian R.', initials: 'AR', color: 'bg-[#7209B7]', border: 'border-purple-600', badge: 'bg-purple-100 text-purple-800' },
    { name: 'Marc S.', initials: 'MS', color: 'bg-[#0077B6]', border: 'border-blue-600', badge: 'bg-blue-100 text-blue-800' }
  ];

  // In-Memory Task Database with Time Grid Coordinates
  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: 'Meeting with Matt',
      desc: 'Q3 strategy alignment and operations review.',
      assignees: ['Alex M.'],
      date: '2026-09-04',
      dayOfWeek: 'Fri',
      dayOfMonth: 4,
      startHour: 9,
      duration: 2, // Spans 9:00 AM - 11:00 AM
      timeLabel: '09:00 AM - 11:00 AM',
      priority: 'High',
      requiresPhoto: false,
      requiresComment: true,
      type: 'timed',
      status: 'pending',
      comments: ['Admin created task.']
    },
    {
      id: 2,
      title: 'Client Follow-up',
      desc: 'Call the Smith estate regarding housekeeping adjustments.',
      assignees: ['Adrian R.'],
      date: '2026-09-04',
      dayOfWeek: 'Fri',
      dayOfMonth: 4,
      startHour: 14,
      duration: 1.5, // Spans 2:00 PM - 3:30 PM
      timeLabel: '02:00 PM - 03:30 PM',
      priority: 'Medium',
      requiresPhoto: false,
      requiresComment: false,
      type: 'timed',
      status: 'pending',
      comments: []
    },
    {
      id: 3,
      title: 'Vendor Estimates',
      desc: 'Gather quotes from local suppliers for quarterly office restock.',
      assignees: ['Marc S.'],
      date: '2026-09-04',
      dayOfWeek: 'Fri',
      dayOfMonth: 4,
      startHour: 11,
      duration: 2, // Spans 11:00 AM - 1:00 PM
      timeLabel: '11:00 AM - 01:00 PM',
      priority: 'Low',
      requiresPhoto: false,
      requiresComment: true,
      type: 'timed',
      status: 'pending',
      comments: []
    },
    {
      id: 4,
      title: 'Wash Laundry & Linens',
      desc: 'Complete routine wash for main guest quarters.',
      assignees: ['Marc S.'],
      date: '2026-09-04',
      dayOfWeek: 'Fri',
      dayOfMonth: 4,
      startHour: null,
      duration: null,
      timeLabel: 'All-Day',
      priority: 'Routine',
      requiresPhoto: true,
      requiresComment: false,
      type: 'flexible',
      status: 'pending',
      comments: []
    }
  ]);

  // Helper Functions
  const resetForm = () => {
    setTaskTitle('');
    setTaskDesc('');
    setSelectedAssignees([]);
    setTaskPriority('Medium');
    setTaskDate('2026-09-04');
    setHasSpecificTime(true);
    setTaskStartHour(9);
    setTaskDuration(2);
    setRecurrenceType('once');
    setRequiresPhoto(false);
    setRequiresComment(false);
  };

  const getMemberConfig = (name) => {
    return teamMembers.find(m => m.name === name) || { name, initials: '??', color: 'bg-gray-600', border: 'border-gray-500', badge: 'bg-gray-100 text-gray-800' };
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

    const startH = Number(taskStartHour);
    const dur = Number(taskDuration);
    const endH = startH + dur;
    
    const formatHour = (h) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formatted = h % 12 === 0 ? 12 : h % 12;
      return `${formatted < 10 ? '0' + formatted : formatted}:00 ${ampm}`;
    };

    const newTask = {
      id: Date.now(),
      title: taskTitle,
      desc: taskDesc,
      assignees: selectedAssignees.length > 0 ? selectedAssignees : ['Alex M.'],
      date: taskDate,
      dayOfWeek: 'Fri',
      dayOfMonth: 4,
      startHour: hasSpecificTime ? startH : null,
      duration: hasSpecificTime ? dur : null,
      timeLabel: hasSpecificTime ? `${formatHour(startH)} - ${formatHour(endH)}` : 'All-Day',
      priority: taskPriority,
      requiresPhoto,
      requiresComment,
      type: hasSpecificTime ? 'timed' : 'flexible',
      status: 'pending',
      comments: []
    };

    setTasks([newTask, ...tasks]);
    resetForm();
    setCurrentView('day');
  };

  const handleOpenModal = (task) => {
    setSelectedTask(task);
    setIsEditing(false);
    setExecutionComment('');
    setPhotoUploaded(false);
    setAdditionalNote('');
    setTaskTitle(task.title);
    setTaskDesc(task.desc);
    setSelectedAssignees(task.assignees);
    setTaskPriority(task.priority);
  };

  const handleSaveChanges = () => {
    setTasks(tasks.map(t => t.id === selectedTask.id ? { ...t, title: taskTitle, desc: taskDesc, assignees: selectedAssignees, priority: taskPriority } : t));
    setSelectedTask(null);
    setIsEditing(false);
  };

  const handleCompleteTask = (id) => {
    if (selectedTask.requiresPhoto && !photoUploaded) return alert('Photo upload required.');
    if (selectedTask.requiresComment && !executionComment.trim()) return alert('Execution note required.');

    setTasks(tasks.map(t => {
      if (t.id === id) {
        const newComments = executionComment.trim() ? [...t.comments, `${userRole === 'admin' ? 'Admin' : 'Assignee'}: ${executionComment}`] : t.comments;
        return { ...t, status: 'completed', comments: newComments };
      }
      return t;
    }));
    setSelectedTask(null);
  };

  // Filter team columns based on role simulation
  const visibleMembers = userRole === 'admin' 
    ? teamMembers 
    : teamMembers.filter(m => m.name === 'Adrian R.');

  const visibleTasks = userRole === 'admin'
    ? tasks
    : tasks.filter(t => t.assignees.includes('Adrian R.'));

  return (
    <div className="min-h-screen bg-[#A9B1A6] p-4 sm:p-8 font-sans text-[#333333]">
      <div className="max-w-7xl mx-auto bg-[#F4F3ED] p-6 rounded-lg shadow-sm min-h-[850px] flex flex-col relative">
        
        {/* ROLE SIMULATION TOOLBAR */}
        <div className="bg-[#333333] text-white px-4 py-2 rounded-md mb-4 flex justify-between items-center text-xs shadow-md">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-400 uppercase tracking-wider">Simulate Role:</span>
            <button 
              onClick={() => setUserRole('admin')}
              className={`px-3 py-1 rounded font-bold transition ${userRole === 'admin' ? 'bg-[#A9B1A6] text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              Admin View (All Columns)
            </button>
            <button 
              onClick={() => setUserRole('assignee')}
              className={`px-3 py-1 rounded font-bold transition ${userRole === 'assignee' ? 'bg-[#A9B1A6] text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              Assignee View (Adrian R.)
            </button>
          </div>
          <span className="text-gray-400 italic">
            {userRole === 'admin' ? 'Full Dispatch Center' : 'Personal Schedule Only'}
          </span>
        </div>

        {/* TOP HEADER & VIEW NAVIGATION TABS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-300 pb-4">
          <div>
            <h1 className="text-3xl font-serif font-bold">Command Center</h1>
            <p className="text-xs text-gray-500 mt-0.5">Friday, September 4, 2026</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* VIEW SWITCHER BUTTONS */}
            <div className="bg-gray-200 p-1 rounded-lg flex items-center gap-1 border border-gray-300">
              <button 
                onClick={() => setCurrentView('list')}
                className={`px-3 py-1.5 text-xs font-bold rounded transition ${currentView === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                List
              </button>
              <button 
                onClick={() => setCurrentView('day')}
                className={`px-3 py-1.5 text-xs font-bold rounded transition ${currentView === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                Day
              </button>
              <button 
                onClick={() => setCurrentView('week')}
                className={`px-3 py-1.5 text-xs font-bold rounded transition ${currentView === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                Week
              </button>
              <button 
                onClick={() => setCurrentView('month')}
                className={`px-3 py-1.5 text-xs font-bold rounded transition ${currentView === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                Month
              </button>
            </div>

            {userRole === 'admin' && (
              <button 
                onClick={() => { resetForm(); setCurrentView('create'); }}
                className="bg-[#A9B1A6] text-white px-4 py-2 rounded text-xs font-bold shadow-sm hover:bg-gray-600 transition">
                + New Task
              </button>
            )}
          </div>
        </div>

        {/* =========================================
            VIEW 1: DAY SCHEDULE GRID (HCP STYLE)
            ========================================= */}
        {currentView === 'day' && (
          <div className="flex-1 flex flex-col overflow-x-auto">
            {/* COLUMN HEADERS (EMPLOYEES) */}
            <div className="flex border-b border-gray-300 bg-gray-100 rounded-t-lg min-w-[600px]">
              <div className="w-20 py-3 text-center text-xs font-bold text-gray-500 border-r border-gray-300">Time</div>
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${visibleMembers.length}, minmax(0, 1fr))` }}>
                {visibleMembers.map(member => (
                  <div key={member.name} className="py-3 px-2 border-r border-gray-300 last:border-r-0 flex items-center justify-center gap-2">
                    <div className={`w-7 h-7 rounded-full ${member.color} text-white flex items-center justify-center text-xs font-bold shadow-sm`}>
                      {member.initials}
                    </div>
                    <span className="font-bold text-sm text-gray-800">{member.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* FLEXIBLE ALL-DAY TASK BANNER */}
            {visibleTasks.some(t => t.type === 'flexible') && (
              <div className="bg-amber-50 border-b border-amber-200 py-2 px-4 flex items-center gap-3 min-w-[600px]">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded">All-Day Tasks:</span>
                <div className="flex flex-wrap gap-2">
                  {visibleTasks.filter(t => t.type === 'flexible' && t.status !== 'completed').map(task => {
                    const member = getMemberConfig(task.assignees[0]);
                    return (
                      <div 
                        key={task.id} 
                        onClick={() => handleOpenModal(task)}
                        className={`text-xs px-3 py-1 rounded ${member.color} text-white font-semibold cursor-pointer shadow-sm hover:opacity-90 flex items-center gap-1.5`}>
                        <span>{task.title}</span>
                        <span className="opacity-75 text-[10px]">({task.assignees.join(', ')})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* HOURLY TIME GRID */}
            <div className="flex-1 min-w-[600px] relative bg-white border-b border-l border-r border-gray-300 rounded-b-lg overflow-y-auto max-h-[600px]">
              {timeSlots.map(hour => (
                <div key={hour} className="flex h-20 border-b border-gray-200 last:border-b-0">
                  <div className="w-20 border-r border-gray-300 p-2 text-xs font-mono font-bold text-gray-400 text-right pr-3 bg-gray-50 select-none">
                    {hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
                  </div>
                  <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${visibleMembers.length}, minmax(0, 1fr))` }}>
                    {visibleMembers.map(member => (
                      <div key={member.name} className="border-r border-gray-100 last:border-r-0 h-full relative">
                        {/* Render Timed Tasks in exact hour slot */}
                        {visibleTasks
                          .filter(t => t.type === 'timed' && t.status !== 'completed' && t.assignees.includes(member.name) && Math.floor(t.startHour) === hour)
                          .map(task => {
                            const topOffset = (task.startHour - hour) * 80; // 80px per hour
                            const height = task.duration * 80;
                            return (
                              <div
                                key={task.id}
                                onClick={() => handleOpenModal(task)}
                                style={{ top: `${topOffset}px`, height: `${height - 4}px` }}
                                className={`absolute inset-x-1 ${member.color} text-white rounded-md p-2.5 shadow-md border-l-4 ${member.border} cursor-pointer hover:brightness-110 transition z-10 flex flex-col justify-between overflow-hidden`}>
                                <div>
                                  <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-xs leading-tight drop-shadow-sm">{task.title}</h4>
                                    <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-mono">{task.timeLabel}</span>
                                  </div>
                                  <p className="text-[11px] opacity-90 truncate mt-1">{task.desc}</p>
                                </div>
                                <div className="flex items-center justify-between text-[10px] opacity-80 pt-1 border-t border-white/20">
                                  <span>Priority: {task.priority}</span>
                                  <span>{task.requiresPhoto ? '📷 Photo' : ''} {task.requiresComment ? '💬 Note' : ''}</span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================
            VIEW 2: WEEK SCHEDULE VIEW
            ========================================= */}
        {currentView === 'week' && (
          <div className="flex-1 grid grid-cols-7 gap-2 overflow-x-auto min-w-[700px]">
            {daysOfWeek.map((day, idx) => (
              <div key={day} className="bg-white rounded-lg border border-gray-300 flex flex-col h-[550px] shadow-sm">
                <div className={`p-2 border-b border-gray-300 text-center ${idx === 5 ? 'bg-[#A9B1A6] text-white' : 'bg-gray-100 text-gray-700'}`}>
                  <span className="block text-xs font-bold uppercase">{day}</span>
                  <span className="text-sm font-serif font-bold">Sep {idx + 1}</span>
                </div>
                <div className="p-2 flex-1 flex flex-col gap-2 overflow-y-auto">
                  {visibleTasks
                    .filter(t => t.dayOfWeek === day && t.status !== 'completed')
                    .map(task => {
                      const member = getMemberConfig(task.assignees[0]);
                      return (
                        <div 
                          key={task.id} 
                          onClick={() => handleOpenModal(task)}
                          className={`${member.color} text-white p-2 rounded text-xs shadow cursor-pointer hover:opacity-90 flex flex-col gap-1`}>
                          <span className="font-bold leading-snug">{task.title}</span>
                          <span className="text-[10px] opacity-80 font-mono">{task.timeLabel}</span>
                          <span className="text-[10px] bg-black/20 px-1 rounded w-max">{task.assignees.join(', ')}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* =========================================
            VIEW 3: MONTH SCHEDULE GRID (HCP STYLE)
            ========================================= */}
        {currentView === 'month' && (
          <div className="flex-1 flex flex-col border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-300 text-center py-2 text-xs font-bold text-gray-600">
              {daysOfWeek.map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 grid-rows-5 flex-1 divide-x divide-y divide-gray-200 min-h-[500px]">
              {Array.from({ length: 35 }).map((_, i) => {
                const dayNum = i - 1; // Align Sept 1 to Tuesday
                const isCurrentMonth = dayNum >= 1 && dayNum <= 30;
                const dayTasks = isCurrentMonth ? visibleTasks.filter(t => t.dayOfMonth === dayNum && t.status !== 'completed') : [];

                return (
                  <div key={i} className={`p-1 flex flex-col ${isCurrentMonth ? 'bg-white' : 'bg-gray-50/50 text-gray-300'}`}>
                    <span className={`text-xs font-bold p-1 ${dayNum === 4 ? 'bg-[#A9B1A6] text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-gray-500'}`}>
                      {isCurrentMonth ? dayNum : ''}
                    </span>
                    <div className="flex flex-col gap-1 mt-1 overflow-y-auto max-h-20">
                      {dayTasks.map(task => {
                        const member = getMemberConfig(task.assignees[0]);
                        return (
                          <div 
                            key={task.id} 
                            onClick={() => handleOpenModal(task)}
                            className={`${member.color} text-white text-[10px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-90 shadow-2xs`}>
                            {task.title}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================
            VIEW 4: ORIGINAL LIST VIEW
            ========================================= */}
        {currentView === 'list' && (
          <div className="flex-col flex gap-6 overflow-y-auto pr-2">
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
                      <span className="font-mono text-sm font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200">{task.timeLabel}</span>
                      <div>
                        <h3 className="font-bold text-lg">{task.title}</h3>
                        <p className="text-sm text-gray-500 truncate">{task.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-100 text-red-800">{task.priority}</span>
                      <div className="flex -space-x-2">
                        {task.assignees.map((a, idx) => {
                          const m = getMemberConfig(a);
                          return (
                            <div key={idx} className={`w-8 h-8 rounded-full border-2 border-white ${m.color} flex items-center justify-center text-xs text-white shadow-sm font-bold`}>
                              {m.initials}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            VIEW 5: CREATE TASK BUILDER
            ========================================= */}
        {currentView === 'create' && (
          <div className="flex flex-col h-full animate-fade-in">
            <div className="flex justify-between items-center mb-6 border-b border-gray-300 pb-4">
              <h1 className="text-3xl font-serif font-bold">Task Builder</h1>
              <button onClick={() => setCurrentView('day')} className="text-gray-500 hover:text-gray-800 font-semibold text-sm">✕ Cancel</button>
            </div>

            <div className="flex gap-8 h-full">
              <div className="w-1/2 flex flex-col gap-5 border-r border-gray-300 pr-8">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Task Title</label>
                  <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g., Check Water Meter" className="w-full px-4 py-2 rounded border border-gray-300" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                  <textarea rows={4} value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Add instructions..." className="w-full px-4 py-2 rounded border border-gray-300"></textarea>
                </div>
                <div className="flex gap-4">
                  <div className="w-1/2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Assignees</label>
                    <select value="" onChange={(e) => { if (e.target.value) handleAddAssignee(e.target.value); }} className="w-full px-4 py-2 rounded border border-gray-300 bg-white mb-2 text-sm">
                      <option value="">Select team member...</option>
                      {teamMembers.filter(m => !selectedAssignees.includes(m.name)).map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                    </select>
                    <div className="flex flex-wrap gap-2">
                      {selectedAssignees.map(name => (
                        <span key={name} className="bg-gray-200 text-xs px-2 py-1 rounded flex items-center gap-1 shadow-sm font-bold">
                          {name} <button onClick={() => handleRemoveAssignee(name)} className="text-red-600 ml-1">✕</button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="w-1/2 flex flex-col gap-2">
                    <label className="block text-sm font-bold text-gray-700">Deadline Settings</label>
                    <input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} className="w-full px-3 py-1.5 rounded border border-gray-300 bg-white text-sm" />
                    <div className="flex items-center gap-2 mt-1">
                      <input type="checkbox" id="timeToggle" checked={hasSpecificTime} onChange={(e) => setHasSpecificTime(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4 cursor-pointer" />
                      <label htmlFor="timeToggle" className="text-xs text-gray-600 cursor-pointer">Set time slot on grid</label>
                    </div>
                    {hasSpecificTime && (
                      <div className="flex gap-2">
                        <select value={taskStartHour} onChange={(e) => setTaskStartHour(Number(e.target.value))} className="w-1/2 p-1 border rounded text-xs">
                          <option value={8}>8:00 AM</option>
                          <option value={9}>9:00 AM</option>
                          <option value={10}>10:00 AM</option>
                          <option value={11}>11:00 AM</option>
                          <option value={13}>1:00 PM</option>
                          <option value={14}>2:00 PM</option>
                        </select>
                        <select value={taskDuration} onChange={(e) => setTaskDuration(Number(e.target.value))} className="w-1/2 p-1 border rounded text-xs">
                          <option value={1}>1 Hour</option>
                          <option value={1.5}>1.5 Hours</option>
                          <option value={2}>2 Hours</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-1/2 flex flex-col gap-4 overflow-y-auto pb-4">
                <h3 className="font-bold text-gray-500 uppercase tracking-wider text-xs mb-1">Modular Logic Settings</h3>
                <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-sm mb-2">Proof of Work Controls</h4>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={requiresPhoto} onChange={(e) => setRequiresPhoto(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Require photo upload
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={requiresComment} onChange={(e) => setRequiresComment(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Require execution notes
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-gray-300 flex justify-end">
              <button onClick={handleDeployTask} className="bg-[#333333] text-white px-8 py-3 rounded font-bold shadow-sm hover:bg-black transition">Deploy Task</button>
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
                    {selectedTask.status === 'completed' ? 'Completed Review' : (userRole === 'admin' ? 'Admin Inspector Mode' : 'Assignee Execution View')}
                  </span>
                  <h2 className="text-2xl font-serif font-bold">{selectedTask.title}</h2>
                </div>
                <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
              </div>

              <p className="text-sm text-gray-600 bg-white p-3 rounded border border-gray-200">{selectedTask.desc}</p>

              <div className="flex justify-between text-xs text-gray-500 bg-gray-100 p-2 rounded">
                <span>Assignees: <strong>{selectedTask.assignees.join(', ')}</strong></span>
                <span>Time: <strong>{selectedTask.timeLabel}</strong></span>
              </div>

              {selectedTask.status !== 'completed' && (
                <div className="flex flex-col gap-3 my-1">
                  {selectedTask.requiresPhoto && (
                    <div className="bg-white p-3 rounded border border-amber-300 flex justify-between items-center">
                      <span className="text-xs font-semibold text-amber-800">📷 {photoUploaded ? 'Photo Attached!' : 'Photo Required'}</span>
                      <button onClick={() => setPhotoUploaded(!photoUploaded)} className="text-xs font-bold px-3 py-1 rounded bg-amber-100 text-amber-800">
                        {photoUploaded ? '✓ Attached' : 'Upload Photo'}
                      </button>
                    </div>
                  )}
                  {selectedTask.requiresComment && (
                    <div className="bg-white p-3 rounded border border-blue-300 flex flex-col gap-2">
                      <span className="text-xs font-semibold text-blue-800">💬 Execution notes required</span>
                      <textarea rows={2} value={executionComment} onChange={(e) => setExecutionComment(e.target.value)} placeholder="Type notes..." className="w-full p-2 text-xs border rounded"></textarea>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-gray-300 mt-2">
                <div className="flex gap-2 ml-auto">
                  {selectedTask.status !== 'completed' && (
                    <button onClick={() => handleCompleteTask(selectedTask.id)} className="bg-[#A9B1A6] text-white px-5 py-2 rounded text-xs font-bold shadow-sm hover:bg-gray-600 transition">
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