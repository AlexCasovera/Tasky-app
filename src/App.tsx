// @ts-nocheck
import { useState, useEffect } from 'react';

export default function App() {
  const [currentView, setCurrentView] = useState('month');
  const [userRole, setUserRole] = useState('admin');
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'ALERT: "Client Follow-up" is past due!', type: 'overdue', read: false, time: '10m ago' },
    { id: 2, text: 'Marc S. completed "Wash Laundry & Linens"', type: 'completion', read: false, time: '1h ago' }
  ]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState(null);

  const [teamMembers, setTeamMembers] = useState([
    { id: '1', name: 'Alex M.', initials: 'AM', email: 'alex@company.com', password: 'password123', role: 'admin', color: '#E63946' },
    { id: '2', name: 'Adrian R.', initials: 'AR', email: 'adrian@company.com', password: 'password123', role: 'assignee', color: '#7209B7' },
    { id: '3', name: 'Marc S.', initials: 'MS', email: 'marc@company.com', password: 'password123', role: 'assignee', color: '#0077B6' }
  ]);

  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [memberRole, setMemberRole] = useState('assignee');
  const [memberColor, setMemberColor] = useState('#2A9D8F');
  const [showPassword, setShowPassword] = useState(false);

  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedInstanceDate, setSelectedInstanceDate] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const [activeEmployeeFilters, setActiveEmployeeFilters] = useState(['Alex M.', 'Adrian R.', 'Marc S.']);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskDate, setTaskDate] = useState('');
  const [hasSpecificTime, setHasSpecificTime] = useState(true);
  const [startTime, setStartTime] = useState('13:00');
  const [endTime, setEndTime] = useState('14:00');

  const [recurrenceType, setRecurrenceType] = useState('fixed');
  const [activeDays, setActiveDays] = useState(['Fri']);
  const [generationTime, setGenerationTime] = useState('13:00');
  const [cadenceDays, setCadenceDays] = useState(14);

  const [chainedSteps, setChainedSteps] = useState([]);
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [requiresComment, setRequiresComment] = useState(false);

  const [notifyOnComplete, setNotifyOnComplete] = useState(true);
  const [notifyOnComment, setNotifyOnComment] = useState(false);
  
  const [openCommentInput, setExecutionComment] = useState('');
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [additionalNote, setAdditionalNote] = useState('');

  // DRAG & DROP, HOVER GHOST & RESCHEDULE PROMPT STATE
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [hoverSlot, setHoverSlot] = useState(null);
  const [reschedulePrompt, setReschedulePrompt] = useState(null);

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const timeSlots = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const minuteSubSlots = [0, 0.25, 0.5, 0.75];

  const formatDateKey = (d) => {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const addDaysToDateStr = (dateStr, days) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + days);
    return formatDateKey(d);
  };

  const handlePrevDate = () => {
    const d = new Date(currentDate);
    if (currentView === 'day' || currentView === 'list') {
      d.setDate(d.getDate() - 1);
    } else if (currentView === 'week') {
      d.setDate(d.getDate() - 7);
    } else if (currentView === 'month') {
      d.setMonth(d.getMonth() - 1);
    }
    setCurrentDate(d);
  };

  const handleNextDate = () => {
    const d = new Date(currentDate);
    if (currentView === 'day' || currentView === 'list') {
      d.setDate(d.getDate() + 1);
    } else if (currentView === 'week') {
      d.setDate(d.getDate() + 7);
    } else if (currentView === 'month') {
      d.setMonth(d.getMonth() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getWeekStart = (d) => {
    const temp = new Date(d);
    const day = temp.getDay();
    temp.setDate(temp.getDate() - day);
    return temp;
  };

  const getHeaderTitle = () => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (currentView === 'day' || currentView === 'list') {
      return `${dayNames[currentDate.getDay()]}, ${monthNames[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
    }

    if (currentView === 'week') {
      const start = getWeekStart(currentDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${monthNames[start.getMonth()].slice(0, 3)} ${start.getDate()} - ${monthNames[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;
    }

    if (currentView === 'month') {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }

    return 'Command Center';
  };

  const timeToDecimal = (timeStr) => {
    if (!timeStr) return 9;
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };

  const decimalToTimeString = (dec) => {
    const hours = Math.floor(dec);
    const minutes = Math.round((dec - hours) * 60);
    const hStr = String(hours).padStart(2, '0');
    const mStr = String(minutes).padStart(2, '0');
    return `${hStr}:${mStr}`;
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

  // SIDE-BY-SIDE OVERLAPPING TASK LAYOUT ENGINE
  const computeColumnTaskLayouts = (colTasks) => {
    if (!colTasks || colTasks.length === 0) return {};

    const items = colTasks.map(t => {
      const isFlex = (t.type === 'flexible' || t.startHour === null || t.startHour === undefined);
      const start = isFlex ? 8.0 : Number(t.startHour || 8.0);
      const dur = isFlex ? 10.0 : Number(t.duration || 1.0);
      return {
        id: t.id,
        start,
        end: start + dur,
        isFlex,
        task: t
      };
    });

    items.sort((a, b) => {
      if (a.isFlex !== b.isFlex) return a.isFlex ? -1 : 1;
      if (a.start !== b.start) return a.start - b.start;
      return (b.end - b.start) - (a.end - a.start);
    });

    const clusters = [];
    items.forEach(item => {
      let targetCluster = null;
      for (let cluster of clusters) {
        if (cluster.some(c => Math.max(item.start, c.start) < Math.min(item.end, c.end))) {
          targetCluster = cluster;
          break;
        }
      }
      if (targetCluster) {
        targetCluster.push(item);
      } else {
        clusters.push([item]);
      }
    });

    const layouts = {};
    clusters.forEach(cluster => {
      const cols = [];
      cluster.forEach(item => {
        let placed = false;
        for (let col of cols) {
          if (col[col.length - 1].end <= item.start) {
            col.push(item);
            placed = true;
            break;
          }
        }
        if (!placed) {
          cols.push([item]);
        }
      });

      const numCols = cols.length;
      cols.forEach((col, colIdx) => {
        col.forEach(item => {
          const leftPct = (colIdx / numCols) * 100;
          const widthPct = (1.0 / numCols) * 100;
          layouts[item.id] = {
            left: `${leftPct}%`,
            width: `calc(${widthPct}% - 2px)`,
            startPx: (item.start - 8) * 80,
            heightPx: Math.max(28, (item.end - item.start) * 80 - 2),
            numCols,
            colIdx,
            isFlex: item.isFlex
          };
        });
      });
    });

    return layouts;
  };

  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: 'Grab the Mail',
      desc: 'Pick up daily mail package from the main office box.',
      assignees: ['Adrian R.'],
      date: formatDateKey(new Date()),
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
      cadenceDays: 14,
      completedDates: [],
      chainedSteps: [],
      type: 'timed',
      status: 'pending',
      comments: []
    },
    {
      id: 2,
      title: 'Client Follow-up',
      desc: 'Q3 strategy alignment and operations review.',
      assignees: ['Alex M.'],
      date: '2026-09-02',
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
      cadenceDays: 14,
      completedDates: [],
      chainedSteps: [],
      type: 'timed',
      status: 'pending',
      isOverdue: true,
      overdueNotified: true,
      comments: ['Admin created task.']
    },
    {
      id: 3,
      title: 'Service Espresso Machine',
      desc: 'Run deep descaling cycle and replace water filter.',
      assignees: ['Marc S.'],
      date: formatDateKey(new Date()),
      startTime: '10:00',
      endTime: '11:30',
      startHour: 10,
      duration: 1.5,
      timeLabel: '10:00 AM - 11:30 AM',
      priority: 'Medium',
      requiresPhoto: true,
      requiresComment: true,
      recurrenceType: 'completion',
      activeDays: [],
      cadenceDays: 14,
      completedDates: [],
      chainedSteps: [],
      type: 'timed',
      status: 'pending',
      comments: []
    },
    {
      id: 4,
      title: 'Draft Maintenance Protocol',
      desc: 'Needs specific procedure writeup before assigning team member.',
      assignees: [],
      date: formatDateKey(new Date()),
      startTime: null,
      endTime: null,
      startHour: null,
      duration: null,
      timeLabel: 'Unscheduled',
      priority: 'Low',
      requiresPhoto: false,
      requiresComment: false,
      recurrenceType: 'once',
      activeDays: [],
      cadenceDays: 14,
      completedDates: [],
      chainedSteps: [],
      type: 'flexible',
      status: 'pending',
      comments: []
    }
  ]);

  // AUTOMATED OVERDUE DETECTION
  useEffect(() => {
    const todayStr = formatDateKey(new Date());

    setTasks(prevTasks => {
      let changed = false;
      const updated = prevTasks.map(task => {
        const isPastDue = task.date && task.date < todayStr && task.status !== 'completed';

        if (isPastDue && !task.overdueNotified) {
          changed = true;
          const assigneeLabel = task.assignees && task.assignees.length > 0 ? task.assignees.join(', ') : 'Unassigned';
          const notifMsg = `⚠️ OVERDUE: "${task.title}" (${assigneeLabel}) was due on ${task.date}`;

          setNotifications(prev => [
            { id: Date.now() + Math.random(), text: notifMsg, type: 'overdue', read: false, time: 'Just now' },
            ...prev
          ]);

          return { ...task, isOverdue: true, overdueNotified: true };
        } else if (!isPastDue && task.isOverdue) {
          changed = true;
          return { ...task, isOverdue: false, overdueNotified: false };
        }
        return task;
      });

      return changed ? updated : prevTasks;
    });
  }, []);

  // DRAG & DROP HANDLERS
  const handleDragStart = (e, taskId) => {
    if (userRole !== 'admin') return;
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', String(taskId));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    if (userRole !== 'admin') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setHoverSlot(null);
  };

  const handleSubSlotDragOver = (e, dateStr, targetHour, memberName) => {
    if (userRole !== 'admin' || !draggedTaskId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    setHoverSlot(prev => {
      if (
        prev &&
        prev.dateStr === dateStr &&
        prev.targetHour === targetHour &&
        prev.memberName === memberName
      ) {
        return prev;
      }
      return { dateStr, targetHour, memberName };
    });
  };

  const applyTaskMove = (taskId, targetDate, targetHour, targetMemberName, updateSeries = false) => {
    const todayStr = formatDateKey(new Date());

    setTasks(prevTasks => prevTasks.map(t => {
      if (t.id === taskId) {
        if (t.recurrenceType !== 'once' && !updateSeries) {
          const dur = t.duration || 1;
          const startDec = targetHour !== null ? targetHour : (t.startHour || 9);
          const endDec = startDec + dur;
          const sStr = decimalToTimeString(startDec);
          const eStr = decimalToTimeString(endDec);

          return {
            ...t,
            id: Date.now(),
            date: targetDate,
            assignees: targetMemberName ? [targetMemberName] : (t.assignees || []),
            startHour: targetHour !== null ? startDec : t.startHour,
            duration: dur,
            startTime: targetHour !== null ? sStr : t.startTime,
            endTime: targetHour !== null ? eStr : t.endTime,
            timeLabel: targetHour !== null ? formatTimeLabel(sStr, eStr) : t.timeLabel,
            type: targetHour !== null ? 'timed' : t.type,
            recurrenceType: 'once',
            isOverdue: targetDate < todayStr,
            overdueNotified: targetDate < todayStr
          };
        }

        const dur = t.duration || 1;
        const startDec = targetHour !== null ? targetHour : (t.startHour || 9);
        const endDec = startDec + dur;
        const sStr = decimalToTimeString(startDec);
        const eStr = decimalToTimeString(endDec);

        const newIsOverdue = targetDate < todayStr && t.status !== 'completed';

        return {
          ...t,
          date: targetDate,
          assignees: targetMemberName ? [targetMemberName] : (t.assignees || []),
          startHour: targetHour !== null ? startDec : t.startHour,
          duration: targetHour !== null ? dur : t.duration,
          startTime: targetHour !== null ? sStr : t.startTime,
          endTime: targetHour !== null ? eStr : t.endTime,
          timeLabel: targetHour !== null ? formatTimeLabel(sStr, eStr) : t.timeLabel,
          type: targetHour !== null ? 'timed' : t.type,
          isOverdue: newIsOverdue,
          overdueNotified: newIsOverdue
        };
      }
      return t;
    }));

    setReschedulePrompt(null);
    setDraggedTaskId(null);
    setHoverSlot(null);
  };

  const handleDropSlot = (e, targetDate, targetHour = null, targetMemberName = null) => {
    if (userRole !== 'admin') return;
    e.preventDefault();
    const taskIdStr = e.dataTransfer.getData('text/plain') || draggedTaskId;
    const taskId = Number(taskIdStr);
    const task = tasks.find(t => t.id === taskId);

    setHoverSlot(null);

    if (!task) return;

    if (task.recurrenceType !== 'once') {
      setReschedulePrompt({ task, targetDate, targetHour, targetMemberName });
    } else {
      applyTaskMove(taskId, targetDate, targetHour, targetMemberName, false);
    }
  };

  const resetMemberForm = () => {
    setMemberName('');
    setMemberEmail('');
    setMemberPassword('');
    setMemberRole('assignee');
    setMemberColor('#2A9D8F');
    setEditingMemberId(null);
    setShowPassword(false);
  };

  const handleOpenEditMember = (member) => {
    setEditingMemberId(member.id);
    setMemberName(member.name);
    setMemberEmail(member.email);
    setMemberPassword(member.password);
    setMemberRole(member.role);
    setMemberColor(member.color || '#2A9D8F');
  };

  const handleSaveMember = () => {
    if (!memberName.trim()) return alert('Please enter a name.');

    const initials = memberName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    if (editingMemberId) {
      setTeamMembers(teamMembers.map(m => {
        if (m.id === editingMemberId) {
          return {
            ...m,
            name: memberName,
            initials,
            email: memberEmail,
            password: memberPassword,
            role: memberRole,
            color: memberColor
          };
        }
        return m;
      }));
    } else {
      const newMember = {
        id: Date.now().toString(),
        name: memberName,
        initials,
        email: memberEmail,
        password: memberPassword,
        role: memberRole,
        color: memberColor
      };
      setTeamMembers([...teamMembers, newMember]);
      setActiveEmployeeFilters([...activeEmployeeFilters, memberName]);
    }

    resetMemberForm();
  };

  const handleDeleteMember = (id, name) => {
    if (teamMembers.length <= 1) return alert('At least one team member must remain.');
    setTeamMembers(teamMembers.filter(m => m.id !== id));
    setActiveEmployeeFilters(activeEmployeeFilters.filter(n => n !== name));
    resetMemberForm();
  };

  const resetForm = () => {
    setTaskTitle('');
    setTaskDesc('');
    setSelectedAssignees([]);
    setTaskPriority('Medium');
    setTaskDate(formatDateKey(currentDate));
    setHasSpecificTime(true);
    setStartTime('09:00');
    setEndTime('11:00');
    setRecurrenceType('once');
    setActiveDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setGenerationTime('13:00');
    setCadenceDays(14);
    setChainedSteps([]);
    setRequiresPhoto(false);
    setRequiresComment(false);
    setNotifyOnComplete(true);
    setNotifyOnComment(false);
  };

  const handleAddChainedStep = () => {
    setChainedSteps([...chainedSteps, {
      title: '',
      desc: '',
      relativeDays: 1,
      assignee: 'Same as Parent',
      priority: 'Medium',
      requiresPhoto: false,
      requiresComment: false
    }]);
  };

  const handleUpdateChainedStep = (index, field, value) => {
    setChainedSteps(chainedSteps.map((step, i) => i === index ? { ...step, [field]: value } : step));
  };

  const handleRemoveChainedStep = (index) => {
    setChainedSteps(chainedSteps.filter((_, i) => i !== index));
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
    setActiveDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const getMemberConfig = (name) => {
    const found = teamMembers.find(m => m.name === name);
    if (found) {
      return {
        name: found.name,
        initials: found.initials,
        color: found.color,
        badgeBg: found.color + '20',
        badgeText: found.color
      };
    }
    return { name: name || 'Unassigned', initials: '??', color: '#6B7280', badgeBg: '#F3F4F6', badgeText: '#374151' };
  };

  const handleAddAssignee = (name) => {
    if (name && !selectedAssignees.includes(name)) setSelectedAssignees([...selectedAssignees, name]);
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
      assignees: selectedAssignees,
      date: taskDate,
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
      cadenceDays: Number(cadenceDays),
      completedDates: [],
      chainedSteps: chainedSteps.filter(s => s.title.trim() !== ''),
      type: hasSpecificTime ? 'timed' : 'flexible',
      status: 'pending',
      comments: []
    };

    setTasks([newTask, ...tasks]);
    resetForm();
    setCurrentView('month');
  };

  const handleOpenModal = (task, instanceDateStr) => {
    setSelectedTask(task);
    setSelectedInstanceDate(instanceDateStr || formatDateKey(currentDate));
    setIsEditing(false);
    setExecutionComment('');
    setPhotoUploaded(false);
    setAdditionalNote('');

    setTaskTitle(task.title);
    setTaskDesc(task.desc);
    setSelectedAssignees(task.assignees || []);
    setTaskPriority(task.priority);
    setTaskDate(task.date || instanceDateStr);
    setHasSpecificTime(task.type === 'timed');
    setStartTime(task.startTime || '09:00');
    setEndTime(task.endTime || '11:00');
    setRecurrenceType(task.recurrenceType || 'once');
    setActiveDays(task.activeDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setGenerationTime(task.generationTime || '13:00');
    setCadenceDays(task.cadenceDays || 14);
    setRequiresPhoto(task.requiresPhoto || false);
    setRequiresComment(task.requiresComment || false);
    setNotifyOnComplete(task.notifyOnComplete ?? true);
    setNotifyOnComment(task.notifyOnComment ?? false);
    setChainedSteps(task.chainedSteps || []);
  };

  const handleSaveChanges = () => {
    if (!taskTitle.trim()) return alert('Title cannot be empty.');

    const startDec = timeToDecimal(startTime);
    const endDec = timeToDecimal(endTime);
    const dur = Math.max(0.5, endDec - startDec);
    const todayStr = formatDateKey(new Date());
    const isStillOverdue = taskDate < todayStr && selectedTask.status !== 'completed';

    const updatedTask = {
      ...selectedTask,
      title: taskTitle,
      desc: taskDesc,
      assignees: selectedAssignees,
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
      cadenceDays: Number(cadenceDays),
      requiresPhoto,
      requiresComment,
      notifyOnComplete,
      notifyOnComment,
      chainedSteps: chainedSteps.filter(s => s.title.trim() !== ''),
      isOverdue: isStillOverdue,
      overdueNotified: isStillOverdue
    };

    setTasks(tasks.map(t => t.id === selectedTask.id ? updatedTask : t));
    setSelectedTask(updatedTask);
    setIsEditing(false);
  };

  const handleDeleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
    setSelectedTask(null);
  };

  const handlePostOpenComment = (id) => {
    if (!openCommentInput.trim()) return;
    const commentText = `${userRole === 'admin' ? 'Admin' : 'Assignee'} (${selectedInstanceDate}): ${openCommentInput}`;
    
    setTasks(tasks.map(t => t.id === id ? { ...t, comments: [...(t.comments || []), commentText] } : t));
    setSelectedTask(prev => ({ ...prev, comments: [...(prev.comments || []), commentText] }));
    
    setNotifications([{ id: Date.now(), text: `New comment on "${selectedTask.title}"`, type: 'comment', read: false, time: 'Just now' }, ...notifications]);
    setExecutionComment('');
  };

  const handleCompleteTask = (id) => {
    if (selectedTask.requiresPhoto && !photoUploaded) return alert('Photo upload required to complete.');
    if (selectedTask.requiresComment && !openCommentInput.trim() && (!selectedTask.comments || selectedTask.comments.length === 0)) {
      return alert('Execution notes required to complete.');
    }

    const noteText = openCommentInput.trim() 
      ? `${userRole === 'admin' ? 'Admin' : 'Assignee'} (${selectedInstanceDate}): ${openCommentInput}`
      : null;

    let updatedTasks = tasks.map(t => {
      if (t.id === id) {
        const newComments = noteText ? [...(t.comments || []), noteText] : (t.comments || []);

        if (t.recurrenceType === 'once') {
          return { ...t, status: 'completed', isOverdue: false, comments: newComments };
        } else {
          const updatedCompletedDates = [...(t.completedDates || []), selectedInstanceDate];
          return { ...t, completedDates: updatedCompletedDates, isOverdue: false, comments: newComments };
        }
      }
      return t;
    });

    setNotifications([
      { id: Date.now(), text: `${userRole === 'admin' ? 'Admin' : 'Assignee'} completed "${selectedTask.title}"`, type: 'completion', read: false, time: 'Just now' },
      ...notifications
    ]);

    if (selectedTask.recurrenceType === 'completion') {
      const nextDueDate = addDaysToDateStr(selectedInstanceDate, selectedTask.cadenceDays || 14);
      const nextInstanceTask = {
        ...selectedTask,
        id: Date.now() + 2,
        date: nextDueDate,
        completedDates: [],
        status: 'pending',
        isOverdue: false,
        comments: [`Auto-deployed ${selectedTask.cadenceDays || 14} days after completion on ${selectedInstanceDate}`]
      };
      updatedTasks = [nextInstanceTask, ...updatedTasks];
      alert(`Task completed! Next completion-triggered task scheduled for ${nextDueDate}.`);
    }

    if (selectedTask.chainedSteps && selectedTask.chainedSteps.length > 0) {
      const nextStep = selectedTask.chainedSteps[0];
      const targetDate = addDaysToDateStr(selectedInstanceDate, nextStep.relativeDays || 0);
      const stepAssignees = nextStep.assignee === 'Same as Parent' ? selectedTask.assignees : [nextStep.assignee];

      const chainedTask = {
        id: Date.now() + 1,
        title: nextStep.title || 'Follow-up Task',
        desc: nextStep.desc || `Chained step from completed task: "${selectedTask.title}"`,
        assignees: stepAssignees,
        date: targetDate,
        startTime: '09:00',
        endTime: '10:00',
        startHour: 9,
        duration: 1,
        timeLabel: '09:00 AM - 10:00 AM',
        priority: nextStep.priority || 'Medium',
        requiresPhoto: nextStep.requiresPhoto || false,
        requiresComment: nextStep.requiresComment || false,
        recurrenceType: 'once',
        activeDays: [],
        cadenceDays: 14,
        completedDates: [],
        chainedSteps: selectedTask.chainedSteps.slice(1),
        type: 'timed',
        status: 'pending',
        isOverdue: false,
        comments: [`Auto-deployed via Chained Workflow from "${selectedTask.title}"`]
      };

      updatedTasks = [chainedTask, ...updatedTasks];
      alert(`Chained follow-up task "${nextStep.title}" deployed for ${targetDate}.`);
    }

    setTasks(updatedTasks);
    setSelectedTask(null);
  };

  const handleAppendNote = (id) => {
    if (!additionalNote.trim()) return;
    const noteText = `${userRole === 'admin' ? 'Admin Note' : 'Assignee Note'}: ${additionalNote}`;
    setTasks(tasks.map(t => t.id === id ? { ...t, comments: [...(t.comments || []), noteText] } : t));
    setAdditionalNote('');
    setSelectedTask(prev => ({ ...prev, comments: [...(prev.comments || []), noteText] }));
  };

  const handleReopenTask = (id) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        if (t.recurrenceType === 'once') return { ...t, status: 'pending' };
        return { ...t, completedDates: (t.completedDates || []).filter(d => d !== selectedInstanceDate) };
      }
      return t;
    }));
    setSelectedTask(null);
  };

  const markAllNotifsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const unreadNotifCount = notifications.filter(n => !n.read).length;

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
    if (!t || !t.assignees) return false;

    const isAssigneeMatch = userRole === 'admin' 
      ? (t.assignees.length === 0 || t.assignees.some(a => activeEmployeeFilters.includes(a)))
      : t.assignees.includes('Adrian R.');

    const isSearchMatch = !searchQuery.trim() || 
      (t.title && t.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
      (t.desc && t.desc.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.assignees && t.assignees.some(a => a && a.toLowerCase().includes(searchQuery.toLowerCase())));

    return isAssigneeMatch && isSearchMatch;
  });

  const backlogTasks = tasks.filter(t => (!t.assignees || t.assignees.length === 0) && t.status !== 'completed');

  const isTaskActiveOnDay = (task, dayOfWeekStr, dateStr) => {
    if (!task) return false;
    if (task.completedDates && task.completedDates.includes(dateStr)) return false;
    if (task.status === 'completed') return false;

    if (task.recurrenceType === 'fixed') {
      return task.activeDays && task.activeDays.includes(dayOfWeekStr);
    }
    return task.date === dateStr;
  };

  const isTaskCompletedOnDay = (task, dateStr) => {
    if (!task) return false;
    if (task.status === 'completed' && task.date === dateStr) return true;
    return task.completedDates && task.completedDates.includes(dateStr);
  };

  const isCurrentInstanceCompleted = selectedTask && (
    selectedTask.status === 'completed' || 
    (selectedTask.completedDates && selectedTask.completedDates.includes(selectedInstanceDate))
  );

  const draggedTaskObj = draggedTaskId ? tasks.find(t => t.id === draggedTaskId) : null;

  return (
    <div className="min-h-screen bg-[#A9B1A6] p-4 sm:p-8 font-sans text-[#333333]">
      <div className="max-w-7xl mx-auto bg-[#F4F3ED] p-6 rounded-lg shadow-sm min-h-[850px] flex flex-col relative">
        
        {/* ROLE SIMULATION HEADER */}
        <div className="bg-[#333333] text-white px-4 py-2 rounded-md mb-4 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs shadow-md">
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

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active & past tasks..." 
              className="px-3 py-1 rounded bg-gray-800 text-white placeholder-gray-400 text-xs focus:outline-none focus:ring-1 focus:ring-[#A9B1A6] w-full sm:w-64" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-white font-bold">✕</button>
            )}
          </div>
        </div>

        {/* CONTROLS HEADER */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4 border-b border-gray-300 pb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-1 shadow-2xs">
              <button onClick={handlePrevDate} className="px-2.5 py-1 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded transition">‹</button>
              <button onClick={handleToday} className="px-3 py-1 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded transition border-x border-gray-200">Today</button>
              <button onClick={handleNextDate} className="px-2.5 py-1 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded transition">›</button>
            </div>

            <div>
              <h1 className="text-2xl font-serif font-bold text-gray-900 leading-tight">{getHeaderTitle()}</h1>
              <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Command Center Queue</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-gray-200 p-1 rounded-lg flex items-center gap-1 border border-gray-300">
              <button onClick={() => setCurrentView('list')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${currentView === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>List</button>
              <button onClick={() => setCurrentView('day')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${currentView === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Day</button>
              <button onClick={() => setCurrentView('week')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${currentView === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Week</button>
              <button onClick={() => setCurrentView('month')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${currentView === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Month</button>
            </div>

            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="bg-white p-2 rounded-lg border border-gray-300 relative hover:bg-gray-50 transition">
                🔔
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-300 z-50 p-3 animate-fade-in">
                  <div className="flex justify-between items-center border-b pb-2 mb-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700">Notification Center</h4>
                    <button onClick={markAllNotifsRead} className="text-[10px] text-blue-600 font-bold hover:underline">Mark all read</button>
                  </div>
                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                    {notifications.map(n => (
                      <div key={n.id} className={`p-2 rounded text-xs border ${n.read ? 'bg-gray-50 border-gray-100 text-gray-500' : 'bg-red-50 border-red-200 text-red-900 font-bold'}`}>
                        <div className="flex justify-between">
                          <span>{n.text}</span>
                          <span className="text-[9px] text-gray-400">{n.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {userRole === 'admin' && (
              <button 
                onClick={() => { resetMemberForm(); setIsSettingsOpen(true); }}
                className="bg-white p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition font-bold text-sm"
                title="Settings & User Management">
                ⚙️
              </button>
            )}

            {userRole === 'admin' && (
              <button onClick={() => { resetForm(); setCurrentView('create'); }} className="bg-[#A9B1A6] text-white px-4 py-2 rounded text-xs font-bold shadow-sm hover:bg-gray-600 transition">
                + New Task
              </button>
            )}
          </div>
        </div>

        {/* TEAM MEMBER FILTER BAR */}
        {userRole === 'admin' && currentView !== 'create' && (
          <div className="bg-white p-2.5 rounded-lg border border-gray-200 mb-4 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Filter Visible Team:</span>
              <div className="flex gap-1.5">
                {teamMembers.map(m => {
                  const isActive = activeEmployeeFilters.includes(m.name);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleEmployeeFilter(m.name)}
                      className={`text-xs px-2.5 py-1 rounded-full font-bold border transition flex items-center gap-1.5 ${
                        isActive ? 'bg-white shadow-2xs border-gray-300' : 'bg-gray-100 text-gray-400 border-gray-200 line-through'
                      }`}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }}></span>
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={() => setActiveEmployeeFilters(teamMembers.map(m => m.name))} className="text-[11px] font-bold text-[#A9B1A6] hover:underline">
              Show All Team Members
            </button>
          </div>
        )}

        {/* UNASSIGNED BACKLOG TRAY */}
        {userRole === 'admin' && backlogTasks.length > 0 && currentView !== 'create' && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
                📥 Unassigned Task Backlog ({backlogTasks.length} Drafts Waiting)
              </span>
              <span className="text-[10px] text-amber-700 italic">Click task to assign team members</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {backlogTasks.map(task => (
                <div 
                  key={task.id}
                  draggable={userRole === 'admin'}
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleOpenModal(task, formatDateKey(currentDate))}
                  className="bg-white px-3 py-1.5 rounded border border-amber-200 text-xs font-bold text-gray-800 cursor-grab active:cursor-grabbing hover:bg-amber-100 transition shadow-2xs flex items-center gap-2">
                  <span>{task.title}</span>
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">Unassigned</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LIST VIEW */}
        {currentView === 'list' && (
          <div className="flex-col flex gap-6 overflow-y-auto pr-2">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Tasks for {getHeaderTitle()}</h2>
              </div>

              <div className="flex flex-col gap-3">
                {visibleTasks
                  .filter(t => isTaskActiveOnDay(t, daysOfWeek[currentDate.getDay()], formatDateKey(currentDate)))
                  .map(task => {
                    const style = getPriorityStyle(task.priority);
                    return (
                      <div 
                        key={task.id}
                        onClick={() => handleOpenModal(task, formatDateKey(currentDate))}
                        className={`bg-white p-4 rounded border-l-4 ${task.isOverdue ? 'border-red-600 bg-red-50/50 ring-1 ring-red-400' : style.border} shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50 transition`}>
                        <div className="w-1/2 flex items-center gap-4">
                          <span className="font-mono text-sm font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200">{task.timeLabel}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg">{task.title}</h3>
                              {task.isOverdue && <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded animate-pulse">OVERDUE</span>}
                              {task.recurrenceType === 'completion' && <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">🔄 Interval</span>}
                            </div>
                            <p className="text-sm text-gray-500 truncate">{task.desc}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${style.badge}`}>{task.priority}</span>
                          <div className="flex -space-x-2">
                            {(task.assignees || []).map((a, idx) => {
                              const m = getMemberConfig(a);
                              return (
                                <div key={idx} style={{ backgroundColor: m.color }} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs text-white shadow-sm font-bold">
                                  {m.initials}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {visibleTasks.filter(t => isTaskActiveOnDay(t, daysOfWeek[currentDate.getDay()], formatDateKey(currentDate))).length === 0 && (
                  <div className="bg-white p-8 rounded text-center border border-dashed border-gray-300">
                    <p className="text-sm text-gray-500 font-bold">No active tasks scheduled for this date.</p>
                  </div>
                )}
              </div>
            </div>

            {visibleTasks.some(t => isTaskCompletedOnDay(t, formatDateKey(currentDate))) && (
              <div className="pt-4 border-t border-gray-300">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Completed Today</h2>
                <div className="flex flex-col gap-2">
                  {visibleTasks.filter(t => isTaskCompletedOnDay(t, formatDateKey(currentDate))).map(task => (
                    <div 
                      key={task.id} 
                      onClick={() => handleOpenModal(task, formatDateKey(currentDate))}
                      className="bg-gray-200/60 p-3 rounded flex justify-between items-center cursor-pointer hover:bg-gray-200 transition">
                      <div>
                        <span className="line-through text-sm font-bold text-gray-600 block">{task.title}</span>
                        <span className="text-xs text-gray-500">Assignees: {(task.assignees || []).join(', ')}</span>
                      </div>
                      <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full border border-green-300">
                        ✓ Completed
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DAY VIEW WITH SIDE-BY-SIDE OVERLAPPING TASKS & HOVER GHOST PREVIEW */}
        {currentView === 'day' && (
          <div className="flex-1 flex flex-col border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm min-w-[600px]">
            {/* Column Headers */}
            <div className="flex border-b border-gray-300 bg-gray-100">
              <div className="w-20 py-3 text-center text-xs font-bold text-gray-500 border-r border-gray-300">Time</div>
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${visibleMembers.length}, minmax(0, 1fr))` }}>
                {visibleMembers.map(member => (
                  <div key={member.id} className="py-3 px-2 border-r border-gray-300 last:border-r-0 flex items-center justify-center gap-2">
                    <div style={{ backgroundColor: member.color }} className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-sm">
                      {member.initials}
                    </div>
                    <span className="font-bold text-sm text-gray-800">{member.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Continuous 10-Hour Column Grid */}
            <div className="flex-1 relative overflow-y-auto max-h-[580px] flex">
              {/* Time Label Sidebar */}
              <div className="w-20 border-r border-gray-300 bg-gray-50 flex flex-col select-none shrink-0">
                {timeSlots.map(hour => (
                  <div key={hour} className="h-20 border-b border-gray-200 p-2 text-xs font-mono font-bold text-gray-400 text-right pr-3">
                    {hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
                  </div>
                ))}
              </div>

              {/* Interactive Member Columns */}
              <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${visibleMembers.length}, minmax(0, 1fr))` }}>
                {visibleMembers.map(member => {
                  const dayDateStr = formatDateKey(currentDate);
                  const memberColTasks = visibleTasks.filter(t => isTaskActiveOnDay(t, daysOfWeek[currentDate.getDay()], dayDateStr) && t.assignees && t.assignees.includes(member.name));
                  const layouts = computeColumnTaskLayouts(memberColTasks);

                  return (
                    <div key={member.id} className="border-r border-gray-200 last:border-r-0 relative h-[800px]">
                      {/* 15-Minute Sub-Slot Drop Grid */}
                      {timeSlots.map(hour => (
                        <div key={hour} className="h-20 border-b border-gray-200 flex flex-col">
                          {minuteSubSlots.map(subOffset => (
                            <div 
                              key={subOffset}
                              onDragOver={(e) => handleSubSlotDragOver(e, dayDateStr, hour + subOffset, member.name)}
                              onDrop={(e) => handleDropSlot(e, dayDateStr, hour + subOffset, member.name)}
                              className="flex-1 hover:bg-blue-50/50 transition border-b border-dashed border-gray-100 last:border-b-0"
                              title={`Schedule for ${decimalToTimeString(hour + subOffset)} - ${member.name}`}>
                            </div>
                          ))}
                        </div>
                      ))}

                      {/* REAL-TIME HOVER GHOST PREVIEW CARD (HCP-STYLE) */}
                      {draggedTaskObj && hoverSlot && hoverSlot.memberName === member.name && hoverSlot.dateStr === dayDateStr && (
                        <div 
                          style={{
                            top: `${(hoverSlot.targetHour - 8) * 80}px`,
                            height: `${Math.max(32, (draggedTaskObj.duration || 1) * 80)}px`,
                            left: '2px',
                            right: '2px'
                          }}
                          className="absolute z-30 bg-blue-500/20 border-2 border-dashed border-blue-600 rounded-md p-2 shadow-lg pointer-events-none flex flex-col justify-between text-blue-950 font-bold backdrop-blur-[2px] animate-pulse">
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded shadow-2xs font-mono shrink-0">
                              🎯 {formatTimeLabel(decimalToTimeString(hoverSlot.targetHour), decimalToTimeString(hoverSlot.targetHour + (draggedTaskObj.duration || 1)))}
                            </span>
                            <span className="text-[9px] bg-white/90 px-1 py-0.5 rounded border border-blue-300 text-blue-900 truncate">
                              {member.name}
                            </span>
                          </div>
                          <span className="text-xs truncate text-blue-950 mt-1">{draggedTaskObj.title}</span>
                        </div>
                      )}

                      {/* SIDE-BY-SIDE RENDERED TASKS */}
                      {memberColTasks.map(task => {
                        const layout = layouts[task.id] || { left: '0%', width: '100%', startPx: 0, heightPx: 80, isFlex: false };
                        const isFlex = layout.isFlex;

                        return (
                          <div
                            key={task.id}
                            draggable={userRole === 'admin'}
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={handleDragEnd}
                            onClick={() => handleOpenModal(task, dayDateStr)}
                            style={{ 
                              top: `${layout.startPx}px`, 
                              height: `${layout.heightPx}px`, 
                              left: layout.left, 
                              width: layout.width, 
                              backgroundColor: member.color 
                            }}
                            className={`absolute text-white rounded-md p-2 shadow-md border-l-4 ${task.isOverdue ? 'border-red-500 ring-2 ring-red-400' : 'border-black/20'} ${userRole === 'admin' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:brightness-110 transition z-10 flex flex-col justify-between overflow-hidden ${isFlex ? 'opacity-95' : ''}`}>
                            <div>
                              <div className="flex justify-between items-start gap-1">
                                <h4 className="font-bold text-xs leading-tight drop-shadow-sm truncate">
                                  {task.title}
                                </h4>
                                {task.isOverdue ? (
                                  <span className="bg-red-600 text-[8px] font-bold px-1 rounded shrink-0">OVERDUE</span>
                                ) : (
                                  isFlex && <span className="bg-black/30 text-[8px] font-bold px-1 rounded shrink-0">ALL-DAY</span>
                                )}
                              </div>
                              <span className="text-[10px] bg-black/20 px-1 rounded font-mono inline-block mt-0.5">{task.timeLabel}</span>
                              <p className="text-[10px] opacity-90 truncate mt-0.5">{task.desc}</p>
                            </div>
                            <div className="flex items-center justify-between text-[9px] opacity-80 pt-0.5 border-t border-white/20 mt-auto">
                              <span>Priority: {task.priority}</span>
                              <span>{task.recurrenceType === 'completion' ? '🔄' : task.recurrenceType === 'fixed' ? '↻' : ''}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* WEEK VIEW WITH SIDE-BY-SIDE OVERLAPPING TASKS & HOVER GHOST PREVIEW */}
        {currentView === 'week' && (
          <div className="flex-1 flex flex-col border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm min-w-[800px]">
            {/* Week Header */}
            <div className="flex border-b border-gray-300 bg-gray-100 font-bold text-xs text-gray-700">
              <div className="w-16 py-2 text-center border-r border-gray-300">Time</div>
              <div className="flex-1 grid grid-cols-7">
                {daysOfWeek.map((dayName, idx) => {
                  const weekStart = getWeekStart(currentDate);
                  const cellDate = new Date(weekStart);
                  cellDate.setDate(cellDate.getDate() + idx);
                  const isTodayCell = formatDateKey(cellDate) === formatDateKey(new Date());

                  return (
                    <div key={dayName} className={`py-2 text-center border-r border-gray-300 last:border-r-0 ${isTodayCell ? 'bg-[#A9B1A6] text-white' : ''}`}>
                      <span className="block text-[10px] uppercase">{dayName}</span>
                      <span className="text-xs font-serif">{cellDate.getMonth() + 1}/{cellDate.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Continuous 7-Day Time Grid */}
            <div className="flex-1 relative overflow-y-auto max-h-[550px] flex">
              {/* Time Label Sidebar */}
              <div className="w-16 border-r border-gray-300 bg-gray-50 flex flex-col select-none shrink-0">
                {timeSlots.map(hour => (
                  <div key={hour} className="h-20 border-b border-gray-200 p-1 text-[10px] font-mono font-bold text-gray-400 text-right pr-2">
                    {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </div>
                ))}
              </div>

              {/* 7 Day Columns */}
              <div className="flex-1 grid grid-cols-7 relative">
                {daysOfWeek.map((dayName, idx) => {
                  const weekStart = getWeekStart(currentDate);
                  const cellDate = new Date(weekStart);
                  cellDate.setDate(cellDate.getDate() + idx);
                  const dateStr = formatDateKey(cellDate);

                  const dayColTasks = visibleTasks.filter(t => isTaskActiveOnDay(t, dayName, dateStr));
                  const layouts = computeColumnTaskLayouts(dayColTasks);

                  return (
                    <div key={dayName} className="border-r border-gray-200 last:border-r-0 relative h-[800px]">
                      {/* 15-Minute Sub-Slot Drop Grid */}
                      {timeSlots.map(hour => (
                        <div key={hour} className="h-20 border-b border-gray-200 flex flex-col">
                          {minuteSubSlots.map(subOffset => (
                            <div 
                              key={subOffset}
                              onDragOver={(e) => handleSubSlotDragOver(e, dateStr, hour + subOffset, null)}
                              onDrop={(e) => handleDropSlot(e, dateStr, hour + subOffset, null)}
                              className="flex-1 hover:bg-blue-50/50 transition border-b border-dashed border-gray-100 last:border-b-0"
                              title={`${dateStr} @ ${decimalToTimeString(hour + subOffset)}`}>
                            </div>
                          ))}
                        </div>
                      ))}

                      {/* REAL-TIME HOVER GHOST PREVIEW CARD (WEEK VIEW) */}
                      {draggedTaskObj && hoverSlot && hoverSlot.dateStr === dateStr && (
                        <div 
                          style={{
                            top: `${(hoverSlot.targetHour - 8) * 80}px`,
                            height: `${Math.max(32, (draggedTaskObj.duration || 1) * 80)}px`,
                            left: '2px',
                            right: '2px'
                          }}
                          className="absolute z-30 bg-blue-500/20 border-2 border-dashed border-blue-600 rounded p-1.5 shadow-lg pointer-events-none flex flex-col justify-between text-blue-950 font-bold backdrop-blur-[2px] animate-pulse">
                          <div className="flex justify-between items-center text-[9px] font-bold">
                            <span className="bg-blue-600 text-white px-1 py-0.5 rounded font-mono truncate">
                              🎯 {formatTimeLabel(decimalToTimeString(hoverSlot.targetHour), decimalToTimeString(hoverSlot.targetHour + (draggedTaskObj.duration || 1)))}
                            </span>
                          </div>
                          <span className="text-[10px] truncate text-blue-950 mt-0.5">{draggedTaskObj.title}</span>
                        </div>
                      )}

                      {/* SIDE-BY-SIDE RENDERED TASKS FOR WEEK VIEW */}
                      {dayColTasks.map(task => {
                        const layout = layouts[task.id] || { left: '0%', width: '100%', startPx: 0, heightPx: 80, isFlex: false };
                        const member = getMemberConfig(task.assignees && task.assignees[0]);
                        const isFlex = layout.isFlex;

                        return (
                          <div
                            key={`${task.id}-${dateStr}`}
                            draggable={userRole === 'admin'}
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={handleDragEnd}
                            onClick={() => handleOpenModal(task, dateStr)}
                            style={{ 
                              top: `${layout.startPx}px`, 
                              height: `${layout.heightPx}px`, 
                              left: layout.left, 
                              width: layout.width, 
                              backgroundColor: member.color 
                            }}
                            className={`absolute text-white rounded p-1.5 shadow ${userRole === 'admin' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:opacity-90 transition z-10 flex flex-col justify-between overflow-hidden ${task.isOverdue ? 'ring-2 ring-red-500' : ''} ${isFlex ? 'opacity-95' : ''}`}>
                            <div>
                              <div className="flex justify-between items-center text-[10px] font-bold leading-tight">
                                <span className="truncate">{task.title}</span>
                                {task.isOverdue ? (
                                  <span className="bg-red-600 px-0.5 rounded text-[8px] shrink-0">!</span>
                                ) : (
                                  isFlex && <span className="bg-black/30 px-0.5 rounded text-[7px] shrink-0">ALL-DAY</span>
                                )}
                              </div>
                              <span className="text-[9px] opacity-80 font-mono block truncate">{task.timeLabel}</span>
                            </div>
                            <span className="text-[8px] bg-black/20 px-1 rounded truncate w-max mt-auto">{(task.assignees || []).join(', ')}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* MONTH VIEW */}
        {currentView === 'month' && (
          <div className="flex-1 flex flex-col border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-300 text-center py-2 text-xs font-bold text-gray-600">
              {daysOfWeek.map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 grid-rows-5 flex-1 divide-x divide-y divide-gray-200 min-h-[550px]">
              {Array.from({ length: 35 }).map((_, i) => {
                const firstOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                const startDay = firstOfMonth.getDay();
                const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1 - startDay + i);
                
                const isCurrentMonthCell = cellDate.getMonth() === currentDate.getMonth();
                const dateStr = formatDateKey(cellDate);
                const dayOfWeekStr = daysOfWeek[cellDate.getDay()];
                const isTodayCell = dateStr === formatDateKey(new Date());

                const pendingDayTasks = isCurrentMonthCell 
                  ? visibleTasks.filter(t => isTaskActiveOnDay(t, dayOfWeekStr, dateStr))
                  : [];

                const completedDayTasks = isCurrentMonthCell
                  ? visibleTasks.filter(t => isTaskCompletedOnDay(t, dateStr))
                  : [];

                return (
                  <div 
                    key={i} 
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropSlot(e, dateStr, null, null)}
                    className={`p-1.5 flex flex-col transition hover:bg-blue-50/20 ${isCurrentMonthCell ? 'bg-white' : 'bg-gray-50/50 text-gray-300'}`}>
                    <span className={`text-xs font-bold p-1 ${isTodayCell ? 'bg-[#A9B1A6] text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-gray-500'}`}>
                      {cellDate.getDate()}
                    </span>
                    <div className="flex flex-col gap-1 mt-1 overflow-y-auto max-h-24">
                      {pendingDayTasks.map(task => {
                        const member = getMemberConfig(task.assignees && task.assignees[0]);
                        return (
                          <div 
                            key={`${task.id}-${dateStr}`} 
                            draggable={userRole === 'admin'}
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={handleDragEnd}
                            onClick={() => handleOpenModal(task, dateStr)}
                            style={{ backgroundColor: member.color }}
                            className={`text-white text-[10px] font-semibold p-1 rounded truncate ${userRole === 'admin' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:opacity-90 shadow-2xs flex items-center justify-between ${task.isOverdue ? 'ring-2 ring-red-500' : ''}`}>
                            <span className="truncate">{task.title}</span>
                            <div className="flex items-center gap-0.5">
                              {task.isOverdue && <span className="text-[8px] bg-red-600 px-0.5 rounded font-bold">!</span>}
                              {task.recurrenceType === 'completion' && <span className="text-[8px] bg-black/20 px-0.5 rounded">🔄</span>}
                              {task.recurrenceType === 'fixed' && <span className="text-[8px] bg-black/20 px-0.5 rounded font-mono">↻</span>}
                            </div>
                          </div>
                        );
                      })}

                      {completedDayTasks.map(task => (
                        <div 
                          key={`completed-${task.id}-${dateStr}`}
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

        {/* TASK BUILDER VIEW */}
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
                  <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g., Service Espresso Machine" className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#A9B1A6]" />
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
                      {teamMembers.filter(m => !selectedAssignees.includes(m.name)).map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
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

                <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-sm">Multi-Step Task Chaining Engine</h4>
                    <button type="button" onClick={handleAddChainedStep} className="text-xs font-bold bg-[#A9B1A6] text-white px-2.5 py-1 rounded hover:bg-gray-600 transition">+ Add Step</button>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Build an automated pipeline of follow-up tasks triggered upon completion.</p>

                  {chainedSteps.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No follow-up steps configured.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {chainedSteps.map((step, idx) => (
                        <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200 text-xs flex flex-col gap-2.5 relative">
                          <div className="flex justify-between items-center font-bold text-gray-700">
                            <span>Step {idx + 1} Follow-up Task</span>
                            <button type="button" onClick={() => handleRemoveChainedStep(idx)} className="text-red-600 font-bold hover:underline">Remove</button>
                          </div>
                          
                          <input type="text" value={step.title} onChange={(e) => handleUpdateChainedStep(idx, 'title', e.target.value)} placeholder="Step Title" className="p-1.5 border rounded bg-white" />
                          <textarea rows={2} value={step.desc} onChange={(e) => handleUpdateChainedStep(idx, 'desc', e.target.value)} placeholder="Instructions..." className="p-1.5 border rounded bg-white"></textarea>

                          <div className="flex gap-2">
                            <div className="w-1/2">
                              <label className="block font-bold text-[10px] text-gray-500 mb-0.5">Deployment Offset</label>
                              <div className="flex items-center gap-1">
                                <input type="number" value={step.relativeDays} onChange={(e) => handleUpdateChainedStep(idx, 'relativeDays', Number(e.target.value))} className="w-12 p-1 border rounded bg-white text-center font-bold" />
                                <span className="text-[11px] text-gray-600">days after</span>
                              </div>
                            </div>

                            <div className="w-1/2">
                              <label className="block font-bold text-[10px] text-gray-500 mb-0.5">Assignee</label>
                              <select value={step.assignee} onChange={(e) => handleUpdateChainedStep(idx, 'assignee', e.target.value)} className="w-full p-1 border rounded bg-white text-xs">
                                <option value="Same as Parent">Same as Parent</option>
                                {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

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

                <div className="bg-[#A9B1A6]/10 p-4 rounded border border-[#A9B1A6]/30">
                  <h4 className="font-bold text-sm mb-2 text-gray-800">Admin Notification Rules</h4>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={notifyOnComplete} onChange={(e) => setNotifyOnComplete(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Notify me when task is completed
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={notifyOnComment} onChange={(e) => setNotifyOnComment(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Notify me on new task comments
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

        {/* TASK INSPECTOR & FULL EDITING MODAL */}
        {selectedTask && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#F4F3ED] max-w-2xl w-full rounded-lg shadow-xl p-6 border border-gray-300 flex flex-col gap-4 animate-fade-in max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b border-gray-300 pb-3">
                <div>
                  <span className="text-xs font-bold text-[#A9B1A6] uppercase tracking-wider">
                    {isCurrentInstanceCompleted ? 'Completed Occurrence Review' : (userRole === 'admin' ? (isEditing ? 'Admin Full Task Editor' : 'Admin Inspector Mode') : 'Assignee Execution View')}
                  </span>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-serif font-bold">{selectedTask.title}</h2>
                    {selectedTask.isOverdue && <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">OVERDUE</span>}
                  </div>
                </div>
                <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
              </div>

              {!isEditing ? (
                <>
                  <p className="text-sm text-gray-600 bg-white p-3 rounded border border-gray-200">{selectedTask.desc}</p>

                  <div className="flex justify-between text-xs text-gray-500 bg-gray-100 p-2 rounded">
                    <span>Assignees: <strong>{selectedTask.assignees && selectedTask.assignees.length > 0 ? selectedTask.assignees.join(', ') : 'Unassigned (Backlog)'}</strong></span>
                    <span>Occurrence Date: <strong>{selectedInstanceDate}</strong></span>
                  </div>

                  <div className="bg-white p-3 rounded border border-gray-200">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-2">Task Activity & Comments</h4>
                    
                    {selectedTask.comments && selectedTask.comments.length > 0 ? (
                      <div className="flex flex-col gap-1 max-h-28 overflow-y-auto pr-1 mb-3">
                        {selectedTask.comments.map((c, i) => (
                          <div key={i} className="text-xs text-gray-700 bg-gray-50 p-1.5 rounded border border-gray-100">{c}</div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic mb-2">No comments posted yet.</p>
                    )}

                    {!isCurrentInstanceCompleted && (
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={openCommentInput}
                          onChange={(e) => setExecutionComment(e.target.value)}
                          placeholder="Type an update or comment..." 
                          className="flex-1 p-2 text-xs border border-gray-200 rounded focus:outline-none" />
                        <button 
                          type="button"
                          onClick={() => handlePostOpenComment(selectedTask.id)}
                          className="bg-[#333333] text-white px-3 py-1 rounded text-xs font-bold hover:bg-black transition">
                          Post Note
                        </button>
                      </div>
                    )}
                  </div>

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
                        <button onClick={() => handleAppendNote(selectedTask.id)} className="bg-green-700 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-800 transition">Add Note</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* FULL FEATURE EDITING SCREEN */
                <div className="flex flex-col gap-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold mb-1 text-gray-700">Task Title</label>
                      <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="w-full p-2 border rounded bg-white" />
                    </div>

                    <div>
                      <label className="block font-bold mb-1 text-gray-700">Priority Level</label>
                      <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className="w-full p-2 border rounded bg-white">
                        <option value="High">High (Red)</option>
                        <option value="Medium">Medium (Orange)</option>
                        <option value="Low">Low (Green)</option>
                        <option value="Routine">Routine (Gray)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold mb-1 text-gray-700">Description / Instructions</label>
                    <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} className="w-full p-2 border rounded bg-white" rows={2}></textarea>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded border border-gray-200">
                    <div>
                      <label className="block font-bold mb-1 text-gray-700">Deadline Date</label>
                      <input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} className="w-full p-1.5 border rounded bg-white mb-2" />
                      
                      <div className="flex items-center gap-1.5">
                        <input type="checkbox" id="editTimeToggle" checked={hasSpecificTime} onChange={(e) => setHasSpecificTime(e.target.checked)} className="accent-[#A9B1A6]" />
                        <label htmlFor="editTimeToggle" className="font-bold text-gray-700 cursor-pointer">Timed Slot</label>
                      </div>

                      {hasSpecificTime && (
                        <div className="flex gap-2 mt-1">
                          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-1/2 p-1 border rounded bg-white" />
                          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-1/2 p-1 border rounded bg-white" />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block font-bold mb-1 text-gray-700">Assignees</label>
                      <select value="" onChange={(e) => { if (e.target.value) handleAddAssignee(e.target.value); }} className="w-full p-1.5 border rounded bg-white mb-1">
                        <option value="">Add assignee...</option>
                        {teamMembers.filter(m => !selectedAssignees.includes(m.name)).map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                      </select>
                      <div className="flex flex-wrap gap-1">
                        {selectedAssignees.map(name => (
                          <span key={name} className="bg-gray-200 text-[10px] px-2 py-0.5 rounded flex items-center gap-1 font-bold">
                            {name} <button onClick={() => handleRemoveAssignee(name)} className="text-red-600">✕</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded border border-gray-200">
                    <h4 className="font-bold mb-2 text-gray-700">Recurrence Engine</h4>
                    <select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)} className="w-full p-1.5 border rounded bg-gray-50 mb-2">
                      <option value="once">One-time Task</option>
                      <option value="fixed">Fixed Calendar Schedule</option>
                      <option value="completion">Completion-Triggered</option>
                    </select>

                    {recurrenceType === 'fixed' && (
                      <div className="flex gap-1 mt-2">
                        {daysOfWeek.map(day => (
                          <button 
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            className={`flex-1 py-1 text-[10px] font-bold rounded border ${activeDays.includes(day) ? 'bg-[#A9B1A6] text-white border-[#A9B1A6]' : 'bg-white text-gray-500'}`}>
                            {day}
                          </button>
                        ))}
                      </div>
                    )}

                    {recurrenceType === 'completion' && (
                      <div className="flex items-center gap-2 mt-2">
                        <span>Re-deploy</span>
                        <input type="number" value={cadenceDays} onChange={(e) => setCadenceDays(Number(e.target.value))} className="w-12 p-1 border rounded text-center font-bold" />
                        <span>days after completion</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-white p-3 rounded border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-gray-700">Chained Workflow Steps ({chainedSteps.length})</h4>
                      <button type="button" onClick={handleAddChainedStep} className="text-[10px] font-bold bg-[#A9B1A6] text-white px-2 py-0.5 rounded">+ Step</button>
                    </div>

                    {chainedSteps.map((step, idx) => (
                      <div key={idx} className="bg-gray-50 p-2 rounded border border-gray-200 mb-2 flex flex-col gap-1.5">
                        <div className="flex justify-between font-bold text-gray-600">
                          <span>Step {idx + 1} Follow-up</span>
                          <button type="button" onClick={() => handleRemoveChainedStep(idx)} className="text-red-600">Remove</button>
                        </div>
                        <input type="text" value={step.title} onChange={(e) => handleUpdateChainedStep(idx, 'title', e.target.value)} placeholder="Step Title" className="p-1 border rounded bg-white" />
                        <div className="flex gap-2">
                          <input type="number" value={step.relativeDays} onChange={(e) => handleUpdateChainedStep(idx, 'relativeDays', Number(e.target.value))} className="w-12 p-1 border rounded bg-white text-center font-bold" />
                          <span className="self-center">days after</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white p-3 rounded border border-gray-200 flex justify-between">
                    <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                      <input type="checkbox" checked={requiresPhoto} onChange={(e) => setRequiresPhoto(e.target.checked)} className="accent-[#A9B1A6]" /> Require Photo
                    </label>
                    <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                      <input type="checkbox" checked={requiresComment} onChange={(e) => setRequiresComment(e.target.checked)} className="accent-[#A9B1A6]" /> Require Comment
                    </label>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-gray-300 mt-2">
                {userRole === 'admin' && !isCurrentInstanceCompleted && (
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditing(!isEditing)} className="text-xs text-blue-700 font-bold hover:underline">
                      {isEditing ? 'Cancel Edit' : 'Full Edit Settings'}
                    </button>
                    <button onClick={() => handleDeleteTask(selectedTask.id)} className="text-xs text-red-600 font-bold hover:underline">
                      Delete Rule
                    </button>
                  </div>
                )}

                {userRole === 'admin' && isCurrentInstanceCompleted && (
                  <button onClick={() => handleReopenTask(selectedTask.id)} className="text-xs text-amber-700 font-bold hover:underline">Reopen Occurrence</button>
                )}
                
                <div className="flex gap-2 ml-auto">
                  {isEditing ? (
                    <button onClick={handleSaveChanges} className="bg-[#333333] text-white px-4 py-2 rounded text-xs font-bold hover:bg-black transition">
                      Save All Changes
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

        {/* RECURRING TASK RESCHEDULE SCOPE PROMPT MODAL */}
        {reschedulePrompt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white max-w-md w-full rounded-lg shadow-2xl p-6 border border-gray-300 flex flex-col gap-4 animate-fade-in">
              <div className="border-b pb-2">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Recurring Task Reschedule</span>
                <h3 className="text-xl font-serif font-bold text-gray-900 mt-0.5">{reschedulePrompt.task.title}</h3>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                You are moving a recurring task to <strong>{reschedulePrompt.targetDate}</strong>
                {reschedulePrompt.targetHour !== null && ` at ${decimalToTimeString(reschedulePrompt.targetHour)}`}. How would you like to apply this change?
              </p>

              <div className="flex flex-col gap-2 mt-2">
                <button 
                  onClick={() => applyTaskMove(reschedulePrompt.task.id, reschedulePrompt.targetDate, reschedulePrompt.targetHour, reschedulePrompt.targetMemberName, false)}
                  className="bg-[#A9B1A6] text-white py-2.5 px-4 rounded text-xs font-bold hover:bg-gray-600 transition text-left flex justify-between items-center">
                  <span>Only This Occurrence</span>
                  <span className="text-[10px] opacity-80">(Creates standalone task)</span>
                </button>

                <button 
                  onClick={() => applyTaskMove(reschedulePrompt.task.id, reschedulePrompt.targetDate, reschedulePrompt.targetHour, reschedulePrompt.targetMemberName, true)}
                  className="bg-[#333333] text-white py-2.5 px-4 rounded text-xs font-bold hover:bg-black transition text-left flex justify-between items-center">
                  <span>Entire Series / Future Tasks</span>
                  <span className="text-[10px] opacity-80">(Updates master rule)</span>
                </button>
              </div>

              <div className="pt-2 border-t flex justify-end">
                <button onClick={() => setReschedulePrompt(null)} className="text-xs text-gray-500 font-bold hover:underline">Cancel Move</button>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS & GOVERNANCE MODAL */}
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-end p-4 z-50">
            <div className="bg-[#F4F3ED] max-w-md w-full h-full rounded-l-lg shadow-2xl p-6 border-l border-gray-300 flex flex-col gap-4 animate-fade-in overflow-y-auto">
              <div className="flex justify-between items-center border-b border-gray-300 pb-3">
                <div>
                  <span className="text-xs font-bold text-[#A9B1A6] uppercase tracking-wider">System Governance</span>
                  <h2 className="text-2xl font-serif font-bold text-gray-900">Settings & Team</h2>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
              </div>

              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500">Active Team Members</h4>
                  <button 
                    onClick={resetMemberForm} 
                    className="text-xs font-bold bg-[#A9B1A6] text-white px-2 py-0.5 rounded hover:bg-gray-600 transition">
                    + Add New
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {teamMembers.map(member => (
                    <div key={member.id} className="flex justify-between items-center p-2 rounded bg-gray-50 border border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: member.color }}></span>
                        <div>
                          <span className="font-bold text-xs text-gray-800 block">{member.name} ({member.role.toUpperCase()})</span>
                          <span className="text-[10px] text-gray-500">{member.email}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleOpenEditMember(member)} 
                        className="text-xs font-bold text-blue-700 hover:underline">
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col gap-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700 border-b pb-1">
                  {editingMemberId ? 'Edit Team Member Profile' : 'Create New Team Member'}
                </h4>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
                  <input 
                    type="text" 
                    value={memberName} 
                    onChange={(e) => setMemberName(e.target.value)} 
                    placeholder="e.g. Jordan Smith" 
                    className="w-full p-2 text-xs border border-gray-300 rounded focus:outline-none" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label>
                  <input 
                    type="email" 
                    value={memberEmail} 
                    onChange={(e) => setMemberEmail(e.target.value)} 
                    placeholder="jordan@company.com" 
                    className="w-full p-2 text-xs border border-gray-300 rounded focus:outline-none" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
                  <div className="relative flex items-center">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      value={memberPassword} 
                      onChange={(e) => setMemberPassword(e.target.value)} 
                      placeholder="••••••••" 
                      className="w-full p-2 text-xs border border-gray-300 rounded focus:outline-none pr-12" />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 text-[10px] font-bold text-gray-500 hover:text-gray-800">
                      {showPassword ? 'HIDE' : 'SHOW'}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-1/2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Role / Access</label>
                    <select 
                      value={memberRole} 
                      onChange={(e) => setMemberRole(e.target.value)} 
                      className="w-full p-2 text-xs border border-gray-300 rounded bg-white">
                      <option value="admin">Admin (Master)</option>
                      <option value="assignee">Assignee (Worker)</option>
                    </select>
                  </div>

                  <div className="w-1/2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Assigned Color</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={memberColor} 
                        onChange={(e) => setMemberColor(e.target.value)} 
                        className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0 bg-white" />
                      <span className="text-xs font-mono font-bold text-gray-600">{memberColor}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200">
                  {editingMemberId && (
                    <button 
                      onClick={() => handleDeleteMember(editingMemberId, memberName)}
                      className="text-xs text-red-600 font-bold hover:underline">
                      Delete Profile
                    </button>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <button 
                      onClick={resetMemberForm}
                      className="px-3 py-1.5 rounded text-xs font-bold text-gray-500 hover:bg-gray-100">
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveMember}
                      className="bg-[#333333] text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-black transition">
                      {editingMemberId ? 'Update Profile' : 'Add Member'}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}