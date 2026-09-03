import { useState } from 'react';

export default function App() {
  const [currentView, setCurrentView] = useState('month');
  const [userRole, setUserRole] = useState('admin');
  
  // Modal & Specific Instance Context
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedInstanceDate, setSelectedInstanceDate] = useState('2026-09-04');
  const [isEditing, setIsEditing] = useState(false);

  // ADMIN TEAM MEMBER FILTER STATE
  const [activeEmployeeFilters, setActiveEmployeeFilters] = useState(['Alex M.', 'Adrian R.', 'Marc S.']);

  // Form State for Task Builder & Modal Editor
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskDate, setTaskDate] = useState('2026-09-04');
  const [hasSpecificTime, setHasSpecificTime] = useState(true);
  const [startTime, setStartTime] = useState('13:00');
  const [endTime, setEndTime] = useState('14:00');

  // Recurrence Engine States
  const [recurrenceType, setRecurrenceType] = useState('fixed');
  const [activeDays, setActiveDays] = useState(['Fri']);
  const [generationTime, setGenerationTime] = useState('13:00');
  const [cadenceDays, setCadenceDays] = useState(14);

  // Task Chaining States
  const [enableChaining, setEnableChaining] = useState(false);
  const [chainTaskTitle, setChainTaskTitle] = useState('');

  // Proof of Work Controls
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [requiresComment, setRequiresComment] = useState(false);

  // Admin Notification Settings
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);
  const [notifyOnComment, setNotifyOnComment] = useState(false);
  
  // Execution & Audit State inside Modal
  const [executionComment, setExecutionComment] = useState('');
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [additionalNote, setAdditionalNote] = useState('');

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const timeSlots = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  
  // Team Member Configurations
  const teamMembers = [
    { name: 'Alex M.', initials: 'AM', color: 'bg-[#E63946]', border: 'border-red-600', badge: 'bg-red-100 text-red-800' },
    { name: 'Adrian R.', initials: 'AR', color: 'bg-[#7209B7]', border: 'border-purple-600', badge: 'bg-purple-100 text-purple-800' },
    { name: 'Marc S.', initials: 'MS', color: 'bg-[#0077B6]', border: 'border-blue-600', badge: 'bg-blue-100 text-blue-800' }
  ];

  // Helper Conversions
  const timeToDecimal = (timeStr) => {
    if (!timeStr) return 9;
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };

  const formatTimeLabel = (startStr, endStr) => {
    if (!startStr || !endStr) return 'All-Day';
    const formatSingle = (t) => {
      const [h, m] = t.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12 < 10 ? '0' + h12 : h12}:${m < 10 ? '0' + m : m} ${ampm}`;
    };
    return `${formatSingle(startStr)} - ${formatSingle(endStr)}`;
  };

  const getFullDateString = (dayOfMonthNum) => {
    const formattedNum = dayOfMonthNum < 10 ? `0${dayOfMonthNum}` : `${dayOfMonthNum}`;
    return `2026-09-${formattedNum}`;
  };

  // Default In-Memory Tasks
  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: 'Grab the Mail',
      desc: 'Pick up daily mail package from the main office box.',
      assignees: ['Adrian R.'],
      date: '2026-09-04',
      dayOfWeek: 'Fri',
      startTime: '13:00',
      endTime: '14:00',
      startHour: 13,
      duration: 1,
      timeLabel: '01:00 PM - 02:00 PM',
      priority: 'Routine',
      requiresPhoto: false,
      requiresComment: false,
      recurrenceType: 'fixed',
      activeDays: ['Fri'],
      completedDates: [], // Array of completed instance dates (e.g. ['2026-09-04'])
      chaining: false,
      chainTitle: '',
      type: 'timed',
      status: 'pending',
      comments: []
    },
    {
      id: 2,
      title: 'Meeting with Matt',
      desc: 'Q3 strategy alignment and operations review.',
      assignees: ['Alex M.'],
      date: '2026-09-04',
      dayOfWeek: 'Fri',
      startTime: '09:00',
      endTime: '11:00',
      startHour: 9,
      duration: 2,
      timeLabel: '09:00 AM - 11:00 AM',
      priority: 'High',
      requiresPhoto: false,
      requiresComment: true,
      recurrenceType: 'once',
      activeDays: [],
      completedDates: [],
      chaining: false,
      chainTitle: '',
      type: 'timed',
      status: 'pending',
      comments: ['Admin created task.']
    },
    {
      id: 3,
      title: 'Wash Laundry & Linens',
      desc: 'Complete routine wash for main guest quarters.',
      assignees: ['Marc S.'],
      date: '2026-09-04',
      dayOfWeek: 'Fri',
      startTime: null,
      endTime: null,
      startHour: null,
      duration: null,
      timeLabel: 'All-Day',
      priority: 'Routine',
      requiresPhoto: true,
      requiresComment: false,
      recurrenceType: 'once',
      activeDays: [],
      completedDates: [],
      chaining: false,
      chainTitle: '',
      type: 'flexible',
      status: 'pending',
      comments: []
    }
  ]);

  const resetForm = () => {
    setTaskTitle('');
    setTaskDesc('');
    setSelectedAssignees([]);
    setTaskPriority('Medium');
    setTaskDate('2026-09-04');
    setHasSpecificTime(true);
    setStartTime('09:00');
    setEndTime('11:00');
    setRecurrenceType('once');
    setActiveDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setGenerationTime('13:00');
    setCadenceDays(14);
    setEnableChaining(false);
    setChainTaskTitle('');
    setRequiresPhoto(false);
    setRequiresComment(false);
    setNotifyOnComplete(true);
    setNotifyOnComment(false);
  };

  const toggleEmployeeFilter = (memberName) => {
    if (activeEmployeeFilters.includes(memberName)) {
      if (activeEmployeeFilters.length === 1) return;
      setActiveEmployeeFilters(activeEmployeeFilters.filter(m => m !== memberName));
    } else {
      setActiveEmployeeFilters([...activeEmployeeFilters, memberName]);
    }
  };

  const toggleDay = (day) => {
    setActiveDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
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

    const startDec = timeToDecimal(startTime);
    const endDec = timeToDecimal(endTime);
    const dur = Math.max(0.5, endDec - startDec);

    const newTask = {
      id: Date.now(),
      title: taskTitle,
      desc: taskDesc,
      assignees: selectedAssignees.length > 0 ? selectedAssignees : ['Alex M.'],
      date: taskDate,
      dayOfWeek: 'Fri',
      startTime: hasSpecificTime ? startTime : null,
      endTime: hasSpecificTime ? endTime : null,
      startHour: hasSpecificTime ? startDec : null,
      duration: hasSpecificTime ? dur : null,
      timeLabel: hasSpecificTime ? formatTimeLabel(startTime, endTime) : 'All-Day',
      priority: taskPriority,
      requiresPhoto,
      requiresComment,
      recurrenceType,
      activeDays: recurrenceType === 'fixed' ? activeDays : [],
      completedDates: [],
      chaining: enableChaining,
      chainTitle: chainTaskTitle,
      type: hasSpecificTime ? 'timed' : 'flexible',
      status: 'pending',
      comments: []
    };

    setTasks([newTask, ...tasks]);
    resetForm();
    setCurrentView('month');
  };

  const handleOpenModal = (task, instanceDateStr = '2026-09-04') => {
    setSelectedTask(task);
    setSelectedInstanceDate(instanceDateStr);
    setIsEditing(false);
    setExecutionComment('');
    setPhotoUploaded(false);
    setAdditionalNote('');

    setTaskTitle(task.title);
    setTaskDesc(task.desc);
    setSelectedAssignees(task.assignees);
    setTaskPriority(task.priority);
    setTaskDate(task.date || '2026-09-04');
    setHasSpecificTime(task.type === 'timed');
    setStartTime(task.startTime || '09:00');
    setEndTime(task.endTime || '11:00');
    setRecurrenceType(task.recurrenceType || 'once');
    setActiveDays(task.activeDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setRequiresPhoto(task.requiresPhoto || false);
    setRequiresComment(task.requiresComment || false);
    setEnableChaining(task.chaining || false);
    setChainTaskTitle(task.chainTitle || '');
  };

  const handleSaveChanges = () => {
    if (!taskTitle.trim()) return alert('Title cannot be empty.');

    const startDec = timeToDecimal(startTime);
    const endDec = timeToDecimal(endTime);
    const dur = Math.max(0.5, endDec - startDec);

    const updatedTask = {
      ...selectedTask,
      title: taskTitle,
      desc: taskDesc,
      assignees: selectedAssignees.length > 0 ? selectedAssignees : ['Alex M.'],
      priority: taskPriority,
      date: taskDate,
      type: hasSpecificTime ? 'timed' : 'flexible',
      startTime: hasSpecificTime ? startTime : null,
      endTime: hasSpecificTime ? endTime : null,
      startHour: hasSpecificTime ? startDec : null,
      duration: hasSpecificTime ? dur : null,
      timeLabel: hasSpecificTime ? formatTimeLabel(startTime, endTime) : 'All-Day',
      recurrenceType,
      activeDays: recurrenceType === 'fixed' ? activeDays : [],
      requiresPhoto,
      requiresComment,
      chaining: enableChaining,
      chainTitle: chainTaskTitle
    };

    setTasks(tasks.map(t => t.id === selectedTask.id ? updatedTask : t));
    setSelectedTask(updatedTask);
    setIsEditing(false);
  };

  const handleDeleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
    setSelectedTask(null);
  };

  // SMART COMPLETION: Logs completion stamp for specific date without breaking recurring rule
  const handleCompleteTask = (id) => {
    if (selectedTask.requiresPhoto && !photoUploaded) return alert('Photo upload required.');
    if (selectedTask.requiresComment && !executionComment.trim()) return alert('Execution notes required.');

    let updatedTasks = tasks.map(t => {
      if (t.id === id) {
        const newComments = executionComment.trim() 
          ? [...t.comments, `${userRole === 'admin' ? 'Admin' : 'Assignee'} (${selectedInstanceDate}): ${executionComment}`] 
          : t.comments;

        if (t.recurrenceType === 'once') {
          return { ...t, status: 'completed', comments: newComments };
        } else {
          // For recurring tasks, stamp completion ONLY for this specific date
          const updatedCompletedDates = [...(t.completedDates || []), selectedInstanceDate];
          return { ...t, completedDates: updatedCompletedDates, comments: newComments };
        }
      }
      return t;
    });

    if (selectedTask.chaining && selectedTask.chainTitle.trim()) {
      const chainedTask = {
        id: Date.now() + 1,
        title: selectedTask.chainTitle,
        desc: `Follow-up task chained from completed task: "${selectedTask.title}"`,
        assignees: selectedTask.assignees,
        date: selectedInstanceDate,
        dayOfWeek: 'Fri',
        startTime: null,
        endTime: null,
        startHour: null,
        duration: null,
        timeLabel: 'All-Day',
        priority: 'Medium',
        requiresPhoto: false,
        requiresComment: false,
        recurrenceType: 'once',
        activeDays: [],
        completedDates: [],
        chaining: false,
        chainTitle: '',
        type: 'flexible',
        status: 'pending',
        comments: ['Auto-generated via Task Chaining rule.']
      };
      updatedTasks = [chainedTask, ...updatedTasks];
      alert(`Occurrence for ${selectedInstanceDate} completed! Chained task "${selectedTask.chainTitle}" deployed.`);
    }

    setTasks(updatedTasks);
    setSelectedTask(null);
  };

  const handleAppendNote = (id) => {
    if (!additionalNote.trim()) return;
    setTasks(tasks.map(t => {
      if (t.id === id) {
        return {
          ...t,
          comments: [...t.comments, `${userRole === 'admin' ? 'Admin Note' : 'Assignee Note'}: ${additionalNote}`]
        };
      }
      return t;
    }));
    setAdditionalNote('');
    setSelectedTask(prev => ({
      ...prev,
      comments: [...prev.comments, `${userRole === 'admin' ? 'Admin Note' : 'Assignee Note'}: ${additionalNote}`]
    }));
  };

  const handleReopenTask = (id) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        if (t.recurrenceType === 'once') {
          return { ...t, status: 'pending' };
        } else {
          return { ...t, completedDates: t.completedDates.filter(d => d !== selectedInstanceDate) };
        }
      }
      return t;
    }));
    setSelectedTask(null);
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'High': return { border: 'border-red-500', badge: 'bg-red-100 text-red-800' };
      case 'Medium': return { border: 'border-amber-400', badge: 'bg-amber-100 text-amber-800' };
      case 'Low': return { border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-800' };
      default: return { border: 'border-[#A9B1A6]', badge: 'bg-gray-100 text-gray-700' };
    }
  };

  const visibleMembers = userRole === 'admin' 
    ? teamMembers.filter(m => activeEmployeeFilters.includes(m.name))
    : teamMembers.filter(m => m.name === 'Adrian R.');

  const visibleTasks = tasks.filter(t => {
    return userRole === 'admin' 
      ? t.assignees.some(a => activeEmployeeFilters.includes(a))
      : t.assignees.includes('Adrian R.');
  });

  // HELPER: Matches active occurrence for a specific date
  const isTaskActiveOnDay = (task, dayOfWeekStr, dateStr) => {
    // If it's already completed for this specific date, don't show as pending
    if (task.completedDates && task.completedDates.includes(dateStr)) return false;
    if (task.status === 'completed') return false;

    if (task.recurrenceType === 'fixed') {
      return task.activeDays.includes(dayOfWeekStr);
    }
    return task.date === dateStr;
  };

  // HELPER: Checks if task instance was completed on a specific date
  const isTaskCompletedOnDay = (task, dateStr) => {
    if (task.status === 'completed' && task.date === dateStr) return true;
    return task.completedDates && task.completedDates.includes(dateStr);
  };

  const isCurrentInstanceCompleted = selectedTask && (
    selectedTask.status === 'completed' || 
    (selectedTask.completedDates && selectedTask.completedDates.includes(selectedInstanceDate))
  );

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
              Admin View
            </button>
            <button 
              onClick={() => setUserRole('assignee')}
              className={`px-3 py-1 rounded font-bold transition ${userRole === 'assignee' ? 'bg-[#A9B1A6] text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              Assignee View (Adrian R.)
            </button>
          </div>
          <span className="text-gray-400 italic">
            {userRole === 'admin' ? 'Master Operations View' : 'Personal Assigned Tasks'}
          </span>
        </div>

        {/* TOP HEADER & NAVIGATION */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-gray-300 pb-4">
          <div>
            <h1 className="text-3xl font-serif font-bold">Command Center</h1>
            <p className="text-xs text-gray-500 mt-0.5">September 2026</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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

        {/* ADMIN TEAM MEMBER FILTER BAR */}
        {userRole === 'admin' && currentView !== 'create' && (
          <div className="bg-white p-2.5 rounded-lg border border-gray-200 mb-4 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Filter Visible Team:</span>
              <div className="flex gap-1.5">
                {teamMembers.map(m => {
                  const isActive = activeEmployeeFilters.includes(m.name);
                  return (
                    <button
                      key={m.name}
                      onClick={() => toggleEmployeeFilter(m.name)}
                      className={`text-xs px-2.5 py-1 rounded-full font-bold border transition flex items-center gap-1.5 ${
                        isActive 
                          ? `${m.badge} ${m.border}` 
                          : 'bg-gray-100 text-gray-400 border-gray-200 line-through'
                      }`}>
                      <span className={`w-2 h-2 rounded-full ${isActive ? m.color : 'bg-gray-300'}`}></span>
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <button 
              onClick={() => setActiveEmployeeFilters(teamMembers.map(m => m.name))}
              className="text-[11px] font-bold text-[#A9B1A6] hover:underline">
              Show All Team Members
            </button>
          </div>
        )}

        {/* =========================================
            VIEW 1: MONTH SCHEDULE GRID
            ========================================= */}
        {currentView === 'month' && (
          <div className="flex-1 flex flex-col border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-300 text-center py-2 text-xs font-bold text-gray-600">
              {daysOfWeek.map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 grid-rows-5 flex-1 divide-x divide-y divide-gray-200 min-h-[550px]">
              {Array.from({ length: 35 }).map((_, i) => {
                const dayNum = i - 1; // Align Sept 1 to Tuesday
                const isCurrentMonth = dayNum >= 1 && dayNum <= 30;
                const dayOfWeekStr = daysOfWeek[i % 7];
                const dateStr = getFullDateString(dayNum);

                // Find active pending tasks for this day
                const pendingDayTasks = isCurrentMonth 
                  ? visibleTasks.filter(t => isTaskActiveOnDay(t, dayOfWeekStr, dateStr))
                  : [];

                // Find completed tasks for this specific day
                const completedDayTasks = isCurrentMonth
                  ? visibleTasks.filter(t => isTaskCompletedOnDay(t, dateStr))
                  : [];

                return (
                  <div key={i} className={`p-1.5 flex flex-col ${isCurrentMonth ? 'bg-white' : 'bg-gray-50/50 text-gray-300'}`}>
                    <span className={`text-xs font-bold p-1 ${dayNum === 4 ? 'bg-[#A9B1A6] text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-gray-500'}`}>
                      {isCurrentMonth ? dayNum : ''}
                    </span>
                    <div className="flex flex-col gap-1 mt-1 overflow-y-auto max-h-24">
                      {/* Active Tasks */}
                      {pendingDayTasks.map(task => {
                        const member = getMemberConfig(task.assignees[0]);
                        return (
                          <div 
                            key={`${task.id}-${i}`} 
                            onClick={() => handleOpenModal(task, dateStr)}
                            className={`${member.color} text-white text-[10px] font-semibold p-1 rounded truncate cursor-pointer hover:opacity-90 shadow-2xs flex items-center justify-between`}>
                            <span className="truncate">{task.title}</span>
                            {task.recurrenceType === 'fixed' && <span className="text-[8px] bg-black/20 px-1 rounded ml-1 font-mono">↻</span>}
                          </div>
                        );
                      })}

                      {/* Completed Tasks on this date */}
                      {completedDayTasks.map(task => (
                        <div 
                          key={`completed-${task.id}-${i}`}
                          onClick={() => handleOpenModal(task, dateStr)}
                          className="bg-gray-200 text-gray-500 line-through text-[10px] font-semibold p-1 rounded truncate cursor-pointer opacity-75 flex items-center justify-between">
                          <span className="truncate">✓ {task.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================
            VIEW 2: DAY SCHEDULE GRID
            ========================================= */}
        {currentView === 'day' && (
          <div className="flex-1 flex flex-col overflow-x-auto">
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

            {visibleTasks.some(t => t.type === 'flexible') && (
              <div className="bg-amber-50 border-b border-amber-200 py-2 px-4 flex items-center gap-3 min-w-[600px]">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded">All-Day Flexible Tasks:</span>
                <div className="flex flex-wrap gap-2">
                  {visibleTasks.filter(t => t.type === 'flexible' && !isTaskCompletedOnDay(t, '2026-09-04')).map(task => {
                    const member = getMemberConfig(task.assignees[0]);
                    return (
                      <div 
                        key={task.id} 
                        onClick={() => handleOpenModal(task, '2026-09-04')}
                        className={`text-xs px-3 py-1 rounded ${member.color} text-white font-semibold cursor-pointer shadow-sm hover:opacity-90 flex items-center gap-1.5`}>
                        <span>{task.title}</span>
                        <span className="opacity-75 text-[10px]">({task.assignees.join(', ')})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex-1 min-w-[600px] relative bg-white border-b border-l border-r border-gray-300 rounded-b-lg overflow-y-auto max-h-[580px]">
              {timeSlots.map(hour => (
                <div key={hour} className="flex h-20 border-b border-gray-200 last:border-b-0">
                  <div className="w-20 border-r border-gray-300 p-2 text-xs font-mono font-bold text-gray-400 text-right pr-3 bg-gray-50 select-none">
                    {hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
                  </div>
                  <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${visibleMembers.length}, minmax(0, 1fr))` }}>
                    {visibleMembers.map(member => (
                      <div key={member.name} className="border-r border-gray-100 last:border-r-0 h-full relative">
                        {visibleTasks
                          .filter(t => t.type === 'timed' && isTaskActiveOnDay(t, 'Fri', '2026-09-04') && t.assignees.includes(member.name) && Math.floor(t.startHour) === hour)
                          .map(task => {
                            const topOffset = (task.startHour - hour) * 80;
                            const height = task.duration * 80;
                            return (
                              <div
                                key={task.id}
                                onClick={() => handleOpenModal(task, '2026-09-04')}
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
                                  <span>{task.recurrenceType === 'fixed' ? '↻ Recurring' : ''}</span>
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
            VIEW 3: WEEK VIEW
            ========================================= */}
        {currentView === 'week' && (
          <div className="flex-1 grid grid-cols-7 gap-2 overflow-x-auto min-w-[700px]">
            {daysOfWeek.map((day, idx) => {
              const dateStr = getFullDateString(idx + 1);
              return (
                <div key={day} className="bg-white rounded-lg border border-gray-300 flex flex-col h-[550px] shadow-sm">
                  <div className={`p-2 border-b border-gray-300 text-center ${idx === 3 ? 'bg-[#A9B1A6] text-white' : 'bg-gray-100 text-gray-700'}`}>
                    <span className="block text-xs font-bold uppercase">{day}</span>
                    <span className="text-sm font-serif font-bold">Sep {idx + 1}</span>
                  </div>
                  <div className="p-2 flex-1 flex flex-col gap-2 overflow-y-auto">
                    {visibleTasks
                      .filter(t => isTaskActiveOnDay(t, day, dateStr))
                      .map(task => {
                        const member = getMemberConfig(task.assignees[0]);
                        return (
                          <div 
                            key={`${task.id}-${day}`} 
                            onClick={() => handleOpenModal(task, dateStr)}
                            className={`${member.color} text-white p-2 rounded text-xs shadow cursor-pointer hover:opacity-90 flex flex-col gap-1`}>
                            <span className="font-bold leading-snug">{task.title}</span>
                            <span className="text-[10px] opacity-80 font-mono">{task.timeLabel}</span>
                            <span className="text-[10px] bg-black/20 px-1 rounded w-max">{task.assignees.join(', ')}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* =========================================
            VIEW 4: LIST VIEW
            ========================================= */}
        {currentView === 'list' && (
          <div className="flex-col flex gap-6 overflow-y-auto pr-2">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Active Scheduled Tasks</h2>
              </div>
              <div className="flex flex-col gap-3">
                {visibleTasks.filter(t => t.status !== 'completed').map(task => {
                  const style = getPriorityStyle(task.priority);
                  return (
                    <div 
                      key={task.id}
                      onClick={() => handleOpenModal(task, task.date || '2026-09-04')}
                      className={`bg-white p-4 rounded border-l-4 ${style.border} shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50 transition`}>
                      <div className="w-1/2 flex items-center gap-4">
                        <span className="font-mono text-sm font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200">{task.timeLabel}</span>
                        <div>
                          <h3 className="font-bold text-lg">{task.title}</h3>
                          <p className="text-sm text-gray-500 truncate">{task.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${style.badge}`}>{task.priority}</span>
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
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            VIEW 5: TASK BUILDER
            ========================================= */}
        {currentView === 'create' && (
          <div className="flex flex-col h-full animate-fade-in">
            <div className="flex justify-between items-center mb-6 border-b border-gray-300 pb-4">
              <h1 className="text-3xl font-serif font-bold">Task Builder</h1>
              <button onClick={() => setCurrentView('month')} className="text-gray-500 hover:text-gray-800 font-semibold text-sm">✕ Cancel</button>
            </div>

            <div className="flex gap-8 h-full">
              <div className="w-1/2 flex flex-col gap-5 border-r border-gray-300 pr-8">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Task Title</label>
                  <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g., Grab the Mail" className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#A9B1A6]" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                  <textarea rows={3} value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Add instructions for this task..." className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#A9B1A6]"></textarea>
                </div>

                <div className="flex gap-4">
                  <div className="w-1/2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Assignees</label>
                    <select value="" onChange={(e) => { if (e.target.value) handleAddAssignee(e.target.value); }} className="w-full px-4 py-2 rounded border border-gray-300 bg-white mb-2 text-sm focus:outline-none">
                      <option value="">{teamMembers.filter(m => !selectedAssignees.includes(m.name)).length > 0 ? 'Select team member...' : 'All members assigned'}</option>
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
                      <label htmlFor="timeToggle" className="text-xs text-gray-600 cursor-pointer select-none">Set start & stop time</label>
                    </div>

                    {hasSpecificTime && (
                      <div className="flex gap-2 items-center">
                        <div className="w-1/2">
                          <span className="text-[10px] text-gray-500 block font-bold">Start:</span>
                          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full p-1.5 border rounded text-xs bg-white focus:outline-none" />
                        </div>
                        <div className="w-1/2">
                          <span className="text-[10px] text-gray-500 block font-bold">Stop:</span>
                          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full p-1.5 border rounded text-xs bg-white focus:outline-none" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Priority Level</label>
                  <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className="w-full px-4 py-2 rounded border border-gray-300 bg-white text-sm">
                    <option value="High">High (Red)</option>
                    <option value="Medium">Medium (Orange)</option>
                    <option value="Low">Low (Green)</option>
                    <option value="Routine">Routine (Gray)</option>
                  </select>
                </div>
              </div>

              <div className="w-1/2 flex flex-col gap-4 overflow-y-auto pb-4">
                <h3 className="font-bold text-gray-500 uppercase tracking-wider text-xs mb-1">Modular Logic Settings</h3>
                
                {/* RECURRENCE ENGINE */}
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
                        <span className="block text-xs font-semibold text-gray-600 mb-2">Active Days of the Week:</span>
                        <div className="flex gap-1">
                          {daysOfWeek.map(day => (
                            <button 
                              key={day}
                              type="button"
                              onClick={() => toggleDay(day)}
                              className={`flex-1 py-1 text-xs font-bold rounded border ${activeDays.includes(day) ? 'bg-[#A9B1A6] text-white border-[#A9B1A6]' : 'bg-white text-gray-500 border-gray-300'}`}>
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-600">Generation Time:</span>
                        <input type="time" value={generationTime} onChange={(e) => setGenerationTime(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm w-32 focus:outline-none" />
                      </div>
                    </div>
                  )}

                  {recurrenceType === 'completion' && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <span className="text-sm text-gray-600">Re-deploy task</span>
                      <input type="number" value={cadenceDays} onChange={(e) => setCadenceDays(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-sm w-16 text-center font-bold" />
                      <span className="text-sm text-gray-600">days after completion</span>
                    </div>
                  )}
                </div>

                {/* TASK CHAINING */}
                <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-sm mb-2">Task Chaining Engine</h4>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-2">
                    <input type="checkbox" checked={enableChaining} onChange={(e) => setEnableChaining(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" />
                    Auto-generate follow-up task on completion
                  </label>
                  {enableChaining && (
                    <input 
                      type="text" 
                      value={chainTaskTitle}
                      onChange={(e) => setChainTaskTitle(e.target.value)}
                      placeholder="Follow-up task title (e.g., Send Invoice)" 
                      className="w-full p-2 text-xs border border-gray-300 rounded mt-1 focus:outline-none focus:ring-1 focus:ring-[#A9B1A6]" />
                  )}
                </div>

                {/* PROOF OF WORK */}
                <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-sm mb-2">Proof of Work Controls</h4>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={requiresPhoto} onChange={(e) => setRequiresPhoto(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Require photo upload to complete
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={requiresComment} onChange={(e) => setRequiresComment(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Require execution notes/comment to complete
                    </label>
                  </div>
                </div>

                {/* ADMIN NOTIFICATION RULES */}
                <div className="bg-[#A9B1A6]/10 p-4 rounded border border-[#A9B1A6]/30">
                  <h4 className="font-bold text-sm mb-2 text-gray-800">Admin Notification Rules</h4>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={notifyOnComplete} onChange={(e) => setNotifyOnComplete(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" />
                      Notify me when task is completed
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={notifyOnComment} onChange={(e) => setNotifyOnComment(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" />
                      Notify me on new task comments
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

        {/* TASK EXECUTION & INSPECTOR / EDITOR MODAL */}
        {selectedTask && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#F4F3ED] max-w-lg w-full rounded-lg shadow-xl p-6 border border-gray-300 flex flex-col gap-4 animate-fade-in max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b border-gray-300 pb-3">
                <div>
                  <span className="text-xs font-bold text-[#A9B1A6] uppercase tracking-wider">
                    {isCurrentInstanceCompleted ? 'Completed Occurrence Review' : (userRole === 'admin' ? (isEditing ? 'Admin Task Editor' : 'Admin Inspector Mode') : 'Assignee Execution View')}
                  </span>
                  <h2 className="text-2xl font-serif font-bold">{selectedTask.title}</h2>
                </div>
                <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
              </div>

              {!isEditing ? (
                <>
                  <p className="text-sm text-gray-600 bg-white p-3 rounded border border-gray-200">{selectedTask.desc}</p>

                  <div className="flex justify-between text-xs text-gray-500 bg-gray-100 p-2 rounded">
                    <span>Assignees: <strong>{selectedTask.assignees.join(', ')}</strong></span>
                    <span>Occurrence Date: <strong>{selectedInstanceDate}</strong></span>
                  </div>

                  {selectedTask.comments.length > 0 && (
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-2">Execution History & Notes</h4>
                      <div className="flex flex-col gap-1 max-h-28 overflow-y-auto pr-1">
                        {selectedTask.comments.map((c, i) => (
                          <div key={i} className="text-xs text-gray-700 bg-gray-50 p-1.5 rounded border border-gray-100">{c}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isCurrentInstanceCompleted && (
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

                  {isCurrentInstanceCompleted && (
                    <div className="bg-white p-3 rounded border border-green-300 flex flex-col gap-2">
                      <span className="text-xs font-semibold text-green-800">✏️ Append additional review notes</span>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={additionalNote}
                          onChange={(e) => setAdditionalNote(e.target.value)}
                          placeholder="Type follow-up details..." 
                          className="flex-1 p-2 text-xs border border-gray-200 rounded focus:outline-none" />
                        <button 
                          onClick={() => handleAppendNote(selectedTask.id)}
                          className="bg-green-700 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-800 transition">
                          Add Note
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-3 text-sm">
                  <div>
                    <label className="block font-bold text-xs mb-1 text-gray-700">Task Title</label>
                    <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="w-full p-2 border rounded text-xs bg-white" />
                  </div>
                  
                  <div>
                    <label className="block font-bold text-xs mb-1 text-gray-700">Description</label>
                    <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} className="w-full p-2 border rounded text-xs bg-white" rows={3}></textarea>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-1/2">
                      <label className="block font-bold text-xs mb-1 text-gray-700">Assignees</label>
                      <select value="" onChange={(e) => { if (e.target.value) handleAddAssignee(e.target.value); }} className="w-full p-2 border rounded text-xs bg-white mb-1">
                        <option value="">Add assignee...</option>
                        {teamMembers.filter(m => !selectedAssignees.includes(m.name)).map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                      </select>
                      <div className="flex flex-wrap gap-1">
                        {selectedAssignees.map(name => (
                          <span key={name} className="bg-gray-200 text-xs px-2 py-0.5 rounded flex items-center gap-1 font-bold">
                            {name} <button onClick={() => handleRemoveAssignee(name)} className="text-red-600">✕</button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="w-1/2">
                      <label className="block font-bold text-xs mb-1 text-gray-700">Priority</label>
                      <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className="w-full p-2 border rounded text-xs bg-white">
                        <option value="High">High (Red)</option>
                        <option value="Medium">Medium (Orange)</option>
                        <option value="Low">Low (Green)</option>
                        <option value="Routine">Routine (Gray)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2 border-t border-gray-200">
                    <div className="w-1/2">
                      <label className="block font-bold text-xs mb-1 text-gray-700">Recurrence Rule</label>
                      <select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)} className="w-full p-1.5 border rounded text-xs bg-white">
                        <option value="once">One-time Task</option>
                        <option value="fixed">Fixed Schedule</option>
                      </select>
                    </div>

                    <div className="w-1/2">
                      <div className="flex items-center gap-1 mb-1">
                        <input type="checkbox" id="modalTimeToggle" checked={hasSpecificTime} onChange={(e) => setHasSpecificTime(e.target.checked)} className="accent-[#A9B1A6]" />
                        <label htmlFor="modalTimeToggle" className="font-bold text-xs text-gray-700 cursor-pointer">Timed Slot</label>
                      </div>
                      {hasSpecificTime && (
                        <div className="flex gap-1">
                          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-1/2 p-1 border rounded text-xs bg-white" />
                          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-1/2 p-1 border rounded text-xs bg-white" />
                        </div>
                      )}
                    </div>
                  </div>

                  {recurrenceType === 'fixed' && (
                    <div className="pt-2 border-t border-gray-200">
                      <span className="block text-xs font-bold text-gray-700 mb-1">Active Days:</span>
                      <div className="flex gap-1">
                        {daysOfWeek.map(day => (
                          <button 
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            className={`flex-1 py-1 text-[10px] font-bold rounded border ${activeDays.includes(day) ? 'bg-[#A9B1A6] text-white border-[#A9B1A6]' : 'bg-white text-gray-500 border-gray-300'}`}>
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ACTION FOOTER */}
              <div className="flex justify-between items-center pt-3 border-t border-gray-300 mt-2">
                {userRole === 'admin' && !isCurrentInstanceCompleted && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsEditing(!isEditing)} 
                      className="text-xs text-blue-700 font-bold hover:underline">
                      {isEditing ? 'Cancel Edit' : 'Edit Settings'}
                    </button>
                    <button 
                      onClick={() => handleDeleteTask(selectedTask.id)} 
                      className="text-xs text-red-600 font-bold hover:underline">
                      Delete Rule
                    </button>
                  </div>
                )}

                {userRole === 'admin' && isCurrentInstanceCompleted && (
                  <button onClick={() => handleReopenTask(selectedTask.id)} className="text-xs text-amber-700 font-bold hover:underline">Reopen Occurrence</button>
                )}
                
                <div className="flex gap-2 ml-auto">
                  {isEditing ? (
                    <button 
                      onClick={handleSaveChanges}
                      className="bg-[#333333] text-white px-4 py-2 rounded text-xs font-bold hover:bg-black transition">
                      Save Changes
                    </button>
                  ) : (
                    !isCurrentInstanceCompleted && (
                      <button onClick={() => handleCompleteTask(selectedTask.id)} className="bg-[#A9B1A6] text-white px-5 py-2 rounded text-xs font-bold shadow-sm hover:bg-gray-600 transition">
                        Mark Occurrence Complete
                      </button>
                    )
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