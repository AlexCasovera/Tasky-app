// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';

// --- STATIC CALENDAR HELPERS ---
const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const minuteSubSlots = [0, 0.25, 0.5, 0.75];

// --- IMAGE COMPRESSION ENGINE ---
const compressImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
            } else {
              resolve(file); 
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

// --- NATIVE VAPID PUSH CONFIGURATION ---
const VAPID_PUBLIC_KEY = "BEdpaFVtcj6F-vvykhLdOaDDzUUmcnVB0knI0VjfJjqLLAStEKll692mf1M3xUAo_KS8djPg-YCIya9GOtHB3cA";

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const enableNativePush = async (userName: string) => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('Native Push notifications are not supported on this browser.');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Notification permission denied by browser.');
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    const { error } = await supabase
      .from('profiles')
      .update({ push_subscription: subscription })
      .eq('name', userName);

    if (error) {
      console.error('Failed to save push subscription to Supabase:', error);
      alert('Failed to save push subscription to database.');
    } else {
      alert('📲 Native Push Notifications Enabled Successfully!');
    }
  } catch (err) {
    console.error('Error enabling native push:', err);
    alert('Error enabling push notifications: ' + err.message);
  }
};

const sendNativePush = async ({ targetType, targetValue, title, message }) => {
  try {
    let query = supabase.from('profiles').select('push_subscription');
    if (targetType === 'role') {
      query = query.eq('role', targetValue);
    } else {
      query = query.eq('name', targetValue);
    }

    const { data, error } = await query;
    if (error || !data) return;

    for (const profile of data) {
      if (profile.push_subscription) {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: profile.push_subscription,
            title,
            message
          })
        });
      }
    }
  } catch (err) {
    console.error('Push Notification Error:', err);
  }
};

const formatDateKey = (d) => {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const mapToDb = (t) => {
  let dbPriority = t.priority || 'Routine';
  if (dbPriority === 'Standard') {
    dbPriority = 'Routine';
  }

  return {
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
    priority: dbPriority,
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
    is_overdue: t.is_overdue ?? false,
    overdue_notified: t.overdue_notified ?? false,
    is_long_term: t.isLongTerm ?? false // <-- TYPO FIXED
  };
};

const mapFromDb = (r) => {
  let mappedPriority = r.priority || 'Standard';
  if (mappedPriority === 'Medium' || mappedPriority === 'Low' || mappedPriority === 'Routine') {
    mappedPriority = 'Standard';
  }

  return {
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
    priority: mappedPriority,
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
    overdueNotified: r.overdue_notified ?? false,
    isLongTerm: r.is_long_term ?? false
  };
};

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

// 💾 AUTO-SAVE: Sync to local storage whenever notifications change
  useEffect(() => {
    if (currentUserName && hasLoadedNotifs.current === currentUserName) {
      localStorage.setItem('tasky_notifs_' + currentUserName, JSON.stringify(notifications));
    }
  }, [notifications, currentUserName]);

  useEffect(() => {
    if (!currentUserName) {
      hasLoadedNotifs.current = null;
      return;
    }

    // 1. Load user's saved notifications from cache on startup
    const savedNotifs = localStorage.getItem('tasky_notifs_' + currentUserName);
    if (savedNotifs) {
      setNotifications(JSON.parse(savedNotifs));
    } else {
      setNotifications([]); 
    }
    // CRITICAL FIX: Lock the loaded state to this specific username
    hasLoadedNotifs.current = currentUserName; 

    // 2. Open Realtime channel
    const channel = supabase.channel('app-notifications')
      .on('broadcast', { event: 'app-alert' }, ({ payload }) => {
        const isForMe = 
          (payload.targetType === 'role' && payload.targetValue === userRole) || 
          (payload.targetType === 'userName' && payload.targetValue === currentUserName);
          
        if (isForMe) {
          // Cap at 50 to prevent the menu from becoming bloated and lagging
          setNotifications(prev => [payload, ...prev].slice(0, 50));
        }
      })
      .subscribe();

    notifyChannel.current = channel;

    return () => {
      supabase.removeChannel(channel);
    }
  }, [userRole, currentUserName]);

  // --- UNIFIED NOTIFICATION DISPATCHER ---
  const dispatchNotification = (targetType, targetValue, type, bellText, pushTitle, pushMessage, taskId = null, taskDate = null) => {
    if (pushTitle && pushMessage) {
      sendNativePush({
        targetType,
        targetValue,
        title: pushTitle,
        message: pushMessage
      });
    }

    if (bellText) {
      notifyChannel.current?.send({
        type: 'broadcast',
        event: 'app-alert',
        payload: { 
          id: Date.now() + Math.random(), 
          text: bellText, 
          type, 
          targetType, 
          targetValue, 
          taskId,
          taskDate,
          read: false, 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        }
      });
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

      const notifyUsers = targetMemberName ? [targetMemberName] : (targetTask.assignees || []);
      notifyUsers.forEach(assigneeName => {
        dispatchNotification(
          'userName',
          assigneeName,
          'schedule',
          `📅 Rescheduled: "${targetTask.title}" moved to ${targetDate}`,
          '📅 Schedule Updated',
          `"${targetTask.title}" has been moved to ${targetDate}`,
          targetTask.id,
          targetDate
        );
      });

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
  const handleNotificationClick = (notif) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    
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

  const markAllNotifsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
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
    ).slice(0, 5),
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
        
        {/* REAL USER SESSION HEADER WITH HCP GLOBAL SEARCH */}
        <div className="bg-[#333333] text-white px-4 py-2 rounded-md mb-4 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs shadow-md z-40 relative">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-400 uppercase tracking-wider">User:</span>
            <span className="text-white font-semibold">{currentProfile?.name || session?.user?.email}</span>
            <span className="text-gray-500">|</span>
            <span className="font-bold text-gray-400 uppercase tracking-wider">Role:</span>
            <span className="text-amber-400 font-bold uppercase">{userRole}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            
            {/* HCP OVERLAY SEARCH INPUT & DROPDOWN */}
            <div className="relative w-full sm:w-80" ref={searchRef}>
              <div className="flex items-center bg-gray-800 rounded border border-gray-700 focus-within:border-[#A9B1A6] px-2.5 py-1">
                <span className="text-gray-400 mr-2 text-xs">🔍</span>
                <input 
                  type="text" 
                  value={searchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchFocused(true);
                  }}
                  placeholder="Search jobs, companies, notes..." 
                  className="bg-transparent text-white placeholder-gray-400 text-xs focus:outline-none w-full" 
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setIsSearchFocused(false); }} className="text-gray-400 hover:text-white font-bold text-xs ml-1">✕</button>
                )}
              </div>

              {/* HCP STYLE OVERLAY DROPDOWN PANEL */}
              {isSearchFocused && searchQuery.trim().length > 0 && (
                <div className="absolute left-0 right-0 mt-2 bg-white rounded-lg shadow-2xl border border-gray-300 text-gray-800 z-50 overflow-hidden animate-fade-in max-h-96 overflow-y-auto">
                  {hasSearchResults ? (
                    <div className="flex flex-col">
                      
                      {/* TASKS SECTION */}
                      {searchResults.tasks.length > 0 && (
                        <div className="p-2 border-b border-gray-100">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 block mb-1">📋 Jobs & Tasks</span>
                          {searchResults.tasks.map(task => (
                            <div 
                              key={task.id}
                              onClick={() => {
                                handleOpenModal(task, task.date || formatDateKey(new Date()));
                                setIsSearchFocused(false);
                                setSearchQuery('');
                              }}
                              className="p-2 hover:bg-blue-50 rounded cursor-pointer transition flex items-center justify-between group"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-gray-900 group-hover:text-blue-600 truncate">{task.title}</span>
                                  <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold shrink-0">{task.company}</span>
                                </div>
                                <p className="text-[10px] text-gray-500 truncate mt-0.5">{task.desc}</p>
                              </div>
                              <span className="text-[10px] font-mono text-gray-400 shrink-0">{task.date || 'Unscheduled'}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* COMPANIES SECTION */}
                      {searchResults.companies.length > 0 && (
                        <div className="p-2 border-b border-gray-100 bg-gray-50/50">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 block mb-1">🏢 Companies</span>
                          {searchResults.companies.map(comp => (
                            <div 
                              key={comp}
                              onClick={() => {
                                setActiveCompanyFilters([comp]);
                                setIsSearchFocused(false);
                                setSearchQuery('');
                              }}
                              className="p-1.5 hover:bg-gray-200/60 rounded cursor-pointer transition flex items-center justify-between text-xs font-bold text-gray-700"
                            >
                              <span>{comp}</span>
                              <span className="text-[9px] text-blue-600 font-semibold">Filter Dashboard →</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* TEAM MEMBERS SECTION */}
                      {searchResults.members.length > 0 && (
                        <div className="p-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 block mb-1">👤 Team Members</span>
                          {searchResults.members.map(member => (
                            <div 
                              key={member.id}
                              onClick={() => {
                                setActiveEmployeeFilters([member.name]);
                                setIsSearchFocused(false);
                                setSearchQuery('');
                              }}
                              className="p-1.5 hover:bg-gray-100 rounded cursor-pointer transition flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: member.color }}></span>
                                <span className="font-bold text-xs text-gray-800">{member.name}</span>
                              </div>
                              <span className="text-[9px] text-gray-400">{member.email}</span>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-gray-400 italic">
                      No results found for "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>

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
              <button onClick={() => setCurrentView('completed')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${currentView === 'completed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Completed</button>
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
                <div className="absolute -left-[4px] sm:left-auto sm:right-0 mt-2 w-72 sm:w-80 bg-white rounded-lg shadow-xl border border-gray-300 z-50 p-3 animate-fade-in">
                  <div className="flex justify-between items-center border-b pb-2 mb-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700">Notification Center</h4>
                    <button onClick={markAllNotifsRead} className="text-[10px] text-blue-600 font-bold hover:underline">Mark all read</button>
                  </div>
                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                    {notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => handleNotificationClick(n)}
                        className={`p-2 rounded text-xs border cursor-pointer hover:brightness-95 transition ${n.read ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-blue-50 border-blue-200 text-blue-900 shadow-2xs font-bold'}`}>
                        <div className="flex justify-between items-start gap-2">
                          <span className="leading-tight">{n.text}</span>
                          <span className={`text-[9px] shrink-0 ${n.read ? 'text-gray-400' : 'text-blue-500 font-bold'}`}>{n.time}</span>
                        </div>
                        {n.taskId && (
                          <div className="mt-1 text-[9px] text-gray-400 font-bold uppercase">
                            Click to View ↗
                          </div>
                        )}
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <p className="text-xs text-gray-400 italic text-center py-2">No notifications for {currentUserName}.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => { resetMemberForm(); setIsSettingsOpen(true); }}
              className="bg-white p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition font-bold text-sm"
              title="Settings & Preferences">
              ⚙️
            </button>

            {userRole === 'admin' && currentView !== 'create' && (
              <button onClick={handleOpenCreateView} className="bg-[#5B7049] text-white px-4 py-2 rounded text-xs font-bold shadow-sm hover:bg-[#465638] transition">
                + New Task
              </button>
            )}
          </div>
        </div>

        {/* TEAM MEMBER & COMPANY FILTER BAR */}
        {currentView !== 'create' && (
          <div className="bg-white p-3 rounded-lg border border-gray-200 mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Companies:</span>
                <div className="flex flex-wrap gap-1">
                  {masterCompanyList.filter(c => !hiddenCompanies.includes(c)).map(comp => {
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

              {userRole === 'admin' && (
                <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Team:</span>
                  <div className="flex flex-wrap gap-1">
                    {teamMembers.filter(m => !hiddenMembers.includes(m.name)).map(m => {
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
              )}
            </div>

            <button 
              onClick={() => {
                setActiveCompanyFilters([...masterCompanyList]);
                if (userRole === 'admin') setActiveEmployeeFilters(teamMembers.map(m => m.name));
              }} 
              className="text-[11px] font-bold text-[#A9B1A6] hover:underline self-end md:self-center">
              Reset All Filters
            </button>
          </div>
        )}

        {/* 🚨 EMPLOYEE OVERDUE ALERT TRAY 🚨 */}
        {userRole === 'employee' && overdueTasks.length > 0 && currentView !== 'create' && currentView !== 'completed' && (
          <div className="bg-red-50 border-2 border-red-500 rounded-lg p-3 mb-4 shadow-sm animate-fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-red-800 flex items-center gap-2">
                🚨 Past Due Tasks ({overdueTasks.length} Action Required)
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {overdueTasks.map(task => {
                const missedDate = getMissedDate(task);
                return (
                  <div 
                    key={`overdue-${task.id}`}
                    onClick={() => handleOpenModal(task, missedDate)}
                    className="bg-white px-3 py-2 rounded border border-red-300 text-xs font-bold text-gray-800 cursor-pointer hover:bg-red-100 transition shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-l-4 border-l-red-600">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-mono border border-red-200 shrink-0">Due: {missedDate}</span>
                      <span className="truncate text-sm">{task.title}</span>
                      <span className="text-[9px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded shrink-0">{task.company}</span>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      {renderPriorityPill(task, missedDate)}
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
            </div>
          </div>
        )}

        {/* LONG-TERM PIPELINE TRAY */}
        {(userRole === 'admin' || userRole === 'employee') && longTermTasks.length > 0 && currentView !== 'create' && currentView !== 'completed' && (
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2">
                📌 Long-Term & Pipeline Tasks ({longTermTasks.length} Active)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {longTermTasks.map(task => {
                const isOverdue = isTaskPastDue(task);
                return (
                  <div 
                    key={`lt-${task.id}`}
                    draggable={userRole === 'admin' && !resizingTaskId}
                    onDragStart={(e) => handleDragStart(e, task.id, task.date)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleOpenModal(task, formatDateKey(currentDate))}
                    className={`px-3 py-1.5 rounded border text-xs font-bold transition shadow-2xs flex items-center gap-2 ${userRole === 'admin' && !resizingTaskId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${isOverdue ? 'border-red-500 ring-1 ring-red-400 bg-red-50 text-red-900 hover:bg-red-100' : 'bg-white border-blue-200 text-gray-800 hover:bg-blue-100'}`}>
                    <span>{task.title}</span>
                    <span className="text-[9px] bg-gray-200 text-gray-700 px-1 py-0.5 rounded">{task.company}</span>
                    {task.date && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${isOverdue ? 'bg-red-100 text-red-800 border-red-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>Due: {task.date}</span>}
                    {(!task.assignees || task.assignees.length === 0) && <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">Unassigned</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* UNASSIGNED BACKLOG TRAY */}
        {userRole === 'admin' && backlogTasks.length > 0 && currentView !== 'create' && currentView !== 'completed' && (currentView !== 'list' || listScope === 'day') && (
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

        {/* LIST & COMPLETED VIEWS */}
        {(currentView === 'list' || currentView === 'completed') && (
          <div className="flex-col flex gap-6 overflow-y-auto pr-2">
            
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${currentView === 'completed' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  {listScope === 'week' 
                    ? (currentView === 'completed' ? 'Completed Tasks Overview' : 'Weekly Overview') 
                    : (currentView === 'completed' ? `Completed on ${getHeaderTitle()}` : `Tasks for ${getHeaderTitle()}`)
                  }
                </h2>
              </div>
              
              <div className="bg-gray-200 p-0.5 rounded flex items-center border border-gray-300 shadow-inner">
                <button 
                  onClick={() => setListScope('day')}
                  className={`px-3 py-1 text-[10px] font-bold rounded transition ${listScope === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  1-Day
                </button>
                <button 
                  onClick={() => setListScope('week')}
                  className={`px-3 py-1 text-[10px] font-bold rounded transition ${listScope === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  7-Day
                </button>
              </div>
            </div>

            {listScope === 'week' ? (
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
                    {masterCompanyList.filter(c => activeCompanyFilters.includes(c) && !hiddenCompanies.includes(c)).map(company => {
                      
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

                      const priorityScore = { High: 1, Standard: 2 };
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
                          
                          {currentView === 'list' && (
                            <>
                              {userRole === 'admin' && compBacklog.length > 0 && (
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
                                  const isPastDue = isTaskPastDue(task);
                                  const isDueToday = !isPastDue && isTaskDueToday(task, task.instanceDate);

                                  let borderClass = style.border;
                                  let bgClass = "bg-white";
                                  if (isPastDue) {
                                    borderClass = "border-red-600 ring-1 ring-red-400";
                                    bgClass = "bg-red-50/50";
                                  } else if (isDueToday) {
                                    borderClass = "border-amber-500 ring-1 ring-amber-400";
                                    bgClass = "bg-amber-50/20";
                                  }

                                  return (
                                    <div 
                                      key={`${task.id}-${task.instanceDate}`}
                                      onClick={() => handleOpenModal(task, task.instanceDate)}
                                      className={`${bgClass} p-3 rounded border-l-4 ${borderClass} shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-gray-50 transition gap-3`}>
                                      
                                      <div className="flex items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-2/3">
                                        <div className="flex flex-col items-center justify-center bg-gray-50 rounded px-2.5 py-1 min-w-[50px] border border-gray-200 shrink-0">
                                          <span className="text-[9px] font-bold text-gray-500 uppercase">{task.instanceDay}</span>
                                          <span className="text-sm font-bold text-gray-800">{task.instanceDate.split('-')[2]}</span>
                                        </div>
                                        
                                        <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 shrink-0 self-start sm:self-auto">{task.timeLabel}</span>
                                        
                                        <div className="truncate pr-2 w-full">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-sm truncate">{task.title}</h3>
                                            {task.company && <span className="text-[9px] bg-gray-200 text-gray-700 px-1 py-0.5 rounded">{task.company}</span>}
                                            {task.recurrenceType === 'completion' && <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded shrink-0">🔄</span>}
                                          </div>
                                          <p className="text-[11px] text-gray-500 truncate">{task.desc}</p>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 mt-1 sm:mt-0">
                                        
                                        {renderPriorityPill(task, task.instanceDate)}

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
                                
                                {compWeekTasks.length === 0 && (userRole !== 'admin' || compBacklog.length === 0) && (
                                  <div className="bg-white p-6 rounded text-center border border-dashed border-gray-300">
                                    <p className="text-sm text-gray-500 font-bold">No active tasks scheduled for {company} this week.</p>
                                  </div>
                                )}
                              </div>
                            </>
                          )}

                          {currentView === 'completed' && (
                            <div className="flex flex-col gap-2">
                              {compWeekCompleted.length > 0 ? (
                                compWeekCompleted.map(task => (
                                  <div 
                                    key={`${task.id}-comp-${task.instanceDate}`}
                                    onClick={() => handleOpenModal(task, task.instanceDate)}
                                    className="bg-gray-200/60 p-2.5 rounded flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-gray-200 transition gap-2">
                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                      <div className="flex flex-col items-center justify-center bg-gray-300/50 rounded px-2 py-0.5 min-w-[40px] shrink-0">
                                        <span className="text-[8px] font-bold text-gray-500 uppercase">{task.instanceDay}</span>
                                        <span className="text-xs font-bold text-gray-600">{task.instanceDate.split('-')[2]}</span>
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <span className="line-through text-xs font-bold text-gray-600 block truncate">{task.title}</span>
                                        <span className="text-[10px] text-gray-500">Assigned to: {(task.assignees || []).join(', ')}</span>
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-300 self-end sm:self-auto shrink-0">
                                      ✓ Completed
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div className="bg-white p-6 rounded text-center border border-dashed border-gray-300">
                                  <p className="text-sm text-gray-500 font-bold">No completed tasks for {company} this week.</p>
                                </div>
                              )}
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
                {currentView === 'list' && (
                  <div className="flex flex-col gap-3">
                    {visibleTasks.filter(t => isTaskActiveOnDay(t, daysOfWeek[currentDate.getDay()], formatDateKey(currentDate))).length > 0 ? (
                      visibleTasks
                        .filter(t => isTaskActiveOnDay(t, daysOfWeek[currentDate.getDay()], formatDateKey(currentDate)))
                        .map(task => {
                          const style = getPriorityStyle(task.priority);
                          const isPastDue = isTaskPastDue(task);
                          const isDueToday = !isPastDue && isTaskDueToday(task, formatDateKey(currentDate));

                          let borderClass = style.border;
                          let bgClass = "bg-white";
                          if (isPastDue) {
                            borderClass = "border-red-600 ring-1 ring-red-400";
                            bgClass = "bg-red-50/50";
                          } else if (isDueToday) {
                            borderClass = "border-amber-500 ring-1 ring-amber-400";
                            bgClass = "bg-amber-50/20";
                          }

                          return (
                            <div 
                              key={task.id}
                              onClick={() => handleOpenModal(task, formatDateKey(currentDate))}
                              className={`${bgClass} p-3 sm:p-4 rounded border-l-4 ${borderClass} shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-gray-50 transition gap-3 sm:gap-0`}>
                              <div className="w-full sm:w-2/3 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                                <span className="font-mono text-[10px] sm:text-sm font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 shrink-0 self-start sm:self-auto">{task.timeLabel}</span>
                                <div className="min-w-0 w-full">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-bold text-base sm:text-lg truncate">{task.title}</h3>
                                    <span className="text-[9px] bg-gray-200 text-gray-700 px-1 py-0.5 rounded">{task.company}</span>
                                    {task.recurrenceType === 'completion' && <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">🔄 Interval</span>}
                                  </div>
                                  <p className="text-xs sm:text-sm text-gray-500 truncate">{task.desc}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100 mt-1 sm:mt-0">
                                
                                {renderPriorityPill(task, formatDateKey(currentDate))}

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
                        })
                    ) : (
                      <div className="bg-white p-8 rounded text-center border border-dashed border-gray-300">
                        <p className="text-sm text-gray-500 font-bold">No active tasks scheduled for this date.</p>
                      </div>
                    )}
                  </div>
                )}

                {currentView === 'completed' && (
                  <div className="flex flex-col gap-2 mt-2">
                    {visibleTasks.filter(t => isTaskCompletedOnDay(t, formatDateKey(currentDate))).length > 0 ? (
                      visibleTasks.filter(t => isTaskCompletedOnDay(t, formatDateKey(currentDate))).map(task => (
                        <div 
                          key={task.id} 
                          onClick={() => handleOpenModal(task, formatDateKey(currentDate))}
                          className="bg-gray-200/60 p-3 rounded flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-gray-200 transition gap-2">
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="min-w-0 flex-1">
                              <span className="line-through text-sm font-bold text-gray-600 block truncate">{task.title}</span>
                              <span className="text-[9px] bg-gray-300 text-gray-600 px-1 py-0.5 rounded inline-block mt-0.5">{task.company}</span>
                            </div>
                            <span className="text-xs text-gray-500 sm:ml-4">Assigned to: {(task.assignees || []).join(', ')}</span>
                          </div>
                          <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full border border-green-300 self-end sm:self-auto shrink-0">
                            ✓ Completed
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white p-8 rounded text-center border border-dashed border-gray-300">
                        <p className="text-sm text-gray-500 font-bold">No tasks completed on this date.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* DAY VIEW */}
        {currentView === 'day' && (
          <div className="w-full overflow-x-auto pb-4">
            <div className="flex-1 flex flex-col border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm min-w-[700px]">
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

              <div className="flex border-b border-gray-300 bg-gray-50/80 min-h-[40px] shrink-0">
                <div className="w-20 py-2 text-center text-[10px] font-bold text-gray-500 border-r border-gray-300 flex items-center justify-center bg-gray-100">All-Day</div>
                <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${visibleMembers.length}, minmax(0, 1fr))` }}>
                  {visibleMembers.map(member => {
                    const dayDateStr = formatDateKey(currentDate);
                    const allDayTasks = visibleTasks.filter(t => isTaskActiveOnDay(t, daysOfWeek[currentDate.getDay()], dayDateStr) && t.assignees && t.assignees.includes(member.name) && t.type === 'flexible');
                    
                    return (
                      <div 
                        key={member.id} 
                        className="p-1 border-r border-gray-300 last:border-r-0 flex flex-col gap-1 min-h-[40px]"
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                        onDrop={(e) => handleDropSlot(e, dayDateStr, null, member.name, true)}
                      >
                        {allDayTasks.map(task => (
                          <div
                            key={task.id}
                            draggable={userRole === 'admin' && !resizingTaskId}
                            onDragStart={(e) => handleDragStart(e, task.id, dayDateStr)}
                            onDragEnd={handleDragEnd}
                            onClick={() => handleOpenModal(task, dayDateStr)}
                            style={{ backgroundColor: member.color }}
                            className={`text-white text-[10px] font-semibold px-2 py-1 rounded truncate shadow-sm ${userRole === 'admin' && !resizingTaskId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:brightness-110 transition ${isTaskPastDue(task) ? 'ring-2 ring-red-500' : ''}`}
                          >
                            {task.title}
                          </div>
                        ))}
                      </div>
                    );
                  })}
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
                    const memberColTasks = visibleTasks.filter(t => isTaskActiveOnDay(t, daysOfWeek[currentDate.getDay()], dayDateStr) && t.assignees && t.assignees.includes(member.name) && t.type === 'timed');
                    const layouts = computeDynamicLayouts(memberColTasks);

                    return (
                      <div key={member.id} className="border-r border-gray-200 last:border-r-0 relative h-full">
                        {dynamicTimeSlots.map(hour => (
                          <div key={hour} className="h-20 border-b border-gray-200 flex flex-col">
                            {minuteSubSlots.map(subOffset => (
                              <div 
                                key={subOffset}
                                onDragOver={(e) => handleSubSlotDragOver(e, dayDateStr, hour + subOffset, member.name)}
                                onDrop={(e) => handleDropSlot(e, dayDateStr, hour + subOffset, member.name, false)}
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
                              className={`absolute text-white rounded-md p-2 shadow-md border-l-4 ${isTaskPastDue(task) ? 'border-red-500 ring-2 ring-red-400' : 'border-black/20'} ${userRole === 'admin' && !resizingTaskId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:brightness-110 transition z-10 flex flex-col justify-between overflow-hidden ${isFlex ? 'opacity-95' : ''}`}>
                              
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
                                  {isTaskPastDue(task) ? (
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
          </div>
        )}

        {/* WEEK VIEW */}
        {currentView === 'week' && (
          <div className="w-full overflow-x-auto pb-4">
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

              <div className="flex border-b border-gray-300 bg-gray-50/80 min-h-[40px] shrink-0">
                <div className="w-16 py-2 text-center text-[10px] font-bold text-gray-500 border-r border-gray-300 flex items-center justify-center bg-gray-100">All-Day</div>
                <div className="flex-1 grid grid-cols-7">
                  {daysOfWeek.map((dayName, idx) => {
                    const weekStart = getWeekStart(currentDate);
                    const cellDate = new Date(weekStart);
                    cellDate.setDate(cellDate.getDate() + idx);
                    const dateStr = formatDateKey(cellDate);

                    const allDayTasks = visibleTasks.filter(t => isTaskActiveOnDay(t, dayName, dateStr) && t.type === 'flexible');

                    return (
                      <div 
                        key={dayName} 
                        className="p-1 border-r border-gray-300 last:border-r-0 flex flex-col gap-1 min-h-[40px]"
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                        onDrop={(e) => handleDropSlot(e, dateStr, null, null, true)}
                      >
                        {allDayTasks.map(task => {
                          const member = getMemberConfig(task.assignees && task.assignees[0]);
                          return (
                            <div
                              key={`${task.id}-${dateStr}`}
                              draggable={userRole === 'admin' && !resizingTaskId}
                              onDragStart={(e) => handleDragStart(e, task.id, dateStr)}
                              onDragEnd={handleDragEnd}
                              onClick={() => handleOpenModal(task, dateStr)}
                              style={{ backgroundColor: member.color }}
                              className={`text-white text-[9px] font-semibold px-1.5 py-0.5 rounded truncate shadow-sm ${userRole === 'admin' && !resizingTaskId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:brightness-110 transition ${isTaskPastDue(task) ? 'ring-2 ring-red-500' : ''}`}
                            >
                              {task.title}
                            </div>
                          );
                        })}
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

                    const dayColTasks = visibleTasks.filter(t => isTaskActiveOnDay(t, dayName, dateStr) && t.type === 'timed');
                    const layouts = computeDynamicLayouts(dayColTasks);

                    return (
                      <div key={dayName} className="border-r border-gray-200 last:border-r-0 relative h-full">
                        {dynamicTimeSlots.map(hour => (
                          <div key={hour} className="h-20 border-b border-gray-200 flex flex-col">
                            {minuteSubSlots.map(subOffset => (
                              <div 
                                key={subOffset}
                                onDragOver={(e) => handleSubSlotDragOver(e, dateStr, hour + subOffset, null)}
                                onDrop={(e) => handleDropSlot(e, dateStr, hour + subOffset, null, false)}
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
                              className={`absolute text-white rounded p-1.5 shadow ${userRole === 'admin' && !resizingTaskId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:opacity-90 transition z-10 flex flex-col justify-between overflow-hidden ${isTaskPastDue(task) ? 'ring-2 ring-red-500' : ''} ${isFlex ? 'opacity-95' : ''}`}>
                              
                              {!isFlex && userRole === 'admin' && (
                                <div 
                                  className="absolute top-0 inset-x-0 h-2 cursor-ns-resize hover:bg-white/40 z-20 touch-none rounded-t"
                                  onPointerDown={(e) => handleResizeStart(e, task, 'top')}
                                />
                              )}

                              <div>
                                <div className="flex justify-between items-center text-[10px] font-bold leading-tight">
                                  <span className="truncate">{task.title}</span>
                                  {isTaskPastDue(task) ? (
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

                // FIX: Look up tasks for every day, regardless of whether it's in the current month or not.
                const pendingDayTasks = visibleTasks.filter(t => isTaskActiveOnDay(t, dayOfWeekStr, dateStr));
                const completedDayTasks = visibleTasks.filter(t => isTaskCompletedOnDay(t, dateStr));

                return (
                  <div 
                    key={i} 
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropSlot(e, dateStr, null, null, false)}
                    className={`p-1.5 flex flex-col transition hover:bg-blue-50/20 ${isCurrentMonthCell ? 'bg-white' : 'bg-gray-100/50 text-gray-400'}`}>
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
                            className={`text-white text-[10px] font-semibold p-1 rounded truncate ${userRole === 'admin' && !resizingTaskId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:opacity-90 shadow-2xs flex items-center justify-between ${isTaskPastDue(task) ? 'ring-2 ring-red-500' : ''} ${isCurrentMonthCell ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                            <span className="truncate">{task.title}</span>
                            <div className="flex items-center gap-0.5">
                              {isTaskPastDue(task) && <span className="text-[8px] bg-red-600 px-0.5 rounded font-bold">!</span>}
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
                          className={`bg-gray-200 text-gray-500 line-through text-[10px] font-semibold p-1 rounded truncate cursor-pointer flex items-center justify-between ${isCurrentMonthCell ? 'opacity-75 hover:opacity-90' : 'opacity-30'}`}>
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
              <button onClick={() => setCurrentView(previousView === 'create' ? 'list' : previousView)} className="text-gray-500 hover:text-gray-800 font-semibold text-sm">✕ Cancel</button>
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
                        <span key={name} className="bg-[#A9B1A6]/20 text-[#333333] text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 font-bold border border-[#A9B1A6]/30">
                          {name} <button onClick={() => handleRemoveAssignee(name)} className="text-red-600 hover:text-red-800 ml-1">✕</button>
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
                    
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={isLongTerm} 
                          onChange={(e) => {
                            setIsLongTerm(e.target.checked);
                            // SMART CLEAR logic
                            if (e.target.checked && taskDate === formatDateKey(new Date())) {
                              setTaskDate('');
                            } else if (!e.target.checked && taskDate === '') {
                              setTaskDate(formatDateKey(new Date()));
                            }
                          }} 
                          className="accent-[#A9B1A6] w-4 h-4" 
                        />
                        <span className="text-[11px] font-bold text-gray-800">📌 Mark as Long-Term / Pipeline Task</span>
                      </label>
                      <p className="text-[10px] text-gray-500 mt-1 ml-6">Pins this task to the top of the dashboard for constant visibility, with or without a deadline.</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-1/2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Company</label>
                    <select value={taskCompany} onChange={(e) => setTaskCompany(e.target.value)} className="w-full px-4 py-2 rounded border border-gray-300 bg-white text-sm">
                      <option value="" disabled>Select a Company...</option>
                      {masterCompanyList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="w-1/2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Priority Level</label>
                    <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className="w-full px-4 py-2 rounded border border-gray-300 bg-white text-sm">
                      <option value="High">High (Red)</option>
                      <option value="Standard">Standard (Green)</option>
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
                    <option value="fixed">Recurring Tasks</option>
                    <option value="completion">Multi-Step Tasks</option>
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
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-600">Repeat every:</span>
                          <input
                            type="number"
                            min="1"
                            value={Math.max(1, Math.round(cadenceDays / 7))}
                            onChange={(e) => setCadenceDays(Math.max(1, Number(e.target.value)) * 7)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-16 text-center focus:outline-none"
                          />
                          <span className="text-xs font-semibold text-gray-600">weeks</span>
                        </div>
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

                {recurrenceType === 'completion' && (
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
                )}

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
                    {isTaskPastDue(selectedTask) && <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">OVERDUE</span>}
                  </div>
                </div>
                <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
              </div>

              {!isEditing ? (
                <>
                  {isTaskPastDue(selectedTask) && !isCurrentInstanceCompleted && (
                    <div className="bg-red-50 border border-red-400 text-red-800 text-xs font-bold px-3 py-2 rounded mb-1 flex items-center gap-2">
                      <span>🚨</span> THIS TASK IS PAST DUE. Please complete the work or adjust the deadline.
                    </div>
                  )}

                  {selectedTask.isLongTerm && !isTaskPastDue(selectedTask) && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold px-3 py-2 rounded mb-1 flex items-center gap-2">
                      <span>📌</span> This is a Long-Term Pipeline task pinned to the dashboard.
                    </div>
                  )}

                  <p className="text-sm text-gray-600 bg-white p-3 rounded border border-gray-200">{selectedTask.desc}</p>

                  <div className="flex justify-between text-xs text-gray-500 bg-gray-100 p-2 rounded">
                    <span>Assigned to: <strong>{selectedTask.assignees && selectedTask.assignees.length > 0 ? selectedTask.assignees.join(', ') : 'Unassigned (Backlog)'}</strong></span>
                    <span>
                      {isCurrentInstanceCompleted && selectedTask.recurrenceType === 'once' ? 'Completed On:' : 'Occurrence Date:'} 
                      <strong> {isCurrentInstanceCompleted && selectedTask.recurrenceType === 'once' && selectedTask.completedDates?.length > 0 ? selectedTask.completedDates[0] : selectedInstanceDate}</strong>
                    </span>
                  </div>

                  {selectedTask.allowAssigneeDeadlineChange && !isCurrentInstanceCompleted && (
                    <div className="bg-blue-50 p-3 rounded border border-blue-200 flex flex-col gap-2">
                      <span className="text-xs font-bold text-blue-900">📅 Admin Permission Granted: Adjust Deadline</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="date" 
                          value={selectedTask.date} 
                          disabled={selectedTask.recurrenceType !== 'once'}
                          onChange={async (e) => {
                            const newDate = e.target.value;
                            const todayStr = formatDateKey(new Date());
                            const newOverdue = newDate < todayStr;
                            
                            // TIMELINE INJECTION
                            const changeNote = `📅 Deadline adjusted to ${newDate} by ${currentUserName} [${getCurrentTimestamp()}]`;

                            const updated = { 
                              ...selectedTask, 
                              date: newDate, 
                              isOverdue: newOverdue, 
                              overdueNotified: newOverdue,
                              comments: [...(selectedTask.comments || []), changeNote]
                            };
                            
                            setSelectedTask(updated);
                            setTasks(tasks.map(t => t.id === selectedTask.id ? updated : t));

                            await supabase.from('tasks').update(mapToDb(updated)).eq('id', selectedTask.id);

                            if (userRole === 'employee' && selectedTask?.notifyOnDeadlineChange !== false) {
                              dispatchNotification(
                                'role',
                                'admin',
                                'deadline',
                                `📅 Employee Rescheduled: "${selectedTask.title}" deadline changed to ${newDate}`,
                                '📅 Employee Changed Deadline',
                                `${currentUserName} moved deadline for "${selectedTask.title}" to ${newDate}`,
                                selectedTask.id,
                                newDate
                              );
                            }
                          }} 
                          className={`p-1.5 text-xs border rounded font-bold text-gray-800 focus:outline-none ${selectedTask.recurrenceType !== 'once' ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-pointer'}`}
                        />
                        {selectedTask.recurrenceType !== 'once' ? (
                          <span className="text-[10px] text-red-500 italic ml-2">(Use calendar drag-and-drop to reschedule recurring tasks)</span>
                        ) : (
                          <span className="text-[11px] text-gray-500 italic ml-2">(Reschedules task on dispatch board)</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="bg-white p-3 rounded border border-gray-200">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-2">Task Activity & Timeline</h4>
                    
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
                      <p className="text-xs text-gray-400 italic mb-2">No activity logged yet.</p>
                    )}

                    {!isCurrentInstanceCompleted && (
                      <div className="flex gap-2">
                        <textarea 
                          rows={2}
                          value={openCommentInput}
                          onChange={(e) => setExecutionComment(e.target.value)}
                          placeholder="Type an update or comment..." 
                          className="flex-1 p-2 text-xs border border-gray-200 rounded focus:outline-none resize-y min-h-[40px]" 
                        />
                        <button 
                          type="button"
                          onClick={() => handlePostOpenComment(selectedTask.id)}
                          className="bg-[#333333] text-white px-3 py-1 rounded text-xs font-bold hover:bg-black transition self-end">
                          Post Note
                        </button>
                      </div>
                    )}
                  </div>

                  {/* UNIVERSAL ATTACHMENTS & Proof OF WORK */}
                  {!isCurrentInstanceCompleted && (
                    <div 
                      className={`bg-white p-3 rounded border border-dashed transition flex justify-between items-center my-1 relative ${isDraggingFile ? 'border-blue-500 bg-blue-50' : 'border-amber-300'}`}
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                      onDragLeave={() => setIsDraggingFile(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingFile(false);
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          handleFileUpload(e.dataTransfer.files[0]);
                        }
                      }}
                    >
                      {isDraggingFile && (
                        <div className="absolute inset-0 flex items-center justify-center bg-blue-50/90 z-10 rounded">
                          <span className="text-blue-700 font-bold text-sm pointer-events-none">Drop file here to upload</span>
                        </div>
                      )}
                      
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                          📎 Attachments & Proof of Work
                          {selectedTask.requiresPhoto && <span className="text-red-600 font-bold ml-1">(Required)</span>}
                        </span>
                        <span className="text-[10px] text-gray-500">Upload or drag and drop images, PDFs, spreadsheets, etc.</span>
                      </div>
                      
                      <label className="text-xs font-bold px-3 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer transition z-20">
                        + Attach File
                        <input 
                          type="file" 
                          accept="*/*" 
                          className="hidden" 
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              handleFileUpload(e.target.files[0]);
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
                          {masterCompanyList.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="w-1/2">
                        <label className="block font-bold mb-1 text-gray-700">Priority Level</label>
                        <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className="w-full p-2 border rounded bg-white">
                          <option value="High">High (Red)</option>
                          <option value="Standard">Standard (Green)</option>
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
                      
                      <div className="col-span-2 bg-[#A9B1A6]/10 p-3 rounded border border-[#A9B1A6]/30 mt-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={isLongTerm} 
                            onChange={(e) => {
                              setIsLongTerm(e.target.checked);
                              // SMART CLEAR logic for edit mode too
                              if (e.target.checked && taskDate === formatDateKey(new Date())) {
                                setTaskDate('');
                              } else if (!e.target.checked && taskDate === '') {
                                setTaskDate(formatDateKey(new Date()));
                              }
                            }} 
                            className="accent-[#A9B1A6] w-4 h-4" 
                          />
                          <span className="text-[11px] font-bold text-gray-800">📌 Mark as Long-Term / Pipeline Task</span>
                        </label>
                      </div>
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
                      <option value="fixed">Recurring Tasks</option>
                      <option value="completion">Multi-Step Tasks</option>
                    </select>

                    {recurrenceType === 'fixed' && (
                      <div className="flex flex-col gap-2 mt-2">
                        <div className="flex gap-1">
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
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-gray-700">Repeat every:</span>
                          <input
                            type="number"
                            min="1"
                            value={Math.max(1, Math.round(cadenceDays / 7))}
                            onChange={(e) => setCadenceDays(Math.max(1, Number(e.target.value)) * 7)}
                            className="w-12 p-1 border rounded text-center font-bold"
                          />
                          <span className="text-xs font-bold text-gray-700">weeks</span>
                        </div>
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

                  {recurrenceType === 'completion' && (
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
                  )}

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
                      Delete Task
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
                  onClick={() => applyTaskMove(reschedulePrompt.task.id, reschedulePrompt.targetDate, reschedulePrompt.targetHour, reschedulePrompt.targetMemberName, false, reschedulePrompt.sourceDate, reschedulePrompt.isAllDayDrop)}
                  className="bg-[#A9B1A6] text-white py-2.5 px-4 rounded text-xs font-bold hover:bg-gray-600 transition text-left flex justify-between items-center">
                  <span>Only This Occurrence</span>
                  <span className="text-[10px] opacity-80">(Creates standalone task)</span>
                </button>

                <button 
                  onClick={() => applyTaskMove(reschedulePrompt.task.id, reschedulePrompt.targetDate, reschedulePrompt.targetHour, reschedulePrompt.targetMemberName, true, reschedulePrompt.sourceDate, reschedulePrompt.isAllDayDrop)}
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
                  <span className="text-xs font-bold text-[#A9B1A6] uppercase tracking-wider">
                    {userRole === 'admin' ? 'System Governance' : 'My Preferences'}
                  </span>
                  <h2 className="text-2xl font-serif font-bold text-gray-900">
                    {userRole === 'admin' ? 'Settings & Team' : 'App Settings'}
                  </h2>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
              </div>

              {/* PUSH NOTIFICATION SETTINGS CARD */}
              <div className="bg-white p-4 rounded-lg border border-amber-300 flex justify-between items-center shadow-2xs">
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900">Device Push Alerts</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">Enable native lock-screen notifications for this browser/device.</p>
                </div>
                <button 
                  onClick={() => enableNativePush(currentUserName || 'Alex M.')}
                  className="bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-200 transition shrink-0 shadow-2xs">
                  📲 Enable Push Alerts
                </button>
              </div>

              {/* ADMIN ONLY CONTROLS */}
              {userRole === 'admin' && (
                <>
                  {/* NEW DASHBOARD VISIBILITY MODULE */}
                  <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col gap-3 shadow-2xs">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700 border-b pb-1">Dashboard Visibility (This Device)</h4>
                    <p className="text-[10px] text-gray-500">Uncheck items below to completely hide them from your personal dashboard filters and calendar views.</p>
                    
                    <div className="flex gap-6 mt-1">
                      <div className="w-1/2 flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Companies</span>
                        {masterCompanyList.map(comp => (
                          <label key={comp} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={!hiddenCompanies.includes(comp)} 
                              onChange={(e) => {
                                if (e.target.checked) setHiddenCompanies(prev => prev.filter(c => c !== comp));
                                else setHiddenCompanies(prev => [...prev, comp]);
                              }} 
                              className="accent-[#A9B1A6]" 
                            /> 
                            {comp}
                          </label>
                        ))}
                      </div>
                      <div className="w-1/2 flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Team Members</span>
                        {teamMembers.map(m => (
                          <label key={m.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={!hiddenMembers.includes(m.name)} 
                              onChange={(e) => {
                                if (e.target.checked) setHiddenMembers(prev => prev.filter(n => n !== m.name));
                                else setHiddenMembers(prev => [...prev, m.name]);
                              }} 
                              className="accent-[#A9B1A6]" 
                            /> 
                            {m.name}
                          </label>
                        ))}
                      </div>
                    </div>
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
                        onClick={handleAddCompany}
                        className="bg-[#333333] text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-black transition">
                        Add
                      </button>
                    </div>
                    <div className="flex flex-col gap-1 mt-2">
                      {masterCompanyList.map(comp => (
                        <div key={comp} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100 text-xs">
                          {editingCompany === comp ? (
                            <div className="flex items-center gap-2 w-full">
                              <input 
                                type="text" 
                                value={editingCompanyInput} 
                                onChange={(e) => setEditingCompanyInput(e.target.value)}
                                className="flex-1 p-1 text-xs border border-gray-300 rounded focus:outline-none bg-white font-bold"
                              />
                              <button 
                                onClick={() => handleRenameCompany(comp, editingCompanyInput)}
                                className="text-green-700 font-bold hover:underline">Save</button>
                              <button 
                                onClick={() => setEditingCompany(null)}
                                className="text-gray-500 font-bold hover:underline">Cancel</button>
                            </div>
                          ) : (
                            <>
                              <span className="font-bold text-gray-700">{comp}</span>
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => {
                                    setEditingCompany(comp);
                                    setEditingCompanyInput(comp);
                                  }}
                                  className="text-blue-600 font-bold hover:underline">Edit</button>
                                <button 
                                  onClick={() => handleDeleteCompany(comp)}
                                  className="text-red-500 font-bold hover:underline">Remove</button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}