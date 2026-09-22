// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import {
  daysOfWeek,
  minuteSubSlots,
  compressImage,
  enableNativePush,
  sendNativePush,
  formatDateKey,
  mapToDb,
  mapFromDb,
  timeToDecimal,
  decimalToTimeString,
  formatTimeLabel
} from './utils';
import CompletionModal from './components/CompletionModal';
import RescheduleModal from './components/RescheduleModal';
import SettingsModal from './components/SettingsModal';
import TaskInspectorModal from './components/TaskInspectorModal';
import TaskBuilder from './components/TaskBuilder';
import DayView from './components/DayView';
import WeekView from './components/WeekView';
import MonthView from './components/MonthView';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import DashboardTrays from './components/DashboardTrays';
import ListAndCompletedViews from './components/ListAndCompletedViews';
// --- STATIC CALENDAR HELPERS ---


export default function App() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [currentView, setCurrentView] = useState('list');
  const [previousView, setPreviousView] = useState('list');
  const [userRole, setUserRole] = useState('employee');
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [activeEmployeeFilters, setActiveEmployeeFilters] = useState([]);
  const [listScope, setListScope] = useState('day');

  useEffect(() => {
    setListScope(userRole === 'admin' ? 'week' : 'day');
  }, [userRole]);

  const [hiddenCompanies, setHiddenCompanies] = useState(() => JSON.parse(localStorage.getItem('hiddenCompanies') || '[]'));
  const [hiddenMembers, setHiddenMembers] = useState(() => JSON.parse(localStorage.getItem('hiddenMembers') || '[]'));

  useEffect(() => {
    localStorage.setItem('hiddenCompanies', JSON.stringify(hiddenCompanies));
  }, [hiddenCompanies]);

  useEffect(() => {
    localStorage.setItem('hiddenMembers', JSON.stringify(hiddenMembers));
  }, [hiddenMembers]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  const [companies, setCompanies] = useState([]);
  const [activeCompanyFilters, setActiveCompanyFilters] = useState([]);

  useEffect(() => {
    async function loadData() {
      const { data: companyData, error: compErr } = await supabase.from('companies').select('*');
      if (companyData && !compErr) {
        const compNames = companyData.map(c => c.name);
        setCompanies(compNames);
        if (activeCompanyFilters.length === 0) setActiveCompanyFilters(compNames);
      }

      const { data: allProfiles, error: teamErr } = await supabase.from('profiles').select('*');
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
        if (activeEmployeeFilters.length === 0) setActiveEmployeeFilters(mappedMembers.map(m => m.name));
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

    if (session) loadData();
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [isNotifOpen, setIsNotifOpen] = useState(false);
const [notifications, setNotifications] = useState([]);
const notifyChannel = useRef(null);
const hasLoadedNotifs = useRef(false);

const currentUserName = currentProfile?.name || session?.user?.email?.split('@')[0] || '';

// 1. Fetch from DB & Subscribe to Changes
  useEffect(() => {
    if (!currentUserName) return;

    const fetchNotifs = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        // We added double-quotes around the variables here so names with spaces don't crash the database!
        .or(`and(target_type.eq.role,target_value.eq."${userRole}"),and(target_type.eq.userName,target_value.eq."${currentUserName}")`)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) {
        console.error("Error fetching notifications:", error);
      } else if (data) {
        const mapped = data.map(n => ({
          id: n.id,
          text: n.text,
          type: n.type,
          targetType: n.target_type,
          targetValue: n.target_value,
          taskId: n.task_id,
          taskDate: n.task_date,
          read: n.read,
          time: new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' @ ' + new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        setNotifications(mapped);
      }
    };

    fetchNotifs();

    const channel = supabase.channel('db-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
         fetchNotifs(); // Instantly refresh if a new one is added
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    }
  }, [userRole, currentUserName]);

  // --- UNIFIED NOTIFICATION DISPATCHER ---
  // --- UNIFIED NOTIFICATION DISPATCHER ---
  const dispatchNotification = async (targetType, targetValue, type, bellText, pushTitle, pushMessage, taskId = null, taskDate = null) => {
    if (pushTitle && pushMessage) {
      sendNativePush({ targetType, targetValue, title: pushTitle, message: pushMessage });
    }

    if (bellText) {
      const { error } = await supabase.from('notifications').insert({
        text: bellText,
        type: type,
        target_type: targetType,
        target_value: targetValue,
        task_id: taskId,
        task_date: taskDate,
        read: false
      });
      if (error) console.error("Error saving notification to DB:", error);
    }
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [newCompanyInput, setNewCompanyInput] = useState('');
  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  const [editingCompanyInput, setEditingCompanyInput] = useState('');
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
  const [taskPriority, setTaskPriority] = useState('Standard'); 
  const [taskDate, setTaskDate] = useState('');
  const [hasSpecificTime, setHasSpecificTime] = useState(false); 
  const [startTime, setStartTime] = useState('13:00');
  const [endTime, setEndTime] = useState('14:00');
  const [isLongTerm, setIsLongTerm] = useState(false);

  const [recurrenceType, setRecurrenceType] = useState('once');
  const [activeDays, setActiveDays] = useState([]);
  const [cadenceDays, setCadenceDays] = useState(14);

  const [chainedSteps, setChainedSteps] = useState([]);
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [requiresComment, setRequiresComment] = useState(false);
  const [allowAssigneeDeadlineChange, setAllowAssigneeDeadlineChange] = useState(true);

  const [notifyOnComplete, setNotifyOnComplete] = useState(true); 
  const [notifyOnComment, setNotifyOnComment] = useState(true);   
  const [notifyOnDeadlineChange, setNotifyOnDeadlineChange] = useState(true); 
  const [notifyOnTaskCreated, setNotifyOnTaskCreated] = useState(true); 
  
  const [openCommentInput, setExecutionComment] = useState('');
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [additionalNote, setAdditionalNote] = useState('');

  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [draggedInstanceDate, setDraggedInstanceDate] = useState(null);
  const [hoverSlot, setHoverSlot] = useState(null);
  const [reschedulePrompt, setReschedulePrompt] = useState(null);
  const [resizingTaskId, setResizingTaskId] = useState(null);
  const resizeStateRef = useRef(null);
  const [completionPrompt, setCompletionPrompt] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [isDbLoading, setIsDbLoading] = useState(true);

  let gridStartHour = 6;
  let gridEndHour = 20;

  // --- CORE DERIVED VARIABLES ---
  const isCurrentInstanceCompleted = selectedTask && (
    selectedTask.status === 'completed' || 
    (selectedTask.completedDates && selectedTask.completedDates.includes(selectedInstanceDate))
  );

  const draggedTaskObj = draggedTaskId ? tasks.find(t => t.id === draggedTaskId) : null;

  // --- CORE TIME ENGINE ---
  const isTaskScheduledOnDay = (task, dayOfWeekStr, dateStr) => {
    if (!task) return false;
    if (task.endDate && dateStr > task.endDate) return false;

    if (task.recurrenceType === 'fixed') {
      const startDate = task.date;
      if (startDate && dateStr < startDate) return false;
      if (!task.activeDays || !task.activeDays.includes(dayOfWeekStr)) return false;

      const intervalWeeks = Math.max(1, Math.round((task.cadenceDays || 7) / 7));
      if (intervalWeeks > 1 && startDate) {
        const parseDate = (ds) => {
          const [y, m, d] = ds.split('-').map(Number);
          return new Date(y, m - 1, d);
        };
        const sDate = parseDate(startDate);
        const cDate = parseDate(dateStr);

        const sSunday = new Date(sDate);
        sSunday.setDate(sDate.getDate() - sDate.getDay());

        const cSunday = new Date(cDate);
        cSunday.setDate(cDate.getDate() - cDate.getDay());

        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        const weeksDiff = Math.round((cSunday.getTime() - sSunday.getTime()) / msPerWeek);

        if (weeksDiff % intervalWeeks !== 0) return false;
      }

      return true;
    }
    return task.date === dateStr;
  };

  const getMissedDate = (task) => {
    if (task.recurrenceType === 'once' || task.recurrenceType === 'completion') return task.date;
    if (task.recurrenceType === 'fixed') {
       const maxLookback = Math.max(7, task.cadenceDays || 7);
       for (let i = 1; i <= maxLookback; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const checkDateStr = formatDateKey(d);
          const dayOfWeekStr = daysOfWeek[d.getDay()];
          if (isTaskScheduledOnDay(task, dayOfWeekStr, checkDateStr)) {
             return checkDateStr;
          }
       }
    }
    return task.date;
  };

  const isTaskPastDue = (task) => {
    if (!task.date || task.date.trim() === '') return false;
    if (task.status === 'completed') return false;
    const todayStr = formatDateKey(new Date());

    if (task.recurrenceType === 'once' || task.recurrenceType === 'completion') {
      return task.date < todayStr;
    }

    if (task.recurrenceType === 'fixed') {
       const missedDate = getMissedDate(task);
       if (missedDate && missedDate < todayStr) {
         if (task.completedDates && task.completedDates.includes(missedDate)) return false;
         if (task.exceptionDates && task.exceptionDates.includes(missedDate)) return false;
         return true;
       }
       return false;
    }
    return false;
  };

  const isTaskDueToday = (task, instanceDateStr = null) => {
    if (!task || task.status === 'completed') return false;
    const todayStr = formatDateKey(new Date());
    const dateToCheck = instanceDateStr || task.date;
    return dateToCheck === todayStr;
  };

  const isTaskActiveOnDay = (task, dayOfWeekStr, dateStr) => {
    if (!task) return false;
    if (task.status === 'completed') return false;
    if (task.completedDates && task.completedDates.includes(dateStr)) return false;
    if (task.exceptionDates && task.exceptionDates.includes(dateStr)) return false; 
    
    return isTaskScheduledOnDay(task, dayOfWeekStr, dateStr);
  };

  const isTaskCompletedOnDay = (task, dateStr) => {
    if (!task) return false;
    
    if (task.completedDates && task.completedDates.length > 0) {
      if (task.recurrenceType === 'once') {
         return task.completedDates[0] === dateStr; 
      }
      return task.completedDates.includes(dateStr);
    }
    
    return task.status === 'completed' && task.date === dateStr;
  };

  useEffect(() => {
    if (!session) return;

    const fetchCloudData = async () => {
      const { data, error } = await supabase.from('tasks').select('*');
      if (error) {
        console.error('Error fetching tasks from cloud:', error);
      } else if (data) {
        const mapped = data.map(mapFromDb);
        setTasks(mapped);

        const missingCompanies = [...new Set(mapped.map(t => t.company).filter(c => c && !companies.includes(c)))];
        if (missingCompanies.length > 0) {
          setCompanies(prev => [...new Set([...prev, ...missingCompanies])]);
          setActiveCompanyFilters(prev => [...new Set([...prev, ...missingCompanies])]);
        }
      }
      setIsDbLoading(false);
    };

    fetchCloudData();

    const channel = supabase
      .channel(`tasks-realtime-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          fetchCloudData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, companies]);

  useEffect(() => {
    if (tasks.length === 0) return;

    const localNotified = JSON.parse(localStorage.getItem('localNotifiedTasks') || '[]');
    const tasksToAlert = tasks.filter(t => isTaskPastDue(t) && !t.overdueNotified && !localNotified.includes(t.id));

    if (tasksToAlert.length > 0) {
      const newlyNotifiedIds = [];
      
      tasksToAlert.forEach(async (task) => {
        newlyNotifiedIds.push(task.id);
        const assigneeLabel = task.assignees && task.assignees.length > 0 ? task.assignees.join(', ') : 'Unassigned';
        const alertDate = getMissedDate(task);
        
        dispatchNotification(
          'role',
          'admin',
          'overdue',
          `⚠️ OVERDUE: "${task.title}" (${assigneeLabel}) was not completed by ${alertDate}`,
          '⚠️ Task Overdue Alert',
          `"${task.title}" (${assigneeLabel}) was not completed by ${alertDate}`,
          task.id,
          alertDate
        );

        const { error } = await supabase.from('tasks').update({ is_overdue: true, overdue_notified: true }).eq('id', task.id);
        if (error) console.error("Could not save overdue state to DB (Likely RLS blocking):", error);
      });

      localStorage.setItem('localNotifiedTasks', JSON.stringify([...localNotified, ...newlyNotifiedIds]));

      setTasks(prev => prev.map(p => {
        if (tasksToAlert.some(t => t.id === p.id)) {
          return { ...p, isOverdue: true, overdueNotified: true };
        }
        return p;
      }));
    }
  }, [tasks.length]);

  const masterCompanyList = [...new Set([...companies, ...tasks.map(t => t.company).filter(Boolean)])];

  const getCurrentTimestamp = () => {
    const now = new Date();
    return now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' @ ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    if (currentView === 'day' || ((currentView === 'list' || currentView === 'completed') && listScope === 'day')) {
      d.setDate(d.getDate() - 1);
    } else if (currentView === 'week' || ((currentView === 'list' || currentView === 'completed') && listScope === 'week')) {
      d.setDate(d.getDate() - 7);
    } else if (currentView === 'month') {
      d.setMonth(d.getMonth() - 1);
    }
    setCurrentDate(d);
  };

  const handleNextDate = () => {
    const d = new Date(currentDate);
    if (currentView === 'day' || ((currentView === 'list' || currentView === 'completed') && listScope === 'day')) {
      d.setDate(d.getDate() + 1);
    } else if (currentView === 'week' || ((currentView === 'list' || currentView === 'completed') && listScope === 'week')) {
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
    if (currentView === 'day' || ((currentView === 'list' || currentView === 'completed') && listScope === 'day')) {
      return `${daysOfWeek[currentDate.getDay()]}, ${currentDate.toLocaleDateString('en-US', { month: 'long' })} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
    }

    if (currentView === 'week' || ((currentView === 'list' || currentView === 'completed') && listScope === 'week')) {
      let start = new Date(currentDate);
      if (currentView === 'list' || currentView === 'completed') {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
      } else {
        start = getWeekStart(currentDate);
      }
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `Week of ${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()} - ${end.toLocaleDateString('en-US', { month: 'short' })} ${end.getDate()}, ${end.getFullYear()}`;
    }

    if (currentView === 'month') {
      return `${currentDate.toLocaleDateString('en-US', { month: 'long' })} ${currentDate.getFullYear()}`;
    }

    return 'Command Center';
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

          (resizedTask.assignees || []).forEach(assigneeName => {
            dispatchNotification(
              'userName',
              assigneeName,
              'resize',
              `⏱️ Schedule Modified: Duration changed for "${resizedTask.title}"`,
              '⏱️ Schedule Modified',
              `Task duration modified for "${resizedTask.title}"`,
              resizedTask.id,
              resizedTask.date
            );
          });
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

  const applyTaskMove = async (taskId, targetDate, targetHour, targetMemberName, updateSeries = false, sourceDateFromPrompt = null, isAllDayDrop = false) => {
    const todayStr = formatDateKey(new Date());
    let dbPayloads = [];
    
    const moveNote = `📅 Rescheduled to ${targetDate} by ${currentUserName} [${getCurrentTimestamp()}]`;
    // ---> NEW ASYNC-SAFE DISPATCH BLOCK <---
    const taskToMove = tasks.find(t => t.id === taskId);
    if (taskToMove) {
      const notifyUsers = targetMemberName ? [targetMemberName] : (taskToMove.assignees || []);
      notifyUsers.forEach(assigneeName => {
        dispatchNotification(
          'userName',
          assigneeName,
          'schedule',
          `📅 Rescheduled: "${taskToMove.title}" moved to ${targetDate}`,
          '📅 Schedule Updated',
          `"${taskToMove.title}" has been moved to ${targetDate}`,
          taskToMove.id,
          targetDate
        );
      });
    }

    setTasks(prevTasks => {
      const targetTask = prevTasks.find(t => t.id === taskId);
      if (!targetTask) return prevTasks;

      let isFlex = targetTask.type === 'flexible';
      if (isAllDayDrop) {
        isFlex = true;
      } else if (targetHour !== null) {
        isFlex = false;
      }
      
      let startDec = isFlex ? null : (targetHour !== null ? targetHour : (targetTask.startHour !== null ? targetTask.startHour : 9));
      let dur = isFlex ? null : (targetTask.type === 'flexible' ? 1 : (targetTask.duration || 1));
      let sStr = isFlex ? null : decimalToTimeString(startDec);
      let eStr = isFlex ? null : decimalToTimeString(startDec + dur);
      let label = isFlex ? 'All-Day' : formatTimeLabel(sStr, eStr);

      const effectiveSourceDate = sourceDateFromPrompt || targetTask.date;

      


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
          isOverdue: Boolean(targetDate && targetDate.trim() !== '' && targetDate < todayStr), 
          overdueNotified: Boolean(targetDate && targetDate.trim() !== '' && targetDate < todayStr),
          comments: [...(targetTask.comments || []), moveNote] 
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
          endDate: null,
          comments: [...(targetTask.comments || []), moveNote]
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
          const newIsOverdue = Boolean(targetDate && targetDate.trim() !== '' && targetDate < todayStr && t.status !== 'completed');
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
            overdueNotified: newIsOverdue,
            comments: [...(t.comments || []), moveNote] 
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

  const handleDropSlot = (e, targetDate, targetHour = null, targetMemberName = null, isAllDayDrop = false) => {
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
        sourceDate: sourceDate || targetDate,
        isAllDayDrop
      });
    } else {
      applyTaskMove(taskId, targetDate, targetHour, targetMemberName, false, sourceDate, isAllDayDrop);
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
    } else {
      if (!memberEmail.trim()) return alert('Please enter an email address.');

      const newId = crypto.randomUUID();
      const { error } = await supabase.from('profiles').insert({
        id: newId,
        name: memberName,
        initials,
        email: memberEmail,
        role: memberRole,
        color: memberColor
      });

      if (error) {
        console.error('Error creating profile:', error);
        alert(`Error creating team member: ${error.message}`);
        return;
      }
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

  const handleRenameCompany = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) {
      setEditingCompany(null);
      return;
    }

    const trimmed = newName.trim();

    setCompanies(prev => prev.map(c => c === oldName ? trimmed : c));
    setActiveCompanyFilters(prev => prev.map(c => c === oldName ? trimmed : c));
    setTasks(prev => prev.map(t => t.company === oldName ? { ...t, company: trimmed } : t));

    await supabase.from('companies').update({ name: trimmed }).eq('name', oldName);
    await supabase.from('tasks').update({ company: trimmed }).eq('company', oldName);

    setEditingCompany(null);
    setEditingCompanyInput('');
  };

  const handleDeleteCompany = async (nameToDelete: string) => {
    if (companies.length <= 1) {
      return alert('You must have at least one company in the system.');
    }

    const tasksUsingCompany = tasks.filter(t => t.company === nameToDelete);
    if (tasksUsingCompany.length > 0) {
      const confirmDelete = window.confirm(`There are ${tasksUsingCompany.length} tasks associated with ${nameToDelete}. Deleting this company will leave those tasks without a valid company tag. Are you sure you want to proceed?`);
      if (!confirmDelete) return;
    }

    setCompanies(prev => prev.filter(c => c !== nameToDelete));
    setActiveCompanyFilters(prev => prev.filter(c => c !== nameToDelete));
    
    const { error } = await supabase.from('companies').delete().eq('name', nameToDelete);
    if (error) alert(`Database Error: ${error.message}`);
  };

  const handleAddCompany = async () => {
    const newName = newCompanyInput.trim();
    if (!newName || companies.includes(newName)) return;

    setCompanies(prev => [...prev, newName]);
    setActiveCompanyFilters(prev => [...prev, newName]);
    setNewCompanyInput('');

    const newId = crypto.randomUUID();
    const { error } = await supabase.from('companies').insert({ id: newId, name: newName });
    
    if (error) {
      alert(`Database Error: ${error.message}\nPlease make sure your "companies" table has RLS disabled or a valid Insert policy.`);
      setCompanies(prev => prev.filter(c => c !== newName));
      setActiveCompanyFilters(prev => prev.filter(c => c !== newName));
    }
  };

  const resetForm = () => {
    setTaskTitle('');
    setTaskDesc('');
    setTaskCompany(''); 
    setSelectedAssignees([]);
    setTaskPriority('Standard'); 
    setTaskDate(formatDateKey(currentDate));
    setHasSpecificTime(false); 
    setStartTime('09:00');
    setEndTime('11:00');
    setIsLongTerm(false);
    setRecurrenceType('once');
    setActiveDays([]);
    setCadenceDays(7); 
    setChainedSteps([]);
    setRequiresPhoto(false);
    setRequiresComment(false);
    setAllowAssigneeDeadlineChange(true);
    setNotifyOnComplete(true); 
    setNotifyOnComment(true);   
    setNotifyOnDeadlineChange(true);
    setNotifyOnTaskCreated(true);
  };

  const handleAddChainedStep = () => {
    setChainedSteps([...chainedSteps, { title: '', desc: '', relativeDays: 1, assignee: 'Same as Parent', priority: 'Standard', requiresPhoto: false, requiresComment: false }]);
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
      isLongTerm,
      comments: [`📌 Task Generated by ${currentUserName} [${getCurrentTimestamp()}]`] 
    };

    // 1. FIRE NOTIFICATIONS FIRST (Guarantees transmission before React changes screens)
    selectedAssignees.forEach(assigneeName => {
      dispatchNotification(
        'userName', 
        assigneeName, 
        'new_task',
        `📋 New Task: "${taskTitle}" (${taskCompany})`,
        '📋 New Task Assigned',
        `You have been assigned: "${taskTitle}" (${taskCompany})`,
        newTask.id,
        newTask.date
      );
    });

    // 2. OPTIMISTIC UI UPDATE
    setTasks([newTask, ...tasks]);
    resetForm();
    setCurrentView(previousView === 'create' ? 'list' : previousView);

    // 3. BACKGROUND DB SYNC
    const { error } = await supabase.from('tasks').insert(mapToDb(newTask));
    if (error) {
      console.error('Supabase Insert Error:', error);
      alert(`Cloud sync error: ${error.message}`);
    }
  };

  const handleOpenModal = (task, instanceDateStr) => {
    setSelectedTask(task);
    setSelectedInstanceDate(instanceDateStr || formatDateKey(currentDate));
    setIsEditing(false);
    setExecutionComment('');
    setPhotoUploaded(false);
    setAdditionalNote('');
    setIsDraggingFile(false);

    setTaskTitle(task.title);
    setTaskDesc(task.desc);
    setTaskCompany(task.company || '');
    
    if (task.company && !masterCompanyList.includes(task.company)) {
      setCompanies(prev => [...prev, task.company]);
    }

    setSelectedAssignees(task.assignees || []);
    setTaskPriority(task.priority);
    setTaskDate(task.date || instanceDateStr);
    setHasSpecificTime(task.type === 'timed');
    setStartTime(task.startTime || '09:00');
    setEndTime(task.endTime || '11:00');
    setRecurrenceType(task.recurrenceType || 'once');
    setActiveDays(task.activeDays || []);
    setCadenceDays(task.cadenceDays || 7);
    setRequiresPhoto(task.requiresPhoto || false);
    setRequiresComment(task.requiresComment || false);
    setAllowAssigneeDeadlineChange(task.allowAssigneeDeadlineChange || false);
    setNotifyOnComplete(task.notifyOnComplete ?? true);
    setNotifyOnComment(task.notifyOnComment ?? true);
    setNotifyOnDeadlineChange(task.notifyOnDeadlineChange ?? true);
    setNotifyOnTaskCreated(task.notifyOnTaskCreated ?? true);
    setIsLongTerm(task.isLongTerm || false);
    setChainedSteps(task.chainedSteps || []);
  };

  const handleSaveChanges = async () => {
    if (!taskTitle.trim()) return alert('Title cannot be empty.');
    if (!taskCompany) return alert('Please select a company for this task.');

    const startDec = timeToDecimal(startTime);
    const endDec = timeToDecimal(endTime);
    const dur = Math.max(0.5, endDec - startDec);
    const todayStr = formatDateKey(new Date());
    
    const isStillOverdue = Boolean(taskDate && taskDate.trim() !== '' && taskDate < todayStr && selectedTask.status !== 'completed' && recurrenceType === 'once');

    const editNote = `✏️ Task details modified by ${currentUserName} [${getCurrentTimestamp()}]`;

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
      overdueNotified: isStillOverdue,
      isLongTerm,
      comments: [...(selectedTask.comments || []), editNote] 
    };

    setTasks(tasks.map(t => t.id === selectedTask.id ? updatedTask : t));

    const { error } = await supabase.from('tasks').update(mapToDb(updatedTask)).eq('id', updatedTask.id);
    if (error) {
      console.error('Supabase Update Error:', error);
      alert(`Cloud sync error: ${error.message}`);
    }

    selectedAssignees.forEach(assigneeName => {
      dispatchNotification(
        'userName', 
        assigneeName, 
        'update',
        `✏️ Updated: "${taskTitle}" details modified by Admin`,
        '✏️ Task Updated by Admin',
        `Details updated for "${taskTitle}"`,
        updatedTask.id,
        updatedTask.date
      );
    });

    setSelectedTask(updatedTask);
    setIsEditing(false);
  };

  const handleDeleteTask = async (id) => {
    const taskToDelete = tasks.find(t => t.id === id);
    setTasks(tasks.filter(t => t.id !== id));
    
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) console.error('Supabase Delete Error:', error);

    if (taskToDelete && taskToDelete.assignees) {
      taskToDelete.assignees.forEach(assigneeName => {
        dispatchNotification(
          'userName', 
          assigneeName, 
          'delete',
          `🗑️ Cancelled: "${taskToDelete.title}" removed from queue`,
          '🗑️ Task Cancelled',
          `"${taskToDelete.title}" was removed from your queue.`,
          null,
          null
        );
      });
    }

    setSelectedTask(null);
  };

  const handlePostOpenComment = async (id) => {
    if (!openCommentInput.trim()) return;
    
    const commentText = `💬 ${currentUserName} [${getCurrentTimestamp()}]:\n${openCommentInput}`;
    
    setTasks(tasks.map(t => t.id === id ? { ...t, comments: [...(t.comments || []), commentText] } : t));
    setSelectedTask(prev => ({ ...prev, comments: [...(prev.comments || []), commentText] }));
    
    const target = tasks.find(t => t.id === id);
    if (target) {
      const updatedComments = [...(target.comments || []), commentText];
      await supabase.from('tasks').update({ comments: updatedComments }).eq('id', id);
    }

    if (userRole === 'employee') {
      if (selectedTask?.notifyOnComment !== false) {
        dispatchNotification(
          'role',
          'admin',
          'comment',
          `💬 New Note on "${selectedTask.title}" by ${currentUserName}`,
          '💬 New Execution Note',
          `${currentUserName} commented on "${selectedTask.title}"`,
          selectedTask.id,
          selectedInstanceDate
        );
      }
    } else {
      (selectedTask.assignees || []).forEach(assigneeName => {
        dispatchNotification(
          'userName',
          assigneeName,
          'comment',
          `💬 Admin Update: New note on "${selectedTask.title}"`,
          '💬 Task Update',
          `Admin ${currentUserName} added a note to "${selectedTask.title}"`,
          selectedTask.id,
          selectedInstanceDate
        );
      });
    }

    setExecutionComment('');
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    if (file.type.startsWith('image/')) {
      file = await compressImage(file, 1280, 1280, 0.7);
    }

    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${selectedTask.id}-${Date.now()}.${fileExt}`;

    const { error: uploadErr } = await supabase.storage
      .from('task-proofs')
      .upload(fileName, file);

    if (uploadErr) {
      alert(`Upload failed: ${uploadErr.message}`);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('task-proofs')
      .getPublicUrl(fileName);

    const fileNote = `📎 File Attached by ${currentUserName} [${getCurrentTimestamp()}] (${file.name}):\n${publicUrl}`;
    const updatedComments = [...(selectedTask.comments || []), fileNote];
    const updatedTask = { ...selectedTask, comments: updatedComments };

    setSelectedTask(updatedTask);
    setTasks(tasks.map(t => t.id === selectedTask.id ? updatedTask : t));
    setPhotoUploaded(true);

    await supabase.from('tasks').update(mapToDb(updatedTask)).eq('id', selectedTask.id);

    if (userRole === 'employee') {
      if (selectedTask?.notifyOnComment !== false) {
        dispatchNotification(
          'role',
          'admin',
          'photo',
          `📎 File Uploaded for "${selectedTask.title}" by ${currentUserName}`,
          '📎 Proof File Uploaded',
          `${currentUserName} attached ${file.name} to "${selectedTask.title}"`,
          selectedTask.id,
          selectedInstanceDate
        );
      }
    } else {
      (selectedTask.assignees || []).forEach(assigneeName => {
        dispatchNotification(
          'userName',
          assigneeName,
          'photo',
          `📎 Admin Upload: File added to "${selectedTask.title}"`,
          '📎 File Attached',
          `Admin ${currentUserName} attached ${file.name} to "${selectedTask.title}"`,
          selectedTask.id,
          selectedInstanceDate
        );
      });
    }
  };

  const handleInitiateCompletion = () => {
    const hasAttachments = selectedTask.comments && selectedTask.comments.some(c => c.includes('📎 File Attached') || c.includes('📎 Proof Attached'));
    
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
      ? `💬 ${currentUserName} [${getCurrentTimestamp()}]:\n${openCommentInput}`
      : null;

    if (withFollowUp && completionPrompt) {
      if (!completionPrompt.title.trim()) {
        return alert("Please enter a title for the sub task.");
      }
    }

    const todayStrForCompletion = formatDateKey(new Date());

    let updatedTasks = tasks.map(t => {
      if (t.id === selectedTask.id) {
        if (t.status === 'completed' && t.recurrenceType === 'once') return t;

        const completionNote = `✅ Marked Complete by ${currentUserName} [${getCurrentTimestamp()}]`;
        const newComments = noteText 
          ? [...(t.comments || []), noteText, completionNote] 
          : [...(t.comments || []), completionNote];

        if (t.recurrenceType === 'once') {
          return { ...t, status: 'completed', isOverdue: false, completedDates: [todayStrForCompletion], comments: newComments };
        } else {
          const updatedCompletedDates = [...new Set([...(t.completedDates || []), selectedInstanceDate])];
          return { ...t, completedDates: updatedCompletedDates, isOverdue: false, comments: newComments };
        }
      }
      return t;
    });

    if (selectedTask?.notifyOnComplete !== false) {
      dispatchNotification(
        'role',
        'admin',
        'completion',
        `✓ Task Completed: "${selectedTask.title}" by ${currentUserName}`,
        '✓ Task Completed',
        `"${selectedTask.title}" marked complete by ${currentUserName}`,
        selectedTask.id,
        selectedInstanceDate
      );
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
        timeLabel: 'All-Day',
        priority: selectedTask.priority || 'Standard',
        requiresPhoto: false,
        requiresComment: false,
        allowAssigneeDeadlineChange: selectedTask.allowAssigneeDeadlineChange || false,
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
        isLongTerm: false,
        comments: [`📌 Sub-task deployed by ${currentUserName} upon completion of "${selectedTask.title}" [${getCurrentTimestamp()}]`]
      };

      if (selectedTask?.notifyOnTaskCreated !== false) {
        dispatchNotification(
          'role',
          'admin',
          'subtask',
          `➕ New Sub Task Spawned: "${completionPrompt.title}"`,
          '➕ Sub Task Spawned',
          `${currentUserName} created follow-up task: "${completionPrompt.title}"`,
          newAdHocTask.id,
          targetDate
        );
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
        comments: [`🔄 Interval series re-deployed ${selectedTask.cadenceDays || 14} days after completion [${getCurrentTimestamp()}]`]
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
        priority: nextStep.priority || 'Standard',
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
        isLongTerm: false,
        comments: [`⚙️ Pre-configured workflow step triggered by "${selectedTask.title}" [${getCurrentTimestamp()}]`]
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

    const noteText = `💬 ${currentUserName} (Follow-up) [${getCurrentTimestamp()}]:\n${additionalNote}`;
    setTasks(tasks.map(t => t.id === id ? { ...t, comments: [...(t.comments || []), noteText] } : t));
    
    const target = tasks.find(t => t.id === id);
    if (target) {
      const updatedComments = [...(target.comments || []), noteText];
      await supabase.from('tasks').update({ comments: updatedComments }).eq('id', id);
    }

    if (userRole === 'employee') {
      if (selectedTask?.notifyOnComment !== false) {
        dispatchNotification(
          'role',
          'admin',
          'comment',
          `💬 Follow-up Note on "${selectedTask.title}" by ${currentUserName}`,
          '💬 New Execution Note',
          `${currentUserName} added a follow-up note to "${selectedTask.title}"`,
          selectedTask.id,
          selectedInstanceDate
        );
      }
    } else {
      (selectedTask.assignees || []).forEach(assigneeName => {
        dispatchNotification(
          'userName',
          assigneeName,
          'comment',
          `💬 Admin Update: Follow-up note on "${selectedTask.title}"`,
          '💬 Task Update',
          `Admin ${currentUserName} added a follow-up note to "${selectedTask.title}"`,
          selectedTask.id,
          selectedInstanceDate
        );
      });
    }

    setAdditionalNote('');
    setSelectedTask(prev => ({ ...prev, comments: [...(prev.comments || []), noteText] }));
  };

  const handleReopenTask = async (id) => {
    const reopenNote = `⏪ Task reopened by ${currentUserName} [${getCurrentTimestamp()}]`;

    const updated = tasks.map(t => {
      if (t.id === id) {
        if (t.recurrenceType === 'once') {
          return { ...t, status: 'pending', completedDates: [], comments: [...(t.comments || []), reopenNote] };
        }
        return { ...t, completedDates: (t.completedDates || []).filter(d => d !== selectedInstanceDate), comments: [...(t.comments || []), reopenNote] };
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

  // --- NOTIFICATION CLICK HANDLER ---
  const handleNotificationClick = async (notif) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
    
    if (notif.taskId) {
      const targetTask = tasks.find(t => t.id === notif.taskId);
      if (targetTask) {
        handleOpenModal(targetTask, notif.taskDate || targetTask.date);
        setIsNotifOpen(false);
      } else {
        alert("This task could not be found or may have been deleted.");
      }
    } else {
       setIsNotifOpen(false);
    }
  };

  const renderComment = (commentText, index) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const hasUrl = urlRegex.test(commentText);

    if (!hasUrl) {
      return (
        <div key={index} className="text-xs text-gray-700 bg-gray-50 p-1.5 rounded border border-gray-200 shadow-2xs whitespace-pre-wrap">
          {commentText}
        </div>
      );
    }

    const match = commentText.match(/(https?:\/\/[^\s]+)/);
    const url = match ? match[0] : '';
    const textBeforeUrl = commentText.split(url)[0];
    const isImage = /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(url);

    return (
      <div key={index} className="text-xs text-gray-700 bg-gray-50 p-2 rounded border border-gray-200 shadow-2xs flex flex-col gap-1.5 whitespace-pre-wrap">
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

  const markAllNotifsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    
    setNotifications(notifications.map(n => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
  };

  const unreadNotifCount = notifications.filter(n => !n.read).length;

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'High': return { border: 'border-red-500', badge: 'bg-red-100 text-red-800' };
      case 'Standard':
      default: return { border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-800' };
    }
  };

  const renderPriorityPill = (task, instanceDateStr) => {
    const isPastDue = isTaskPastDue(task);
    const isDueToday = !isPastDue && isTaskDueToday(task, instanceDateStr);
    
    if (isPastDue) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 animate-pulse uppercase">Overdue</span>;
    }
    if (isDueToday) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 shadow-sm uppercase">Due Today</span>;
    }
    
    const style = getPriorityStyle(task.priority);
    return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.badge} uppercase`}>{task.priority}</span>;
  };

  const visibleMembers = userRole === 'admin' 
    ? teamMembers.filter(m => activeEmployeeFilters.includes(m.name) && !hiddenMembers.includes(m.name))
    : teamMembers.filter(m => m.name === currentUserName);

  const visibleTasks = tasks.filter(t => {
    if (!t || !t.assignees) return false;
    
    if (hiddenCompanies.includes(t.company)) return false;

    const isAssigneeMatch = userRole === 'admin' 
      ? (t.assignees.length === 0 || t.assignees.some(a => activeEmployeeFilters.includes(a) && !hiddenMembers.includes(a)))
      : t.assignees.includes(currentUserName);

    const isCompanyMatch = activeCompanyFilters.includes(t.company);

    const isSearchMatch = !searchQuery.trim() || 
      (t.title && t.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
      (t.desc && t.desc.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.assignees && t.assignees.some(a => a && a.toLowerCase().includes(searchQuery.toLowerCase())));

    return isAssigneeMatch && isCompanyMatch && isSearchMatch;
  });

  const backlogTasks = tasks.filter(t => !t.isLongTerm && (!t.assignees || t.assignees.length === 0) && t.status !== 'completed' && activeCompanyFilters.includes(t.company) && !hiddenCompanies.includes(t.company));
  
  const longTermTasks = visibleTasks.filter(t => t.isLongTerm && t.status !== 'completed' && (userRole === 'admin' || !isTaskPastDue(t)));

  const overdueTasks = visibleTasks.filter(t => isTaskPastDue(t));

  const searchResults = {
    tasks: tasks.filter(t => 
      searchQuery.trim() && !hiddenCompanies.includes(t.company) && (
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.comments && t.comments.some(c => c.toLowerCase().includes(searchQuery.toLowerCase())))
      )
    ).map(t => ({
      ...t,
      // Check if it's completed either by status or if it has completed dates
      isSearchCompleted: t.status === 'completed' || (t.completedDates && t.completedDates.length > 0)
    })).slice(0, 5),
    // ... companies and members stay exactly the same
    companies: masterCompanyList.filter(c => 
      searchQuery.trim() && !hiddenCompanies.includes(c) && c.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    members: teamMembers.filter(m => 
      searchQuery.trim() && !hiddenMembers.includes(m.name) && (
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    )
  };

  const hasSearchResults = searchResults.tasks.length > 0 || searchResults.companies.length > 0 || searchResults.members.length > 0;

  const viewTasks = currentView === 'day' 
    ? visibleTasks.filter(t => isTaskActiveOnDay(t, daysOfWeek[currentDate.getDay()], formatDateKey(currentDate)))
    : currentView === 'week'
    ? visibleTasks.filter(t => t.type === 'timed' && t.startHour !== null) 
    : [];

  gridStartHour = 6;
  gridEndHour = 20;

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
        
        {/* TOP NAVIGATION & CONTROLS HEADER */}
        <Header 
          currentProfile={currentProfile} session={session} userRole={userRole} 
          searchRef={searchRef} searchQuery={searchQuery} isSearchFocused={isSearchFocused} 
          setIsSearchFocused={setIsSearchFocused} setSearchQuery={setSearchQuery} 
          hasSearchResults={hasSearchResults} searchResults={searchResults} 
          handleOpenModal={handleOpenModal} formatDateKey={formatDateKey} 
          setActiveCompanyFilters={setActiveCompanyFilters} setActiveEmployeeFilters={setActiveEmployeeFilters} 
          handleLogout={handleLogout} handlePrevDate={handlePrevDate} handleToday={handleToday} 
          handleNextDate={handleNextDate} getHeaderTitle={getHeaderTitle} 
          currentView={currentView} setCurrentView={setCurrentView} 
          isNotifOpen={isNotifOpen} setIsNotifOpen={setIsNotifOpen} 
          unreadNotifCount={unreadNotifCount} markAllNotifsRead={markAllNotifsRead} 
          notifications={notifications} handleNotificationClick={handleNotificationClick} 
          currentUserName={currentUserName} resetMemberForm={resetMemberForm} 
          setIsSettingsOpen={setIsSettingsOpen} handleOpenCreateView={handleOpenCreateView} 
        />

        {/* TEAM MEMBER & COMPANY FILTER BAR */}
        <FilterBar 
          currentView={currentView}
          masterCompanyList={masterCompanyList}
          hiddenCompanies={hiddenCompanies}
          activeCompanyFilters={activeCompanyFilters}
          toggleCompanyFilter={toggleCompanyFilter}
          userRole={userRole}
          teamMembers={teamMembers}
          hiddenMembers={hiddenMembers}
          activeEmployeeFilters={activeEmployeeFilters}
          toggleEmployeeFilter={toggleEmployeeFilter}
          setActiveCompanyFilters={setActiveCompanyFilters}
          setActiveEmployeeFilters={setActiveEmployeeFilters}
        />

        {/* CONDITIONAL DASHBOARD TRAYS (OVERDUE, PIPELINE, BACKLOG) */}
    <DashboardTrays 
      userRole={userRole}
      currentView={currentView}
      overdueTasks={overdueTasks}
      getMissedDate={getMissedDate}
      handleOpenModal={handleOpenModal}
      renderPriorityPill={renderPriorityPill}
      getMemberConfig={getMemberConfig}
      longTermTasks={longTermTasks}
      resizingTaskId={resizingTaskId}
      handleDragStart={handleDragStart}
      handleDragEnd={handleDragEnd}
      formatDateKey={formatDateKey}
      currentDate={currentDate}
      isTaskPastDue={isTaskPastDue}
      backlogTasks={backlogTasks}
      listScope={listScope}
    />

        {/* LIST & COMPLETED VIEWS */}
        {(currentView === 'list' || currentView === 'completed') && (
          <ListAndCompletedViews 
            currentView={currentView}
            listScope={listScope}
            setListScope={setListScope}
            getHeaderTitle={getHeaderTitle}
            currentDate={currentDate}
            getWeekStart={getWeekStart}
            daysOfWeek={daysOfWeek}
            formatDateKey={formatDateKey}
            masterCompanyList={masterCompanyList}
            activeCompanyFilters={activeCompanyFilters}
            hiddenCompanies={hiddenCompanies}
            visibleTasks={visibleTasks}
            isTaskActiveOnDay={isTaskActiveOnDay}
            isTaskCompletedOnDay={isTaskCompletedOnDay}
            backlogTasks={backlogTasks}
            userRole={userRole}
            handleDragStart={handleDragStart}
            handleDragEnd={handleDragEnd}
            handleOpenModal={handleOpenModal}
            getPriorityStyle={getPriorityStyle}
            isTaskPastDue={isTaskPastDue}
            isTaskDueToday={isTaskDueToday}
            renderPriorityPill={renderPriorityPill}
            getMemberConfig={getMemberConfig}
          />
        )}

        {/* DAY VIEW */}
        {currentView === 'day' && (
          <DayView 
            visibleMembers={visibleMembers}
            formatDateKey={formatDateKey}
            currentDate={currentDate}
            visibleTasks={visibleTasks}
            isTaskActiveOnDay={isTaskActiveOnDay}
            daysOfWeek={daysOfWeek}
            handleDropSlot={handleDropSlot}
            userRole={userRole}
            resizingTaskId={resizingTaskId}
            handleDragStart={handleDragStart}
            handleDragEnd={handleDragEnd}
            handleOpenModal={handleOpenModal}
            dynamicTimeSlots={dynamicTimeSlots}
            minuteSubSlots={minuteSubSlots}
            handleSubSlotDragOver={handleSubSlotDragOver}
            decimalToTimeString={decimalToTimeString}
            draggedTaskObj={draggedTaskObj}
            hoverSlot={hoverSlot}
            formatTimeLabel={formatTimeLabel}
            computeDynamicLayouts={computeDynamicLayouts}
            isTaskPastDue={isTaskPastDue}
            handleResizeStart={handleResizeStart}
            gridStartHour={gridStartHour}
          />
        )}

        {/* WEEK VIEW */}
        {currentView === 'week' && (
          <WeekView 
            daysOfWeek={daysOfWeek}
            getWeekStart={getWeekStart}
            currentDate={currentDate}
            formatDateKey={formatDateKey}
            visibleTasks={visibleTasks}
            isTaskActiveOnDay={isTaskActiveOnDay}
            handleDropSlot={handleDropSlot}
            getMemberConfig={getMemberConfig}
            userRole={userRole}
            resizingTaskId={resizingTaskId}
            handleDragStart={handleDragStart}
            handleDragEnd={handleDragEnd}
            handleOpenModal={handleOpenModal}
            isTaskPastDue={isTaskPastDue}
            dynamicTimeSlots={dynamicTimeSlots}
            computeDynamicLayouts={computeDynamicLayouts}
            minuteSubSlots={minuteSubSlots}
            handleSubSlotDragOver={handleSubSlotDragOver}
            decimalToTimeString={decimalToTimeString}
            draggedTaskObj={draggedTaskObj}
            hoverSlot={hoverSlot}
            gridStartHour={gridStartHour}
            formatTimeLabel={formatTimeLabel}
            handleResizeStart={handleResizeStart}
          />
        )}

        {/* MONTH VIEW */}
        {currentView === 'month' && (
          <MonthView 
            daysOfWeek={daysOfWeek}
            currentDate={currentDate}
            formatDateKey={formatDateKey}
            visibleTasks={visibleTasks}
            isTaskActiveOnDay={isTaskActiveOnDay}
            isTaskCompletedOnDay={isTaskCompletedOnDay}
            handleDragOver={handleDragOver}
            handleDropSlot={handleDropSlot}
            getMemberConfig={getMemberConfig}
            userRole={userRole}
            resizingTaskId={resizingTaskId}
            handleDragStart={handleDragStart}
            handleDragEnd={handleDragEnd}
            handleOpenModal={handleOpenModal}
            isTaskPastDue={isTaskPastDue}
          />
        )}

        {/* TASK BUILDER VIEW */}
        {currentView === 'create' && (
          <TaskBuilder 
            setCurrentView={setCurrentView} previousView={previousView} taskTitle={taskTitle} 
            setTaskTitle={setTaskTitle} taskDesc={taskDesc} setTaskDesc={setTaskDesc} 
            taskCompany={taskCompany} setTaskCompany={setTaskCompany} masterCompanyList={masterCompanyList} 
            taskPriority={taskPriority} setTaskPriority={setTaskPriority} taskDate={taskDate} 
            setTaskDate={setTaskDate} hasSpecificTime={hasSpecificTime} setHasSpecificTime={setHasSpecificTime} 
            startTime={startTime} setStartTime={setStartTime} endTime={endTime} setEndTime={setEndTime} 
            isLongTerm={isLongTerm} setIsLongTerm={setIsLongTerm} teamMembers={teamMembers} 
            selectedAssignees={selectedAssignees} handleAddAssignee={handleAddAssignee} 
            handleRemoveAssignee={handleRemoveAssignee} recurrenceType={recurrenceType} 
            setRecurrenceType={setRecurrenceType} activeDays={activeDays} toggleDay={toggleDay} 
            cadenceDays={cadenceDays} setCadenceDays={setCadenceDays} chainedSteps={chainedSteps} 
            handleAddChainedStep={handleAddChainedStep} handleUpdateChainedStep={handleUpdateChainedStep} 
            handleRemoveChainedStep={handleRemoveChainedStep} requiresPhoto={requiresPhoto} 
            setRequiresPhoto={setRequiresPhoto} requiresComment={requiresComment} 
            setRequiresComment={setRequiresComment} allowAssigneeDeadlineChange={allowAssigneeDeadlineChange} 
            setAllowAssigneeDeadlineChange={setAllowAssigneeDeadlineChange} notifyOnComplete={notifyOnComplete} 
            setNotifyOnComplete={setNotifyOnComplete} notifyOnComment={notifyOnComment} 
            setNotifyOnComment={setNotifyOnComment} notifyOnDeadlineChange={notifyOnDeadlineChange} 
            setNotifyOnDeadlineChange={setNotifyOnDeadlineChange} notifyOnTaskCreated={notifyOnTaskCreated} 
            setNotifyOnTaskCreated={setNotifyOnTaskCreated} handleDeployTask={handleDeployTask}
          />
        )}

        {/* TASK INSPECTOR & FULL EDITING MODAL */}
        <TaskInspectorModal 
          selectedTask={selectedTask} setSelectedTask={setSelectedTask} selectedInstanceDate={selectedInstanceDate}
          isCurrentInstanceCompleted={isCurrentInstanceCompleted} userRole={userRole} currentUserName={currentUserName}
          teamMembers={teamMembers} masterCompanyList={masterCompanyList} isEditing={isEditing} setIsEditing={setIsEditing}
          taskTitle={taskTitle} setTaskTitle={setTaskTitle} taskDesc={taskDesc} setTaskDesc={setTaskDesc} taskCompany={taskCompany}
          setTaskCompany={setTaskCompany} taskPriority={taskPriority} setTaskPriority={setTaskPriority} taskDate={taskDate}
          setTaskDate={setTaskDate} hasSpecificTime={hasSpecificTime} setHasSpecificTime={setHasSpecificTime} startTime={startTime}
          setStartTime={setStartTime} endTime={endTime} setEndTime={setEndTime} isLongTerm={isLongTerm} setIsLongTerm={setIsLongTerm}
          selectedAssignees={selectedAssignees} handleAddAssignee={handleAddAssignee} handleRemoveAssignee={handleRemoveAssignee}
          recurrenceType={recurrenceType} setRecurrenceType={setRecurrenceType} activeDays={activeDays} toggleDay={toggleDay}
          cadenceDays={cadenceDays} setCadenceDays={setCadenceDays} chainedSteps={chainedSteps} handleAddChainedStep={handleAddChainedStep}
          handleUpdateChainedStep={handleUpdateChainedStep} handleRemoveChainedStep={handleRemoveChainedStep} requiresPhoto={requiresPhoto}
          setRequiresPhoto={setRequiresPhoto} requiresComment={requiresComment} setRequiresComment={setRequiresComment}
          allowAssigneeDeadlineChange={allowAssigneeDeadlineChange} setAllowAssigneeDeadlineChange={setAllowAssigneeDeadlineChange}
          notifyOnComplete={notifyOnComplete} setNotifyOnComplete={setNotifyOnComplete} notifyOnComment={notifyOnComment}
          setNotifyOnComment={setNotifyOnComment} notifyOnDeadlineChange={notifyOnDeadlineChange} setNotifyOnDeadlineChange={setNotifyOnDeadlineChange}
          notifyOnTaskCreated={notifyOnTaskCreated} setNotifyOnTaskCreated={setNotifyOnTaskCreated} openCommentInput={openCommentInput}
          setExecutionComment={setExecutionComment} handlePostOpenComment={handlePostOpenComment} isDraggingFile={isDraggingFile}
          setIsDraggingFile={setIsDraggingFile} handleFileUpload={handleFileUpload} additionalNote={additionalNote} setAdditionalNote={setAdditionalNote}
          handleAppendNote={handleAppendNote} handleSaveChanges={handleSaveChanges} handleDeleteTask={handleDeleteTask} handleReopenTask={handleReopenTask}
          handleInitiateCompletion={handleInitiateCompletion} handleOpenModal={handleOpenModal} isTaskPastDue={isTaskPastDue}
          getCurrentTimestamp={getCurrentTimestamp} tasks={tasks} setTasks={setTasks} dispatchNotification={dispatchNotification} renderComment={renderComment}
        />

        {/* SUB-TASK COMPLETION PROMPT MODAL */}
        <CompletionModal 
          completionPrompt={completionPrompt}
          setCompletionPrompt={setCompletionPrompt}
          selectedTask={selectedTask}
          executeCompletion={executeCompletion}
          teamMembers={teamMembers}
        />

       {/* RECURRING TASK RESCHEDULE SCOPE PROMPT MODAL */}
        <RescheduleModal 
          reschedulePrompt={reschedulePrompt}
          setReschedulePrompt={setReschedulePrompt}
          applyTaskMove={applyTaskMove}
        />

      {/* SETTINGS & GOVERNANCE MODAL */}
       <SettingsModal 
          isSettingsOpen={isSettingsOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          userRole={userRole}
          currentUserName={currentUserName}
          hiddenCompanies={hiddenCompanies}
          setHiddenCompanies={setHiddenCompanies}
          masterCompanyList={masterCompanyList}
          hiddenMembers={hiddenMembers}
          setHiddenMembers={setHiddenMembers}
          teamMembers={teamMembers}
          resetMemberForm={resetMemberForm}
          handleOpenEditMember={handleOpenEditMember}
          editingMemberId={editingMemberId}
          memberName={memberName}
          setMemberName={setMemberName}
          memberEmail={memberEmail}
          setMemberEmail={setMemberEmail}
          memberPassword={memberPassword}
          setMemberPassword={setMemberPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          memberRole={memberRole}
          setMemberRole={setMemberRole}
          memberColor={memberColor}
          setMemberColor={setMemberColor}
          handleDeleteMember={handleDeleteMember}
          handleSaveMember={handleSaveMember}
          newCompanyInput={newCompanyInput}
          setNewCompanyInput={setNewCompanyInput}
          handleAddCompany={handleAddCompany}
          editingCompany={editingCompany}
          editingCompanyInput={editingCompanyInput}
          setEditingCompanyInput={setEditingCompanyInput}
          handleRenameCompany={handleRenameCompany}
          setEditingCompany={setEditingCompany}
          handleDeleteCompany={handleDeleteCompany}
        />

      </div>
    </div>
  );
}
