// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient'
import Auth from './Auth'

// --- SUPABASE DATABASE MAPPERS (camelCase <-> snake_case) ---
const mapToDb = (t) => ({
  id: String(t.id),
  title: t.title || '',
  description: t.desc || '',
  company: t.company || '',
  assignees: t.assignees || [],
  date: t.date || null,
  date_scheduled: t.date || null,
  start_time: t.startTime || null,
  end_time: t.endTime || null,
  start_hour: t.startHour ?? null,
  duration: t.duration ?? null,
  time_label: t.timeLabel || 'All-Day',
  priority: t.priority || 'Medium',
  type: t.type || 'flexible',
  status: t.status || 'pending',
  requires_photo: t.requiresPhoto ?? false,
  requires_comment: t.requiresComment ?? false,
  allow_deadline_change: t.allowAssigneeDeadlineChange ?? false,
  recurrence_type: t.recurrenceType || 'once',
  active_days: t.activeDays || [],
  cadence_days: t.cadenceDays ?? 14,
  notify_on_complete: t.notifyOnComplete ?? true,
  notify_on_comment: t.notifyOnComment ?? true,
  notify_on_deadline_change: t.notifyOnDeadlineChange ?? true,
  notify_on_task_created: t.notifyOnTaskCreated ?? true,
  parent_task_id: t.parentTaskId ? String(t.parentTaskId) : null,
  parent_task_title: t.parentTaskTitle || null,
  parent_instance_date: t.parentInstanceDate || null,
  comments: t.comments || [],
  chained_steps: t.chainedSteps || [],
  completed_dates: t.completedDates || [],
  exception_dates: t.exceptionDates || [],
  is_overdue: t.isOverdue ?? false,
  overdue_notified: t.overdueNotified ?? false
});

const mapFromDb = (r) => ({
  id: String(r.id),
  title: r.title || '',
  desc: r.description || '',
  company: r.company || '',
  assignees: r.assignees || [],
  date: r.date || r.date_scheduled || '',
  startTime: r.start_time,
  endTime: r.end_time,
  startHour: r.start_hour ? Number(r.start_hour) : null,
  duration: r.duration ? Number(r.duration) : null,
  timeLabel: r.time_label || 'All-Day',
  priority: r.priority || 'Medium',
  type: r.type || 'flexible',
  status: r.status || 'pending',
  requiresPhoto: r.requires_photo ?? false,
  requiresComment: r.requires_comment ?? false,
  allowAssigneeDeadlineChange: r.allow_deadline_change ?? false,
  recurrenceType: r.recurrence_type || 'once',
  activeDays: r.active_days || [],
  cadenceDays: r.cadence_days ?? 14,
  notifyOnComplete: r.notify_on_complete ?? true,
  notifyOnComment: r.notify_on_comment ?? true,
  notifyOnDeadlineChange: r.notify_on_deadline_change ?? true,
  notifyOnTaskCreated: r.notify_on_task_created ?? true,
  parentTaskId: r.parent_task_id,
  parentTaskTitle: r.parent_task_title,
  parentInstanceDate: r.parent_instance_date,
  comments: r.comments || [],
  chainedSteps: r.chained_steps || [],
  completedDates: r.completed_dates || [],
  exceptionDates: r.exception_dates || [],
  isOverdue: r.is_overdue ?? false,
  overdueNotified: r.overdue_notified ?? false
});

export default function App() {
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const [currentView, setCurrentView] = useState('list');
  const [previousView, setPreviousView] = useState('list');
  const [userRole, setUserRole] = useState('employee');
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [activeEmployeeFilters, setActiveEmployeeFilters] = useState([]);

  // FETCH LIVE TEAM MEMBERS AND CURRENT USER PROFILE FROM DATABASE
  useEffect(() => {
    async function loadProfiles() {
      const { data: allProfiles, error: teamErr } = await supabase
        .from('profiles')
        .select('*');

      if (allProfiles && !teamErr) {
        const mappedMembers = allProfiles.map(p => ({
          id: p.id,
          name: p.name || p.email.split('@')[0],
          initials: p.initials || p.email.substring(0, 2).toUpperCase(),
          email: p.email,
          role: p.role || 'employee',
          color: p.color || '#2A9D8F'
        }));
        setTeamMembers(mappedMembers);
        setActiveEmployeeFilters(mappedMembers.map(m => m.name));
      }

      if (session?.user?.id) {
        const { data: myProfile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (myProfile && !profileErr) {
          setUserRole(myProfile.role || 'employee');
          setCurrentProfile({
            id: myProfile.id,
            name: myProfile.name || myProfile.email.split('@')[0],
            initials: myProfile.initials || myProfile.email.substring(0, 2).toUpperCase(),
            email: myProfile.email,
            role: myProfile.role || 'employee',
            color: myProfile.color || '#2A9D8F'
          });
        }
      }
    }

    if (session) {
      loadProfiles();
    }
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState(null);

  const [companies, setCompanies] = useState(['Sparkulous', 'Casovera', 'TMFLO', 'Leprino Personal']);
  const [activeCompanyFilters, setActiveCompanyFilters] = useState(['Sparkulous', 'Casovera', 'TMFLO', 'Leprino Personal']);
  const [newCompanyInput, setNewCompanyInput] = useState('');

  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [memberRole, setMemberRole] = useState('employee');
  const [memberColor, setMemberColor] = useState('#2A9D8F');
  const [showPassword, setShowPassword] = useState(false);

  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedInstanceDate, setSelectedInstanceDate] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskCompany, setTaskCompany] = useState(''); 
  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskDate, setTaskDate] = useState('');
  const [hasSpecificTime, setHasSpecificTime] = useState(false); 
  const [startTime, setStartTime] = useState('13:00');
  const [endTime, setEndTime] = useState('14:00');

  const [recurrenceType, setRecurrenceType] = useState('once');
  const [activeDays, setActiveDays] = useState(['Fri']);
  const [generationTime, setGenerationTime] = useState('13:00');
  const [cadenceDays, setCadenceDays] = useState(14);

  const [chainedSteps, setChainedSteps] = useState([]);
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [requiresComment, setRequiresComment] = useState(false);
  const [allowAssigneeDeadlineChange, setAllowAssigneeDeadlineChange] = useState(false);

  const [notifyOnComplete, setNotifyOnComplete] = useState(true); 
  const [notifyOnComment, setNotifyOnComment] = useState(true);   
  const [notifyOnDeadlineChange, setNotifyOnDeadlineChange] = useState(true); 
  const [notifyOnTaskCreated, setNotifyOnTaskCreated] = useState(true); 
  
  const [openCommentInput, setExecutionComment] = useState('');
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [additionalNote, setAdditionalNote] = useState('');

  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [draggedInstanceDate, setDraggedInstanceDate] = useState(null);
  const [hoverSlot, setHoverSlot] = useState(null);
  const [reschedulePrompt, setReschedulePrompt] = useState(null);
  const [resizingTaskId, setResizingTaskId] = useState(null);
  const resizeStateRef = useRef(null);
  const [completionPrompt, setCompletionPrompt] = useState(null);

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const minuteSubSlots = [0, 0.25, 0.5, 0.75];

  // LIVE DATABASE FETCHING WITH SESSION-GATED REALTIME SUBSCRIPTION
  const [tasks, setTasks] = useState([]);
  const [isDbLoading, setIsDbLoading] = useState(true);

  useEffect(() => {
    if (!session) return;

    const fetchCloudData = async () => {
      const { data, error } = await supabase.from('tasks').select('*');
      if (error) {
        console.error('Error fetching tasks from cloud:', error);
      } else if (data) {
        setTasks(data.map(mapFromDb));
      }
      setIsDbLoading(false);
    };

    fetchCloudData();

    // AUTHENTICATED REALTIME CHANNEL PER USER
    const channel = supabase
      .channel(`tasks-realtime-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          console.log('⚡ Realtime event received:', payload);
          fetchCloudData();
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime Subscription Status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

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
    if (currentView === 'day' || (currentView === 'list' && userRole !== 'admin')) {
      d.setDate(d.getDate() - 1);
    } else if (currentView === 'week' || (currentView === 'list' && userRole === 'admin')) {
      d.setDate(d.getDate() - 7);
    } else if (currentView === 'month') {
      d.setMonth(d.getMonth() - 1);
    }
    setCurrentDate(d);
  };

  const handleNextDate = () => {
    const d = new Date(currentDate);
    if (currentView === 'day' || (currentView === 'list' && userRole !== 'admin')) {
      d.setDate(d.getDate() + 1);
    } else if (currentView === 'week' || (currentView === 'list' && userRole === 'admin')) {
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

    if (currentView === 'day' || (currentView === 'list' && userRole !== 'admin')) {
      return `${dayNames[currentDate.getDay()]}, ${monthNames[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
    }

    if (currentView === 'week' || (currentView === 'list' && userRole === 'admin')) {
      let start = new Date(currentDate);
      if (currentView === 'list') {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
      } else {
        start = getWeekStart(currentDate);
      }
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `Week of ${monthNames[start.getMonth()].slice(0, 3)} ${start.getDate()} - ${monthNames[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;
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

  const handleOpenCreateView = () => {
    setPreviousView(currentView);
    resetForm();
    setCurrentView('create');
  };

  const computeDynamicLayouts = (colTasks) => {
    if (!colTasks || colTasks.length === 0) return {};

    const items = colTasks.map(t => {
      const isFlex = (t.type === 'flexible' || t.startHour === null || t.startHour === undefined);
      const start = isFlex ? gridStartHour : Number(t.startHour || gridStartHour);
      const dur = isFlex ? (gridEndHour - gridStartHour + 1) : Number(t.duration || 1.0);
      return { id: t.id, start, end: start + dur, isFlex, task: t };
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
            width: `calc(${widthPct}% - 12px)`,
            startPx: (item.start - gridStartHour) * 80,
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

  const handleResizeStart = (e, task, edge) => {
    e.stopPropagation();
    e.preventDefault(); 
    if (userRole !== 'admin') return;

    resizeStateRef.current = {
      id: task.id,
      edge,
      initialStartHour: task.startHour,
      initialDuration: task.duration,
      initialMouseY: e.clientY
    };
    setResizingTaskId(task.id);
  };

  useEffect(() => {
    const handleMove = (e) => {
      if (!resizeStateRef.current) return;
      const state = resizeStateRef.current;
      
      const deltaY = e.clientY - state.initialMouseY;
      const deltaHours = Math.round(deltaY / 20) * 0.25;

      let newStartHour = state.initialStartHour;
      let newDuration = state.initialDuration;

      if (state.edge === 'top') {
        newStartHour = state.initialStartHour + deltaHours;
        newDuration = state.initialDuration - deltaHours;
        if (newDuration < 0.5) {
          newDuration = 0.5;
          newStartHour = state.initialStartHour + state.initialDuration - 0.5;
        }
        if (newStartHour < 0) {
          newStartHour = 0;
          newDuration = state.initialStartHour + state.initialDuration;
        }
      } else {
        newDuration = state.initialDuration + deltaHours;
        if (newDuration < 0.5) newDuration = 0.5;
        if (state.initialStartHour + newDuration > 24) {
          newDuration = 24 - state.initialStartHour;
        }
      }

      setTasks(prevTasks => prevTasks.map(t => {
        if (t.id === state.id) {
          const sStr = decimalToTimeString(newStartHour);
          const eStr = decimalToTimeString(newStartHour + newDuration);
          return {
            ...t,
            startHour: newStartHour,
            duration: newDuration,
            startTime: sStr,
            endTime: eStr,
            timeLabel: formatTimeLabel(sStr, eStr)
          };
        }
        return t;
      }));
    };

    const handleUp = async () => {
      if (resizeStateRef.current) {
        const state = resizeStateRef.current;
        const resizedTask = tasks.find(t => t.id === state.id);
        if (resizedTask) {
          await supabase.from('tasks').update(mapToDb(resizedTask)).eq('id', resizedTask.id);

          setNotifications(prev => [
            { id: Date.now() + Math.random(), text: `⏱️ Time Slot Adjusted: "${resizedTask.title}" duration modified`, type: 'update', recipientRole: 'employee', read: false, time: 'Just now' },
            ...prev
          ]);
        }
        resizeStateRef.current = null;
        setResizingTaskId(null);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [tasks]);

  useEffect(() => {
    const todayStr = formatDateKey(new Date());

    setTasks(prevTasks => {
      let changed = false;
      const updated = prevTasks.map(task => {
        const isPastDue = task.date && task.date < todayStr && task.status !== 'completed';

        if (isPastDue && !task.overdueNotified) {
          changed = true;
          const assigneeLabel = task.assignees && task.assignees.length > 0 ? task.assignees.join(', ') : 'Unassigned';
          const notifMsg = `⚠️ OVERDUE: "${task.title}" (${assigneeLabel}) was not completed by ${task.date}`;

          setNotifications(prev => [
            { id: Date.now() + Math.random(), text: notifMsg, type: 'overdue', recipientRole: 'admin', read: false, time: 'Just now' },
            ...prev
          ]);
          return { ...task, isOverdue: true, overdueNotified: true };
        } else if (!isPastDue && task.isOverdue) {
          changed = true;
          return { ...task, isOverdue: false, overdueNotified: false };
        }
        return task;
      });

      if (changed) {
        updated.forEach(t => {
          if (t.isOverdue || t.overdueNotified) {
            supabase.from('tasks').update({ is_overdue: t.isOverdue, overdue_notified: t.overdueNotified }).eq('id', t.id);
          }
        });
      }

      return changed ? updated : prevTasks;
    });
  }, []);

  const handleDragStart = (e, taskId, sourceDate = null) => {
    if (userRole !== 'admin') return;
    setDraggedTaskId(taskId);
    setDraggedInstanceDate(sourceDate);
    
    const payload = JSON.stringify({ taskId, sourceDate });
    e.dataTransfer.setData('text/plain', payload);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    if (userRole !== 'admin') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDraggedInstanceDate(null);
    setHoverSlot(null);
  };

  const handleSubSlotDragOver = (e, dateStr, targetHour, memberName) => {
    if (userRole !== 'admin' || !draggedTaskId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    setHoverSlot(prev => {
      if (prev && prev.dateStr === dateStr && prev.targetHour === targetHour && prev.memberName === memberName) return prev;
      return { dateStr, targetHour, memberName };
    });
  };

  const applyTaskMove = async (taskId, targetDate, targetHour, targetMemberName, updateSeries = false, sourceDateFromPrompt = null) => {
    const todayStr = formatDateKey(new Date());
    let dbPayloads = [];

    setTasks(prevTasks => {
      const targetTask = prevTasks.find(t => t.id === taskId);
      if (!targetTask) return prevTasks;

      const isFlex = targetTask.type === 'flexible' || targetTask.startHour === null || targetTask.startHour === undefined;
      
      let startDec = targetTask.startHour;
      let dur = targetTask.duration || 1;
      let sStr = targetTask.startTime;
      let eStr = targetTask.endTime;
      let label = targetTask.timeLabel;

      if (!isFlex && targetHour !== null) {
        startDec = targetHour;
        sStr = decimalToTimeString(startDec);
        eStr = decimalToTimeString(startDec + dur);
        label = formatTimeLabel(sStr, eStr);
      }

      const effectiveSourceDate = sourceDateFromPrompt || targetTask.date;

      setNotifications(prev => [
        { id: Date.now() + Math.random(), text: `📅 Schedule Shifted: "${targetTask.title}" moved to ${targetDate}`, type: 'update', recipientRole: 'employee', read: false, time: 'Just now' },
        ...prev
      ]);

      if (targetTask.recurrenceType !== 'once' && !updateSeries) {
        const standaloneTask = {
          ...targetTask,
          id: Date.now().toString(),
          date: targetDate,
          assignees: targetMemberName ? [targetMemberName] : (targetTask.assignees || []),
          startHour: startDec,
          duration: dur,
          startTime: sStr,
          endTime: eStr,
          timeLabel: label,
          type: isFlex ? 'flexible' : 'timed',
          recurrenceType: 'once',
          exceptionDates: [],
          isOverdue: targetDate < todayStr,
          overdueNotified: targetDate < todayStr
        };

        return prevTasks.map(t => {
          if (t.id === taskId) {
            const currentExceptions = t.exceptionDates || [];
            const updatedExceptions = effectiveSourceDate && !currentExceptions.includes(effectiveSourceDate) ? [...currentExceptions, effectiveSourceDate] : currentExceptions;
            const updatedMaster = { ...t, exceptionDates: updatedExceptions };
            dbPayloads.push({ action: 'update', payload: updatedMaster });
            dbPayloads.push({ action: 'insert', payload: standaloneTask });
            return updatedMaster;
          }
          return t;
        }).concat(standaloneTask);
      }

      if (targetTask.recurrenceType !== 'once' && updateSeries) {
        const parts = targetDate.split('-');
        const targetD = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const targetDayName = !isNaN(targetD.getTime()) ? daysOfWeek[targetD.getDay()] : (targetTask.activeDays?.[0] || 'Mon');

        const newMasterTask = {
          ...targetTask,
          id: Date.now().toString(),
          date: targetDate,
          seriesStartDate: targetDate, 
          activeDays: [targetDayName],
          assignees: targetMemberName ? [targetMemberName] : (targetTask.assignees || []),
          startHour: startDec,
          duration: dur,
          startTime: sStr,
          endTime: eStr,
          timeLabel: label,
          type: isFlex ? 'flexible' : 'timed',
          exceptionDates: [],
          completedDates: [],
          endDate: null 
        };

        return prevTasks.map(t => {
          if (t.id === taskId) {
            const cappedMaster = { ...t, endDate: effectiveSourceDate ? addDaysToDateStr(effectiveSourceDate, -1) : addDaysToDateStr(targetDate, -1) };
            dbPayloads.push({ action: 'update', payload: cappedMaster });
            dbPayloads.push({ action: 'insert', payload: newMasterTask });
            return cappedMaster;
          }
          return t;
        }).concat(newMasterTask);
      }

      return prevTasks.map(t => {
        if (t.id === taskId) {
          const newIsOverdue = targetDate < todayStr && t.status !== 'completed';
          const updatedStandard = {
            ...t,
            date: targetDate,
            assignees: targetMemberName ? [targetMemberName] : (t.assignees || []),
            startHour: startDec,
            duration: dur,
            startTime: sStr,
            endTime: eStr,
            timeLabel: label,
            type: isFlex ? 'flexible' : 'timed',
            isOverdue: newIsOverdue,
            overdueNotified: newIsOverdue
          };
          dbPayloads.push({ action: 'update', payload: updatedStandard });
          return updatedStandard;
        }
        return t;
      });
    });

    for (const job of dbPayloads) {
      const dbData = mapToDb(job.payload);
      if (job.action === 'update') await supabase.from('tasks').update(dbData).eq('id', job.payload.id);
      if (job.action === 'insert') await supabase.from('tasks').insert(dbData);
    }

    setReschedulePrompt(null);
    setDraggedTaskId(null);
    setDraggedInstanceDate(null);
    setHoverSlot(null);
  };

  const handleDropSlot = (e, targetDate, targetHour = null, targetMemberName = null) => {
    if (userRole !== 'admin') return;
    e.preventDefault();
    
    let taskId, sourceDate;
    const data = e.dataTransfer.getData('text/plain');
    if (data) {
      try {
        const payload = JSON.parse(data);
        taskId = payload.taskId;
        sourceDate = payload.sourceDate;
      } catch (err) {
        taskId = data;
      }
    }
    
    if (!taskId) taskId = draggedTaskId;
    if (!sourceDate) sourceDate = draggedInstanceDate;

    const task = tasks.find(t => t.id === taskId);
    setHoverSlot(null);

    if (!task) return;

    if (task.recurrenceType !== 'once') {
      setReschedulePrompt({ 
        task, 
        targetDate, 
        targetHour, 
        targetMemberName,
        sourceDate: sourceDate || targetDate
      });
    } else {
      applyTaskMove(taskId, targetDate, targetHour, targetMemberName, false, sourceDate);
    }
  };

  const resetMemberForm = () => {
    setMemberName('');
    setMemberEmail('');
    setMemberPassword('');
    setMemberRole('employee');
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

  const handleSaveMember = async () => {
    if (!memberName.trim()) return alert('Please enter a name.');

    const initials = memberName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    if (editingMemberId) {
      await supabase.from('profiles').update({
        name: memberName,
        initials,
        role: memberRole,
        color: memberColor
      }).eq('id', editingMemberId);
    }

    const { data: updatedProfiles } = await supabase.from('profiles').select('*');
    if (updatedProfiles) {
      setTeamMembers(updatedProfiles.map(p => ({
        id: p.id,
        name: p.name || p.email.split('@')[0],
        initials: p.initials || p.email.substring(0, 2).toUpperCase(),
        email: p.email,
        role: p.role || 'employee',
        color: p.color || '#2A9D8F'
      })));
    }

    resetMemberForm();
  };

  const handleDeleteMember = async (id, name) => {
    if (teamMembers.length <= 1) return alert('At least one team member must remain.');
    await supabase.from('profiles').delete().eq('id', id);
    setTeamMembers(teamMembers.filter(m => m.id !== id));
    setActiveEmployeeFilters(activeEmployeeFilters.filter(n => n !== name));
    resetMemberForm();
  };

  const resetForm = () => {
    setTaskTitle('');
    setTaskDesc('');
    setTaskCompany(''); 
    setSelectedAssignees([]);
    setTaskPriority('Medium');
    setTaskDate(formatDateKey(currentDate));
    setHasSpecificTime(false); 
    setStartTime('09:00');
    setEndTime('11:00');
    setRecurrenceType('once');
    setActiveDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setGenerationTime('13:00');
    setCadenceDays(14);
    setChainedSteps([]);
    setRequiresPhoto(false);
    setRequiresComment(false);
    setAllowAssigneeDeadlineChange(false);
    setNotifyOnComplete(true); 
    setNotifyOnComment(true);   
    setNotifyOnDeadlineChange(true);
    setNotifyOnTaskCreated(true);
  };

  const handleAddChainedStep = () => {
    setChainedSteps([...chainedSteps, { title: '', desc: '', relativeDays: 1, assignee: 'Same as Parent', priority: 'Medium', requiresPhoto: false, requiresComment: false }]);
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

  const toggleCompanyFilter = (comp) => {
    if (activeCompanyFilters.includes(comp)) {
      if (activeCompanyFilters.length === 1) return;
      setActiveCompanyFilters(activeCompanyFilters.filter(c => c !== comp));
    } else {
      setActiveCompanyFilters([...activeCompanyFilters, comp]);
    }
  };

  const toggleDay = (day) => {
    setActiveDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const getMemberConfig = (name) => {
    const found = teamMembers.find(m => m.name === name);
    if (found) {
      return { name: found.name, initials: found.initials, color: found.color, badgeBg: found.color + '20', badgeText: found.color };
    }
    return { name: name || 'Unassigned', initials: '??', color: '#6B7280', badgeBg: '#F3F4F6', badgeText: '#374151' };
  };

  const handleAddAssignee = (name) => {
    if (name && !selectedAssignees.includes(name)) setSelectedAssignees([...selectedAssignees, name]);
  };

  const handleRemoveAssignee = (name) => {
    setSelectedAssignees(selectedAssignees.filter(a => a !== name));
  };

  const handleDeployTask = async () => {
    if (!taskTitle.trim()) return alert('Please provide a task title.');
    if (!taskCompany) return alert('Please select a company for this task.');

    const startDec = timeToDecimal(startTime);
    const endDec = timeToDecimal(endTime);
    const dur = Math.max(0.5, endDec - startDec);

    const newTask = {
      id: Date.now().toString(),
      title: taskTitle,
      desc: taskDesc,
      company: taskCompany,
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
      allowAssigneeDeadlineChange,
      recurrenceType,
      activeDays: recurrenceType === 'fixed' ? activeDays : [],
      cadenceDays: Number(cadenceDays),
      completedDates: [],
      exceptionDates: [],
      chainedSteps: chainedSteps.filter(s => s.title.trim() !== ''),
      type: hasSpecificTime ? 'timed' : 'flexible',
      status: 'pending',
      notifyOnComplete,
      notifyOnComment,
      notifyOnDeadlineChange,
      notifyOnTaskCreated,
      comments: []
    };

    setTasks([newTask, ...tasks]);

    const { error } = await supabase.from('tasks').insert(mapToDb(newTask));
    if (error) {
      console.error('Supabase Insert Error:', error);
      alert(`Cloud sync error: ${error.message}`);
    }

    setNotifications(prev => [
      { id: Date.now() + Math.random(), text: `📋 New Task Assigned: "${taskTitle}" (${taskCompany})`, type: 'created', recipientRole: 'employee', read: false, time: 'Just now' },
      ...prev
    ]);

    resetForm();
    setCurrentView(previousView);
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
    setTaskCompany(task.company || '');
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
    setAllowAssigneeDeadlineChange(task.allowAssigneeDeadlineChange || false);
    setNotifyOnComplete(task.notifyOnComplete ?? true);
    setNotifyOnComment(task.notifyOnComment ?? true);
    setNotifyOnDeadlineChange(task.notifyOnDeadlineChange ?? true);
    setNotifyOnTaskCreated(task.notifyOnTaskCreated ?? true);
    setChainedSteps(task.chainedSteps || []);
  };

  const handleSaveChanges = async () => {
    if (!taskTitle.trim()) return alert('Title cannot be empty.');
    if (!taskCompany) return alert('Please select a company for this task.');

    const startDec = timeToDecimal(startTime);
    const endDec = timeToDecimal(endTime);
    const dur = Math.max(0.5, endDec - startDec);
    const todayStr = formatDateKey(new Date());
    const isStillOverdue = taskDate < todayStr && selectedTask.status !== 'completed';

    const updatedTask = {
      ...selectedTask,
      title: taskTitle,
      desc: taskDesc,
      company: taskCompany,
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
      allowAssigneeDeadlineChange,
      notifyOnComplete,
      notifyOnComment,
      notifyOnDeadlineChange,
      notifyOnTaskCreated,
      chainedSteps: chainedSteps.filter(s => s.title.trim() !== ''),
      isOverdue: isStillOverdue,
      overdueNotified: isStillOverdue
    };

    setTasks(tasks.map(t => t.id === selectedTask.id ? updatedTask : t));

    const { error } = await supabase.from('tasks').update(mapToDb(updatedTask)).eq('id', updatedTask.id);
    if (error) {
      console.error('Supabase Update Error:', error);
      alert(`Cloud sync error: ${error.message}`);
    }

    setNotifications(prev => [
      { id: Date.now() + Math.random(), text: `✏️ Task Updated: "${taskTitle}" (Details/Deadline modified by Admin)`, type: 'update', recipientRole: 'employee', read: false, time: 'Just now' },
      ...prev
    ]);

    setSelectedTask(updatedTask);
    setIsEditing(false);
  };

  const handleDeleteTask = async (id) => {
    setTasks(tasks.filter(t => t.id !== id));
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) console.error('Supabase Delete Error:', error);
    setSelectedTask(null);
  };

  const currentUserName = currentProfile?.name || session?.user?.email?.split('@')[0] || '';

  const handlePostOpenComment = async (id) => {
    if (!openCommentInput.trim()) return;
    const commentText = `${userRole === 'admin' ? 'Admin' : currentUserName} (${selectedInstanceDate}): ${openCommentInput}`;
    
    setTasks(tasks.map(t => t.id === id ? { ...t, comments: [...(t.comments || []), commentText] } : t));
    setSelectedTask(prev => ({ ...prev, comments: [...(prev.comments || []), commentText] }));
    
    const target = tasks.find(t => t.id === id);
    if (target) {
      const updatedComments = [...(target.comments || []), commentText];
      await supabase.from('tasks').update({ comments: updatedComments }).eq('id', id);
    }

    if (userRole === 'employee' && selectedTask?.notifyOnComment !== false) {
      setNotifications(prev => [{ id: Date.now() + Math.random(), text: `💬 New Note on "${selectedTask.title}" by ${currentUserName}`, type: 'comment', recipientRole: 'admin', read: false, time: 'Just now' }, ...prev]);
    }

    setExecutionComment('');
  };

  const handleInitiateCompletion = () => {
    const hasAttachments = selectedTask.comments && selectedTask.comments.some(c => c.includes('📎 Proof Attached'));
    
    if (selectedTask.requiresPhoto && !photoUploaded && !hasAttachments) {
      return alert('Mandatory proof attachment required before completing this task.');
    }
    if (selectedTask.requiresComment && !openCommentInput.trim() && (!selectedTask.comments || selectedTask.comments.length === 0)) {
      return alert('Execution notes required to complete this task.');
    }
    
    setCompletionPrompt({
      showForm: false,
      title: '', 
      desc: '',
      assignee: selectedTask.assignees[0] || (teamMembers[0]?.name || currentUserName),
      targetDate: formatDateKey(new Date()) 
    });
  };

  const executeCompletion = async (withFollowUp) => {
    const noteText = openCommentInput.trim() 
      ? `${userRole === 'admin' ? 'Admin' : currentUserName} (${selectedInstanceDate}): ${openCommentInput}`
      : null;

    if (withFollowUp && completionPrompt) {
      if (!completionPrompt.title.trim()) {
        return alert("Please enter a title for the sub task.");
      }
    }

    let updatedTasks = tasks.map(t => {
      if (t.id === selectedTask.id) {
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

    if (selectedTask?.notifyOnComplete !== false) {
      setNotifications(prev => [{ id: Date.now() + Math.random(), text: `✓ Task Completed: "${selectedTask.title}" by ${currentUserName}`, type: 'completion', recipientRole: 'admin', read: false, time: 'Just now' }, ...prev]);
    }

    const payloadQueue = [];

    if (withFollowUp && completionPrompt) {
      const targetDate = completionPrompt.targetDate || formatDateKey(new Date());
      const newAdHocTask = {
        id: Date.now().toString(),
        title: completionPrompt.title,
        desc: completionPrompt.desc || `Ad-hoc sub task from: "${selectedTask.title}"`,
        company: selectedTask.company,
        assignees: [completionPrompt.assignee],
        date: targetDate,
        startTime: null,
        endTime: null,
        startHour: null,
        duration: null,
        timeLabel: 'Unscheduled',
        priority: selectedTask.priority || 'Medium',
        requiresPhoto: false,
        requiresComment: false,
        allowAssigneeDeadlineChange: false,
        recurrenceType: 'once',
        activeDays: [],
        cadenceDays: 14,
        completedDates: [],
        exceptionDates: [],
        chainedSteps: [],
        type: 'flexible',
        status: 'pending',
        isOverdue: false,
        parentTaskId: selectedTask.id,
        parentTaskTitle: selectedTask.title,
        parentInstanceDate: selectedInstanceDate,
        notifyOnComplete: true,
        notifyOnComment: true,
        notifyOnDeadlineChange: true,
        notifyOnTaskCreated: true,
        comments: [`Auto-deployed via Sub Task prompt upon completion of "${selectedTask.title}"`]
      };

      if (selectedTask?.notifyOnTaskCreated !== false) {
        setNotifications(prev => [{ id: Date.now() + Math.random(), text: `➕ New Sub Task Spawned: "${completionPrompt.title}" for ${targetDate}`, type: 'subtask', recipientRole: 'admin', read: false, time: 'Just now' }, ...prev]);
      }

      updatedTasks = [newAdHocTask, ...updatedTasks];
      payloadQueue.push({ action: 'insert', data: newAdHocTask });
      alert(`Sub task "${completionPrompt.title}" deployed to backlog/schedule for ${targetDate}.`);
    }

    if (selectedTask.recurrenceType === 'completion') {
      const nextDueDate = addDaysToDateStr(selectedInstanceDate, selectedTask.cadenceDays || 14);
      const nextInstanceTask = {
        ...selectedTask,
        id: Date.now().toString(),
        date: nextDueDate,
        completedDates: [],
        exceptionDates: [],
        status: 'pending',
        isOverdue: false,
        comments: [`Auto-deployed ${selectedTask.cadenceDays || 14} days after completion on ${selectedInstanceDate}`]
      };
      updatedTasks = [nextInstanceTask, ...updatedTasks];
      payloadQueue.push({ action: 'insert', data: nextInstanceTask });
    }

    if (selectedTask.chainedSteps && selectedTask.chainedSteps.length > 0) {
      const nextStep = selectedTask.chainedSteps[0];
      const targetDate = addDaysToDateStr(selectedInstanceDate, nextStep.relativeDays || 0);
      const stepAssignees = nextStep.assignee === 'Same as Parent' ? selectedTask.assignees : [nextStep.assignee];

      const chainedTask = {
        id: Date.now().toString(),
        title: nextStep.title || 'Follow-up Task',
        desc: nextStep.desc || `Chained step from completed task: "${selectedTask.title}"`,
        company: selectedTask.company,
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
        allowAssigneeDeadlineChange: false,
        recurrenceType: 'once',
        activeDays: [],
        cadenceDays: 14,
        completedDates: [],
        exceptionDates: [],
        chainedSteps: selectedTask.chainedSteps.slice(1),
        type: 'timed',
        status: 'pending',
        isOverdue: false,
        parentTaskId: selectedTask.id,
        parentTaskTitle: selectedTask.title,
        parentInstanceDate: selectedInstanceDate,
        notifyOnComplete: true,
        notifyOnComment: true,
        notifyOnDeadlineChange: true,
        notifyOnTaskCreated: true,
        comments: [`Auto-deployed via Pre-Configured Workflow from "${selectedTask.title}"`]
      };
      updatedTasks = [chainedTask, ...updatedTasks];
      payloadQueue.push({ action: 'insert', data: chainedTask });
    }

    setTasks(updatedTasks);
    
    const masterTarget = updatedTasks.find(t => t.id === selectedTask.id);
    if (masterTarget) {
      await supabase.from('tasks').update(mapToDb(masterTarget)).eq('id', masterTarget.id);
    }

    for (let p of payloadQueue) {
      await supabase.from('tasks').insert(mapToDb(p.data));
    }

    setCompletionPrompt(null);
    setSelectedTask(null);
  };

  const handleAppendNote = async (id) => {
    if (!additionalNote.trim()) return;
    const noteText = `${userRole === 'admin' ? 'Admin Note' : currentUserName + ' Note'}: ${additionalNote}`;
    setTasks(tasks.map(t => t.id === id ? { ...t, comments: [...(t.comments || []), noteText] } : t));
    
    const target = tasks.find(t => t.id === id);
    if (target) {
      const updatedComments = [...(target.comments || []), noteText];
      await supabase.from('tasks').update({ comments: updatedComments }).eq('id', id);
    }

    setAdditionalNote('');
    setSelectedTask(prev => ({ ...prev, comments: [...(prev.comments || []), noteText] }));
  };

  const handleReopenTask = async (id) => {
    const updated = tasks.map(t => {
      if (t.id === id) {
        if (t.recurrenceType === 'once') return { ...t, status: 'pending' };
        return { ...t, completedDates: (t.completedDates || []).filter(d => d !== selectedInstanceDate) };
      }
      return t;
    });

    setTasks(updated);
    const target = updated.find(t => t.id === id);
    if (target) {
      await supabase.from('tasks').update(mapToDb(target)).eq('id', id);
    }
    setSelectedTask(null);
  };

  const renderComment = (commentText, index) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const hasUrl = urlRegex.test(commentText);

    if (!hasUrl) {
      return (
        <div key={index} className="text-xs text-gray-700 bg-gray-50 p-1.5 rounded border border-gray-100">
          {commentText}
        </div>
      );
    }

    const match = commentText.match(/(https?:\/\/[^\s]+)/);
    const url = match ? match[0] : '';
    const textBeforeUrl = commentText.split(url)[0];
    const isImage = /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(url);

    return (
      <div key={index} className="text-xs text-gray-700 bg-gray-50 p-2 rounded border border-gray-200 flex flex-col gap-1.5">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span className="font-semibold">{textBeforeUrl}</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-blue-600 hover:underline flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0"
          >
            🔗 Open / Download File
          </a>
        </div>
        {isImage && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1">
            <img
              src={url}
              alt="Proof of Work Attachment"
              className="max-h-40 rounded border border-gray-300 object-cover hover:opacity-90 transition shadow-xs"
            />
          </a>
        )}
      </div>
    );
  };

  const markAllNotifsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const roleNotifications = notifications.filter(n => 
    !n.recipientRole || n.recipientRole === 'all' || n.recipientRole === userRole
  );
  const unreadNotifCount = roleNotifications.filter(n => !n.read).length;

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
    : teamMembers.filter(m => m.name === currentUserName);

  const visibleTasks = tasks.filter(t => {
    if (!t || !t.assignees) return false;

    const isAssigneeMatch = userRole === 'admin' 
      ? (t.assignees.length === 0 || t.assignees.some(a => activeEmployeeFilters.includes(a)))
      : t.assignees.includes(currentUserName);

    const isCompanyMatch = activeCompanyFilters.includes(t.company);

    const isSearchMatch = !searchQuery.trim() || 
      (t.title && t.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
      (t.desc && t.desc.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.assignees && t.assignees.some(a => a && a.toLowerCase().includes(searchQuery.toLowerCase())));

    return isAssigneeMatch && isCompanyMatch && isSearchMatch;
  });

  const backlogTasks = tasks.filter(t => (!t.assignees || t.assignees.length === 0) && t.status !== 'completed' && activeCompanyFilters.includes(t.company));

  const isTaskActiveOnDay = (task, dayOfWeekStr, dateStr) => {
    if (!task) return false;
    if (task.completedDates && task.completedDates.includes(dateStr)) return false;
    if (task.exceptionDates && task.exceptionDates.includes(dateStr)) return false; 
    if (task.status === 'completed') return false;

    if (task.endDate && dateStr > task.endDate) return false;

    if (task.recurrenceType === 'fixed') {
      if (task.seriesStartDate && dateStr < task.seriesStartDate) return false;
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

  let gridStartHour = 6;
  let gridEndHour = 20;
  
  const viewTasks = currentView === 'day' 
    ? visibleTasks.filter(t => isTaskActiveOnDay(t, daysOfWeek[currentDate.getDay()], formatDateKey(currentDate)))
    : currentView === 'week'
    ? visibleTasks.filter(t => t.type === 'timed' && t.startHour !== null) 
    : [];

  viewTasks.forEach(t => {
    if (t.type === 'timed' && t.startHour !== null) {
      if (t.startHour < gridStartHour) gridStartHour = Math.floor(t.startHour);
      if (t.startHour + (t.duration || 1) > gridEndHour + 1) gridEndHour = Math.ceil(t.startHour + (t.duration || 1)) - 1;
    }
  });

  if (gridStartHour < 0) gridStartHour = 0;
  if (gridEndHour > 23) gridEndHour = 23;

  const dynamicTimeSlots = Array.from({ length: gridEndHour - gridStartHour + 1 }, (_, i) => gridStartHour + i);

  if (!session) {
    return <Auth />
  }

  if (isDbLoading) return <div className="min-h-screen bg-[#A9B1A6] flex items-center justify-center font-bold text-white tracking-widest uppercase">Initializing Cloud Architecture...</div>;

  return (
    <div className="min-h-screen bg-[#A9B1A6] p-4 sm:p-8 font-sans text-[#333333]">
      <div className="max-w-[95%] mx-auto bg-[#F4F3ED] p-6 rounded-lg shadow-sm min-h-[850px] flex flex-col relative">
        
        {/* REAL USER SESSION HEADER */}
        <div className="bg-[#333333] text-white px-4 py-2 rounded-md mb-4 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-400 uppercase tracking-wider">User:</span>
            <span className="text-white font-semibold">{currentProfile?.name || session?.user?.email}</span>
            <span className="text-gray-500">|</span>
            <span className="font-bold text-gray-400 uppercase tracking-wider">Role:</span>
            <span className="text-amber-400 font-bold uppercase">{userRole}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active & past tasks..." 
              className="px-3 py-1 rounded bg-gray-800 text-white placeholder-gray-400 text-xs focus:outline-none focus:ring-1 focus:ring-[#A9B1A6] w-full sm:w-64" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-white font-bold">✕</button>
            )}
            <button 
              onClick={handleLogout} 
              className="px-3 py-1 font-bold text-white transition bg-red-600 rounded hover:bg-red-700 shrink-0"
            >
              Logout
            </button>
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
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700">Notification Center ({userRole.toUpperCase()})</h4>
                    <button onClick={markAllNotifsRead} className="text-[10px] text-blue-600 font-bold hover:underline">Mark all read</button>
                  </div>
                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                    {roleNotifications.map(n => (
                      <div key={n.id} className={`p-2 rounded text-xs border ${n.read ? 'bg-gray-50 border-gray-100 text-gray-500' : 'bg-blue-50/80 border-blue-200 text-gray-900 font-bold'}`}>
                        <div className="flex justify-between items-start gap-1">
                          <span>{n.text}</span>
                          <span className="text-[9px] text-gray-400 shrink-0">{n.time}</span>
                        </div>
                      </div>
                    ))}
                    {roleNotifications.length === 0 && (
                      <p className="text-xs text-gray-400 italic text-center py-2">No notifications for {userRole}.</p>
                    )}
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
              <button onClick={handleOpenCreateView} className="bg-[#5B7049] text-white px-4 py-2 rounded text-xs font-bold shadow-sm hover:bg-[#465638] transition">
                + New Task
              </button>
            )}
          </div>
        </div>

        {/* TEAM MEMBER & COMPANY FILTER BAR */}
        {userRole === 'admin' && currentView !== 'create' && (
          <div className="bg-white p-3 rounded-lg border border-gray-200 mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Companies:</span>
                <div className="flex flex-wrap gap-1">
                  {companies.map(comp => {
                    const isActive = activeCompanyFilters.includes(comp);
                    return (
                      <button
                        key={comp}
                        onClick={() => toggleCompanyFilter(comp)}
                        className={`text-xs px-2.5 py-1 rounded-md font-bold border transition ${
                          isActive ? 'bg-[#333333] text-white border-[#333333] shadow-2xs' : 'bg-gray-100 text-gray-400 border-gray-200 line-through'
                        }`}>
                        {comp}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Team:</span>
                <div className="flex flex-wrap gap-1">
                  {teamMembers.map(m => {
                    const isActive = activeEmployeeFilters.includes(m.name);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleEmployeeFilter(m.name)}
                        className={`text-xs px-2.5 py-1 rounded-full font-bold border transition flex items-center gap-1.5 ${
                          isActive ? 'bg-white shadow-2xs border-gray-300 text-gray-800' : 'bg-gray-100 text-gray-400 border-gray-200 line-through'
                        }`}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }}></span>
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                setActiveCompanyFilters([...companies]);
                setActiveEmployeeFilters(teamMembers.map(m => m.name));
              }} 
              className="text-[11px] font-bold text-[#A9B1A6] hover:underline self-end md:self-center">
              Reset All Filters
            </button>
          </div>
        )}

        {/* UNASSIGNED BACKLOG TRAY */}
        {userRole === 'admin' && backlogTasks.length > 0 && currentView !== 'create' && currentView !== 'list' && (
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
                  draggable={userRole === 'admin' && !resizingTaskId}
                  onDragStart={(e) => handleDragStart(e, task.id, task.date)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleOpenModal(task, formatDateKey(currentDate))}
                  className="bg-white px-3 py-1.5 rounded border border-amber-200 text-xs font-bold text-gray-800 cursor-grab active:cursor-grabbing hover:bg-amber-100 transition shadow-2xs flex items-center gap-2">
                  <span>{task.title}</span>
                  <span className="text-[9px] bg-gray-200 text-gray-700 px-1 py-0.5 rounded">{task.company}</span>
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">Unassigned</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LIST VIEW */}
        {currentView === 'list' && (
          <div className="flex-col flex gap-6 overflow-y-auto pr-2">
            
            {userRole === 'admin' ? (
              (() => {
                const start = new Date(currentDate);
                const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
                
                const weekDates = [];
                for(let i=0; i<7; i++) {
                  const d = new Date(start);
                  d.setDate(d.getDate() + i);
                  weekDates.push({ dateStr: formatDateKey(d), dayOfWeekStr: daysOfWeek[d.getDay()] });
                }

                return (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Weekly Overview</h2>
                    </div>

                    {companies.filter(c => activeCompanyFilters.includes(c)).map(company => {
                      
                      let compWeekTasks = [];
                      let compWeekCompleted = [];

                      visibleTasks.forEach(t => {
                        if(t.company === company) {
                          weekDates.forEach(wd => {
                            if (isTaskActiveOnDay(t, wd.dayOfWeekStr, wd.dateStr)) {
                              compWeekTasks.push({ ...t, instanceDate: wd.dateStr, instanceDay: wd.dayOfWeekStr });
                            }
                            if (isTaskCompletedOnDay(t, wd.dateStr)) {
                              compWeekCompleted.push({ ...t, instanceDate: wd.dateStr, instanceDay: wd.dayOfWeekStr });
                            }
                          });
                        }
                      });

                      const priorityScore = { High: 1, Medium: 2, Low: 3, Routine: 4 };
                      compWeekTasks.sort((a, b) => {
                        if (a.instanceDate !== b.instanceDate) return a.instanceDate.localeCompare(b.instanceDate);
                        return (priorityScore[a.priority] || 5) - (priorityScore[b.priority] || 5);
                      });

                      compWeekCompleted.sort((a, b) => a.instanceDate.localeCompare(b.instanceDate));
                      const compBacklog = backlogTasks.filter(t => t.company === company);

                      return (
                        <div key={company} className="flex flex-col gap-4 mb-6">
                          <div className="flex items-center gap-2 mb-1 border-b border-gray-300 pb-2">
                            <span className="w-3 h-3 rounded-sm bg-[#333333]"></span>
                            <h2 className="text-lg font-serif font-bold text-gray-800 tracking-wide">{company}</h2>
                          </div>
                          
                          {compBacklog.length > 0 && (
                            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
                                  📥 Unassigned Backlog ({compBacklog.length})
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {compBacklog.map(task => (
                                  <div 
                                    key={task.id}
                                    draggable={userRole === 'admin'}
                                    onDragStart={(e) => handleDragStart(e, task.id, task.date)}
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

                          <div className="flex flex-col gap-3">
                            {compWeekTasks.map(task => {
                              const style = getPriorityStyle(task.priority);
                              return (
                                <div 
                                  key={`${task.id}-${task.instanceDate}`}
                                  onClick={() => handleOpenModal(task, task.instanceDate)}
                                  className={`bg-white p-3 rounded border-l-4 ${task.isOverdue ? 'border-red-600 bg-red-50/50 ring-1 ring-red-400' : style.border} shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50 transition`}>
                                  
                                  <div className="flex items-center gap-4 w-2/3">
                                    <div className="flex flex-col items-center justify-center bg-gray-50 rounded px-2.5 py-1 min-w-[50px] border border-gray-200 shrink-0">
                                      <span className="text-[9px] font-bold text-gray-500 uppercase">{task.instanceDay}</span>
                                      <span className="text-sm font-bold text-gray-800">{task.instanceDate.split('-')[2]}</span>
                                    </div>
                                    
                                    <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 shrink-0">{task.timeLabel}</span>
                                    
                                    <div className="truncate pr-2">
                                      <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-sm truncate">{task.title}</h3>
                                        {task.isOverdue && <span className="text-[9px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded animate-pulse shrink-0">OVERDUE</span>}
                                        {task.recurrenceType === 'completion' && <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded shrink-0">🔄</span>}
                                      </div>
                                      <p className="text-[11px] text-gray-500 truncate">{task.desc}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>{task.priority}</span>
                                    <div className="flex -space-x-1.5">
                                      {(task.assignees || []).map((a, idx) => {
                                        const m = getMemberConfig(a);
                                        return (
                                          <div key={idx} style={{ backgroundColor: m.color }} className="w-6 h-6 rounded-full border border-white flex items-center justify-center text-[9px] text-white shadow-sm font-bold">
                                            {m.initials}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                </div>
                              );
                            })}
                            
                            {compWeekTasks.length === 0 && compBacklog.length === 0 && compWeekCompleted.length === 0 && (
                              <div className="bg-white p-6 rounded text-center border border-dashed border-gray-300">
                                <p className="text-sm text-gray-500 font-bold">No tasks scheduled for {company} this week.</p>
                              </div>
                            )}
                            
                            {compWeekTasks.length === 0 && (compBacklog.length > 0 || compWeekCompleted.length > 0) && (
                              <p className="text-xs text-gray-400 italic py-1">No active queue this week.</p>
                            )}
                          </div>

                          {compWeekCompleted.length > 0 && (
                            <div className="pt-2 border-t border-gray-200">
                              <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Completed This Week</h3>
                              <div className="flex flex-col gap-2">
                                {compWeekCompleted.map(task => (
                                  <div 
                                    key={`${task.id}-comp-${task.instanceDate}`}
                                    onClick={() => handleOpenModal(task, task.instanceDate)}
                                    className="bg-gray-200/60 p-2.5 rounded flex justify-between items-center cursor-pointer hover:bg-gray-200 transition">
                                    <div className="flex items-center gap-3">
                                      <div className="flex flex-col items-center justify-center bg-gray-300/50 rounded px-2 py-0.5 min-w-[40px] shrink-0">
                                        <span className="text-[8px] font-bold text-gray-500 uppercase">{task.instanceDay}</span>
                                        <span className="text-xs font-bold text-gray-600">{task.instanceDate.split('-')[2]}</span>
                                      </div>
                                      <div>
                                        <span className="line-through text-xs font-bold text-gray-600 block">{task.title}</span>
                                        <span className="text-[10px] text-gray-500">Assigned to: {(task.assignees || []).join(', ')}</span>
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-300">
                                      ✓ Completed
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                );
              })()
            ) : (
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
                                <span className="text-[9px] bg-gray-200 text-gray-700 px-1 py-0.5 rounded">{task.company}</span>
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

                {visibleTasks.some(t => isTaskCompletedOnDay(t, formatDateKey(currentDate))) && (
                  <div className="pt-4 border-t border-gray-300 mt-4">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Completed Today</h2>
                    <div className="flex flex-col gap-2">
                      {visibleTasks.filter(t => isTaskCompletedOnDay(t, formatDateKey(currentDate))).map(task => (
                        <div 
                          key={task.id} 
                          onClick={() => handleOpenModal(task, formatDateKey(currentDate))}
                          className="bg-gray-200/60 p-3 rounded flex justify-between items-center cursor-pointer hover:bg-gray-200 transition">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="line-through text-sm font-bold text-gray-600 block">{task.title}</span>
                              <span className="text-[9px] bg-gray-300 text-gray-600 px-1 py-0.5 rounded">{task.company}</span>
                            </div>
                            <span className="text-xs text-gray-500">Assigned to: {(task.assignees || []).join(', ')}</span>
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
          </div>
        )}

        {/* DAY VIEW */}
        {currentView === 'day' && (
          <div className="flex-1 flex flex-col border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm min-w-[600px]">
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

            <div className="flex-1 relative overflow-y-auto flex" style={{ maxHeight: '580px' }}>
              <div className="w-20 border-r border-gray-300 bg-gray-50 flex flex-col select-none shrink-0" style={{ height: `${dynamicTimeSlots.length * 80}px` }}>
                {dynamicTimeSlots.map(hour => (
                  <div key={hour} className="h-20 border-b border-gray-200 p-2 text-xs font-mono font-bold text-gray-400 text-right pr-3">
                    {hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : hour === 0 ? '12:00 AM' : `${hour}:00 AM`}
                  </div>
                ))}
              </div>

              <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${visibleMembers.length}, minmax(0, 1fr))`, height: `${dynamicTimeSlots.length * 80}px` }}>
                {visibleMembers.map(member => {
                  const dayDateStr = formatDateKey(currentDate);
                  const memberColTasks = visibleTasks.filter(t => isTaskActiveOnDay(t, daysOfWeek[currentDate.getDay()], dayDateStr) && t.assignees && t.assignees.includes(member.name));
                  const layouts = computeDynamicLayouts(memberColTasks);

                  return (
                    <div key={member.id} className="border-r border-gray-200 last:border-r-0 relative h-full">
                      {dynamicTimeSlots.map(hour => (
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

                      {draggedTaskObj && hoverSlot && hoverSlot.memberName === member.name && hoverSlot.dateStr === dayDateStr && (
                        <div 
                          style={{
                            top: `${(hoverSlot.targetHour - gridStartHour) * 80}px`,
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

                      {memberColTasks.map(task => {
                        const layout = layouts[task.id] || { left: '0%', width: '100%', startPx: 0, heightPx: 80, isFlex: false };
                        const isFlex = layout.isFlex;

                        return (
                          <div
                            key={task.id}
                            draggable={userRole === 'admin' && !resizingTaskId}
                            onDragStart={(e) => handleDragStart(e, task.id, dayDateStr)}
                            onDragEnd={handleDragEnd}
                            onClick={() => handleOpenModal(task, dayDateStr)}
                            style={{ 
                              top: `${layout.startPx}px`, 
                              height: `${layout.heightPx}px`, 
                              left: layout.left, 
                              width: layout.width, 
                              backgroundColor: member.color 
                            }}
                            className={`absolute text-white rounded-md p-2 shadow-md border-l-4 ${task.isOverdue ? 'border-red-500 ring-2 ring-red-400' : 'border-black/20'} ${userRole === 'admin' && !resizingTaskId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:brightness-110 transition z-10 flex flex-col justify-between overflow-hidden ${isFlex ? 'opacity-95' : ''}`}>
                            
                            {!isFlex && userRole === 'admin' && (
                              <div 
                                className="absolute top-0 inset-x-0 h-2 cursor-ns-resize hover:bg-white/40 z-20 touch-none rounded-t-md"
                                onPointerDown={(e) => handleResizeStart(e, task, 'top')}
                              />
                            )}

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
                              <p className="text-[10px] opacity-90 truncate mt-0.5">[{task.company}] {task.desc}</p>
                            </div>
                            <div className="flex items-center justify-between text-[9px] opacity-80 pt-0.5 border-t border-white/20 mt-auto">
                              <span>Priority: {task.priority}</span>
                              <span>{task.recurrenceType === 'completion' ? '🔄' : task.recurrenceType === 'fixed' ? '↻' : ''}</span>
                            </div>

                            {!isFlex && userRole === 'admin' && (
                              <div 
                                className="absolute bottom-0 inset-x-0 h-2 cursor-ns-resize hover:bg-white/40 z-20 touch-none rounded-b-md"
                                onPointerDown={(e) => handleResizeStart(e, task, 'bottom')}
                              />
                            )}
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

        {/* WEEK VIEW */}
        {currentView === 'week' && (
          <div className="flex-1 flex flex-col border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm min-w-[800px]">
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

            <div className="flex-1 relative overflow-y-auto flex" style={{ maxHeight: '550px' }}>
              <div className="w-16 border-r border-gray-300 bg-gray-50 flex flex-col select-none shrink-0" style={{ height: `${dynamicTimeSlots.length * 80}px` }}>
                {dynamicTimeSlots.map(hour => (
                  <div key={hour} className="h-20 border-b border-gray-200 p-1 text-[10px] font-mono font-bold text-gray-400 text-right pr-2">
                    {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : hour === 0 ? '12 AM' : `${hour} AM`}
                  </div>
                ))}
              </div>

              <div className="flex-1 grid grid-cols-7 relative" style={{ height: `${dynamicTimeSlots.length * 80}px` }}>
                {daysOfWeek.map((dayName, idx) => {
                  const weekStart = getWeekStart(currentDate);
                  const cellDate = new Date(weekStart);
                  cellDate.setDate(cellDate.getDate() + idx);
                  const dateStr = formatDateKey(cellDate);

                  const dayColTasks = visibleTasks.filter(t => isTaskActiveOnDay(t, dayName, dateStr));
                  const layouts = computeDynamicLayouts(dayColTasks);

                  return (
                    <div key={dayName} className="border-r border-gray-200 last:border-r-0 relative h-full">
                      {dynamicTimeSlots.map(hour => (
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

                      {draggedTaskObj && hoverSlot && hoverSlot.dateStr === dateStr && (
                        <div 
                          style={{
                            top: `${(hoverSlot.targetHour - gridStartHour) * 80}px`,
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

                      {dayColTasks.map(task => {
                        const layout = layouts[task.id] || { left: '0%', width: '100%', startPx: 0, heightPx: 80, isFlex: false };
                        const member = getMemberConfig(task.assignees && task.assignees[0]);
                        const isFlex = layout.isFlex;

                        return (
                          <div
                            key={`${task.id}-${dateStr}`}
                            draggable={userRole === 'admin' && !resizingTaskId}
                            onDragStart={(e) => handleDragStart(e, task.id, dateStr)}
                            onDragEnd={handleDragEnd}
                            onClick={() => handleOpenModal(task, dateStr)}
                            style={{ 
                              top: `${layout.startPx}px`, 
                              height: `${layout.heightPx}px`, 
                              left: layout.left, 
                              width: layout.width, 
                              backgroundColor: member.color 
                            }}
                            className={`absolute text-white rounded p-1.5 shadow ${userRole === 'admin' && !resizingTaskId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:opacity-90 transition z-10 flex flex-col justify-between overflow-hidden ${task.isOverdue ? 'ring-2 ring-red-500' : ''} ${isFlex ? 'opacity-95' : ''}`}>
                            
                            {!isFlex && userRole === 'admin' && (
                              <div 
                                className="absolute top-0 inset-x-0 h-2 cursor-ns-resize hover:bg-white/40 z-20 touch-none rounded-t"
                                onPointerDown={(e) => handleResizeStart(e, task, 'top')}
                              />
                            )}

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

                            {!isFlex && userRole === 'admin' && (
                              <div 
                                className="absolute bottom-0 inset-x-0 h-2 cursor-ns-resize hover:bg-white/40 z-20 touch-none rounded-b"
                                onPointerDown={(e) => handleResizeStart(e, task, 'bottom')}
                              />
                            )}
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
                            draggable={userRole === 'admin' && !resizingTaskId}
                            onDragStart={(e) => handleDragStart(e, task.id, dateStr)}
                            onDragEnd={handleDragEnd}
                            onClick={() => handleOpenModal(task, dateStr)}
                            style={{ backgroundColor: member.color }}
                            className={`text-white text-[10px] font-semibold p-1 rounded truncate ${userRole === 'admin' && !resizingTaskId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:opacity-90 shadow-2xs flex items-center justify-between ${task.isOverdue ? 'ring-2 ring-red-500' : ''}`}>
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
              <button onClick={() => setCurrentView(previousView)} className="text-gray-500 hover:text-gray-800 font-semibold text-sm">✕ Cancel</button>
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
                    <label className="block text-sm font-bold text-gray-700 mb-1">Assigned to</label>
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

                <div className="flex gap-4">
                  <div className="w-1/2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Company</label>
                    <select value={taskCompany} onChange={(e) => setTaskCompany(e.target.value)} className="w-full px-4 py-2 rounded border border-gray-300 bg-white text-sm">
                      <option value="" disabled>Select a Company...</option>
                      {companies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="w-1/2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Priority Level</label>
                    <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className="w-full px-4 py-2 rounded border border-gray-300 bg-white text-sm">
                      <option value="High">High (Red)</option>
                      <option value="Medium">Medium (Orange)</option>
                      <option value="Low">Low (Green)</option>
                      <option value="Routine">Routine (Gray)</option>
                    </select>
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
                      <input type="number" value={cadenceDays} onChange={(e) => setCadenceDays(Number(e.target.value))} className="w-12 p-1 border rounded text-center font-bold" />
                      <span className="text-sm text-gray-600">days after completion</span>
                    </div>
                  )}
                </div>

                <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-sm">Multi-Step Task Chaining Engine</h4>
                    <button type="button" onClick={handleAddChainedStep} className="text-[10px] font-bold bg-[#A9B1A6] text-white px-2.5 py-1 rounded hover:bg-[#5B7049] transition">+ Add Step</button>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Build an automated pipeline of sub tasks triggered upon completion.</p>

                  {chainedSteps.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No sub tasks configured.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {chainedSteps.map((step, idx) => (
                        <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200 text-xs flex flex-col gap-2.5 relative">
                          <div className="flex justify-between items-center font-bold text-gray-700">
                            <span>Step {idx + 1} Sub Task</span>
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
                              <label className="block font-bold text-[10px] text-gray-500 mb-0.5">Assigned to</label>
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
                  <h4 className="font-bold text-sm mb-2">Proof of Work & Permissions</h4>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={requiresPhoto} onChange={(e) => setRequiresPhoto(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Require proof of work upload (Mandatory to complete)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={requiresComment} onChange={(e) => setRequiresComment(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Require execution notes/comment to complete
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer border-t pt-2 mt-1 border-gray-100">
                      <input type="checkbox" checked={allowAssigneeDeadlineChange} onChange={(e) => setAllowAssigneeDeadlineChange(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Allow Employee to Adjust Deadline Date
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
                      <input type="checkbox" checked={notifyOnComment} onChange={(e) => setNotifyOnComment(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Notify me if new comment/files have been added
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={notifyOnDeadlineChange} onChange={(e) => setNotifyOnDeadlineChange(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Notify me when employee changes deadline
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={notifyOnTaskCreated} onChange={(e) => setNotifyOnTaskCreated(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Notify me when new task has been added
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
        {selectedTask && !completionPrompt && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onMouseDown={() => setSelectedTask(null)}>
            <div className="bg-[#F4F3ED] max-w-2xl w-full rounded-lg shadow-xl p-6 border border-gray-300 flex flex-col gap-4 animate-fade-in max-h-[90vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start border-b border-gray-300 pb-3">
                <div>
                  <span className="text-xs font-bold text-[#A9B1A6] uppercase tracking-wider">
                    {isCurrentInstanceCompleted ? 'Completed Occurrence Review' : (userRole === 'admin' ? (isEditing ? 'Admin Full Task Editor' : 'Admin Inspector Mode') : 'Employee Execution View')}
                  </span>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-serif font-bold">{selectedTask.title}</h2>
                    <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-bold">{selectedTask.company}</span>
                    {selectedTask.isOverdue && <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">OVERDUE</span>}
                  </div>
                </div>
                <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
              </div>

              {!isEditing ? (
                <>
                  <p className="text-sm text-gray-600 bg-white p-3 rounded border border-gray-200">{selectedTask.desc}</p>

                  <div className="flex justify-between text-xs text-gray-500 bg-gray-100 p-2 rounded">
                    <span>Assigned to: <strong>{selectedTask.assignees && selectedTask.assignees.length > 0 ? selectedTask.assignees.join(', ') : 'Unassigned (Backlog)'}</strong></span>
                    <span>Occurrence Date: <strong>{selectedInstanceDate}</strong></span>
                  </div>

                  {selectedTask.allowAssigneeDeadlineChange && !isCurrentInstanceCompleted && (
                    <div className="bg-blue-50 p-3 rounded border border-blue-200 flex flex-col gap-2">
                      <span className="text-xs font-bold text-blue-900">📅 Admin Permission Granted: Adjust Deadline</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="date" 
                          value={selectedTask.date} 
                          onChange={async (e) => {
                            const newDate = e.target.value;
                            const todayStr = formatDateKey(new Date());
                            const newOverdue = newDate < todayStr;
                            const updated = { ...selectedTask, date: newDate, isOverdue: newOverdue, overdueNotified: newOverdue };
                            setSelectedTask(updated);
                            setTasks(tasks.map(t => t.id === selectedTask.id ? updated : t));

                            await supabase.from('tasks').update(mapToDb(updated)).eq('id', selectedTask.id);

                            if (userRole === 'employee' && selectedTask?.notifyOnDeadlineChange !== false) {
                              setNotifications(prev => [
                                {
                                  id: Date.now() + Math.random(),
                                  text: `📅 Employee Rescheduled: "${selectedTask.title}" deadline changed to ${newDate}`,
                                  type: 'deadline',
                                  recipientRole: 'admin',
                                  read: false,
                                  time: 'Just now'
                                },
                                ...prev
                              ]);
                            }
                          }} 
                          className="p-1.5 text-xs border rounded bg-white font-bold text-gray-800 focus:outline-none cursor-pointer"
                        />
                        <span className="text-[11px] text-gray-500 italic">(Reschedules task on dispatch board)</span>
                      </div>
                    </div>
                  )}

                  <div className="bg-white p-3 rounded border border-gray-200">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-2">Task Activity & Comments</h4>
                    
                    {selectedTask.parentTaskId && (
                      <div className="bg-blue-50/60 p-2 mb-3 rounded border border-blue-100 flex items-center justify-between text-[11px]">
                        <span className="text-blue-800">
                          ↳ Sub-task of: <strong className="font-bold">{selectedTask.parentTaskTitle}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const parentTask = tasks.find(t => t.id === selectedTask.parentTaskId);
                            if (parentTask) {
                              handleOpenModal(parentTask, selectedTask.parentInstanceDate);
                            } else {
                              alert('Original task could not be found.');
                            }
                          }}
                          className="font-bold text-blue-700 hover:underline"
                        >
                          View Previous Task
                        </button>
                      </div>
                    )}

                    {selectedTask.comments && selectedTask.comments.length > 0 ? (
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 mb-3">
                        {selectedTask.comments.map((c, i) => renderComment(c, i))}
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

                  {/* UNIVERSAL ATTACHMENTS & PROOF OF WORK */}
                  {!isCurrentInstanceCompleted && (
                    <div className="bg-white p-3 rounded border border-amber-300 flex justify-between items-center my-1">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                          📎 Attachments & Proof of Work
                          {selectedTask.requiresPhoto && <span className="text-red-600 font-bold ml-1">(Required)</span>}
                        </span>
                        <span className="text-[10px] text-gray-500">Upload images, PDFs, spreadsheets, or documents</span>
                      </div>
                      
                      <label className="text-xs font-bold px-3 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer transition">
                        + Attach File
                        <input 
                          type="file" 
                          accept="*/*" 
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            const fileExt = file.name.split('.').pop();
                            const fileName = `${selectedTask.id}-${Date.now()}.${fileExt}`;

                            // 1. Upload to Supabase Storage bucket
                            const { error: uploadErr } = await supabase.storage
                              .from('task-proofs')
                              .upload(fileName, file);

                            if (uploadErr) {
                              alert(`Upload failed: ${uploadErr.message}`);
                              return;
                            }

                            // 2. Retrieve public URL
                            const { data: { publicUrl } } = supabase.storage
                              .from('task-proofs')
                              .getPublicUrl(fileName);

                            // 3. Post file URL into task activity comments
                            const fileNote = `📎 Proof Attached (${file.name}): ${publicUrl}`;
                            const updatedComments = [...(selectedTask.comments || []), fileNote];
                            const updatedTask = { ...selectedTask, comments: updatedComments };

                            setSelectedTask(updatedTask);
                            setTasks(tasks.map(t => t.id === selectedTask.id ? updatedTask : t));
                            setPhotoUploaded(true);

                            await supabase.from('tasks').update(mapToDb(updatedTask)).eq('id', selectedTask.id);

                            if (userRole === 'employee' && selectedTask?.notifyOnComment !== false) {
                              setNotifications(prev => [{ 
                                id: Date.now() + Math.random(), 
                                text: `📎 File Uploaded for "${selectedTask.title}" by ${currentUserName}`, 
                                type: 'photo', 
                                recipientRole: 'admin', 
                                read: false, 
                                time: 'Just now' 
                              }, ...prev]);
                            }
                          }}
                        />
                      </label>
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
                <div className="flex flex-col gap-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold mb-1 text-gray-700">Task Title</label>
                      <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="w-full p-2 border rounded bg-white" />
                    </div>

                    <div className="flex gap-2">
                      <div className="w-1/2">
                        <label className="block font-bold mb-1 text-gray-700">Company</label>
                        <select value={taskCompany} onChange={(e) => setTaskCompany(e.target.value)} className="w-full p-2 border rounded bg-white">
                          <option value="" disabled>Select a Company...</option>
                          {companies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="w-1/2">
                        <label className="block font-bold mb-1 text-gray-700">Priority Level</label>
                        <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className="w-full p-2 border rounded bg-white">
                          <option value="High">High (Red)</option>
                          <option value="Medium">Medium (Orange)</option>
                          <option value="Low">Low (Green)</option>
                          <option value="Routine">Routine (Gray)</option>
                        </select>
                      </div>
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
                      <label className="block font-bold mb-1 text-gray-700">Assigned to</label>
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
                          <span>Step {idx + 1} Sub Task</span>
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

                  <div className="bg-white p-3 rounded border border-gray-200 flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                      <input type="checkbox" checked={requiresPhoto} onChange={(e) => setRequiresPhoto(e.target.checked)} className="accent-[#A9B1A6]" /> Require proof of work upload (Mandatory to complete)
                    </label>
                    <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                      <input type="checkbox" checked={requiresComment} onChange={(e) => setRequiresComment(e.target.checked)} className="accent-[#A9B1A6]" /> Require Comment
                    </label>
                    <label className="flex items-center gap-1.5 font-bold cursor-pointer border-t pt-1.5 mt-1 border-gray-100">
                      <input type="checkbox" checked={allowAssigneeDeadlineChange} onChange={(e) => setAllowAssigneeDeadlineChange(e.target.checked)} className="accent-[#A9B1A6]" /> Allow Employee to Adjust Deadline Date
                    </label>
                  </div>

                  <div className="bg-[#A9B1A6]/10 p-3 rounded border border-[#A9B1A6]/30 flex flex-col gap-1.5">
                    <h4 className="font-bold text-xs text-gray-800">Admin Notification Rules</h4>
                    <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                      <input type="checkbox" checked={notifyOnComplete} onChange={(e) => setNotifyOnComplete(e.target.checked)} className="accent-[#A9B1A6]" /> Notify me when task is completed
                    </label>
                    <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                      <input type="checkbox" checked={notifyOnComment} onChange={(e) => setNotifyOnComment(e.target.checked)} className="accent-[#A9B1A6]" /> Notify me if new comment/files have been added
                    </label>
                    <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                      <input type="checkbox" checked={notifyOnDeadlineChange} onChange={(e) => setNotifyOnDeadlineChange(e.target.checked)} className="accent-[#A9B1A6]" /> Notify me when employee changes deadline
                    </label>
                    <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                      <input type="checkbox" checked={notifyOnTaskCreated} onChange={(e) => setNotifyOnTaskCreated(e.target.checked)} className="accent-[#A9B1A6]" /> Notify me when new task has been added
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
                      <button onClick={handleInitiateCompletion} className="bg-[#A9B1A6] text-white px-5 py-2 rounded text-xs font-bold shadow-sm hover:bg-gray-600 transition">
                        Mark Occurrence Complete
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB-TASK COMPLETION PROMPT MODAL */}
        {completionPrompt && (
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
        )}

        {/* RECURRING TASK RESCHEDULE SCOPE PROMPT MODAL */}
        {reschedulePrompt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onMouseDown={() => setReschedulePrompt(null)}>
            <div className="bg-white max-w-md w-full rounded-lg shadow-2xl p-6 border border-gray-300 flex flex-col gap-4 animate-fade-in" onMouseDown={(e) => e.stopPropagation()}>
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
                  onClick={() => applyTaskMove(reschedulePrompt.task.id, reschedulePrompt.targetDate, reschedulePrompt.targetHour, reschedulePrompt.targetMemberName, false, reschedulePrompt.sourceDate)}
                  className="bg-[#A9B1A6] text-white py-2.5 px-4 rounded text-xs font-bold hover:bg-gray-600 transition text-left flex justify-between items-center">
                  <span>Only This Occurrence</span>
                  <span className="text-[10px] opacity-80">(Creates standalone task)</span>
                </button>

                <button 
                  onClick={() => applyTaskMove(reschedulePrompt.task.id, reschedulePrompt.targetDate, reschedulePrompt.targetHour, reschedulePrompt.targetMemberName, true, reschedulePrompt.sourceDate)}
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-end p-4 z-50" onMouseDown={() => setIsSettingsOpen(false)}>
            <div className="bg-[#F4F3ED] max-w-md w-full h-full rounded-l-lg shadow-2xl p-6 border-l border-gray-300 flex flex-col gap-4 animate-fade-in overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
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
                      <option value="employee">Employee (Worker)</option>
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

              <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col gap-3 mt-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700 border-b pb-1">Company Management</h4>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newCompanyInput}
                    onChange={(e) => setNewCompanyInput(e.target.value)}
                    placeholder="New Company Name"
                    className="flex-1 p-2 text-xs border border-gray-300 rounded focus:outline-none"
                  />
                  <button 
                    onClick={() => {
                      if(newCompanyInput.trim() && !companies.includes(newCompanyInput.trim())) {
                        const added = newCompanyInput.trim();
                        setCompanies([...companies, added]);
                        setActiveCompanyFilters([...activeCompanyFilters, added]);
                        setNewCompanyInput('');
                      }
                    }}
                    className="bg-[#333333] text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-black transition">
                    Add
                  </button>
                </div>
                <div className="flex flex-col gap-1 mt-2">
                  {companies.map(comp => (
                    <div key={comp} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100 text-xs">
                      <span className="font-bold text-gray-700">{comp}</span>
                      <button 
                        onClick={() => {
                          if(companies.length > 1) {
                            setCompanies(companies.filter(c => c !== comp));
                            setActiveCompanyFilters(activeCompanyFilters.filter(c => c !== comp));
                          } else {
                            alert('You must have at least one company in the system.');
                          }
                        }}
                        className="text-red-500 font-bold hover:underline">Remove</button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}