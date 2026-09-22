// @ts-nocheck
import { supabase } from './supabaseClient';

// --- STATIC CALENDAR HELPERS ---
export const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const minuteSubSlots = [0, 0.25, 0.5, 0.75];

// --- IMAGE COMPRESSION ENGINE ---
export const compressImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<File> => {
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

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const enableNativePush = async (userName: string) => {
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

export const sendNativePush = async ({ targetType, targetValue, title, message }) => {
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

export const formatDateKey = (d) => {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const mapToDb = (t) => {
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
    is_overdue: t.isOverdue ?? false,
    overdue_notified: t.overdueNotified ?? false,
    is_long_term: t.isLongTerm ?? false
  };
};

export const mapFromDb = (r) => {
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

// --- TIME FORMATTING HELPERS ---
export const timeToDecimal = (timeStr) => {
  if (!timeStr) return 9;
  const [h, m] = timeStr.split(':').map(Number);
  return h + m / 60;
};

export const decimalToTimeString = (dec) => {
  const hours = Math.floor(dec);
  const minutes = Math.round((dec - hours) * 60);
  const hStr = String(hours).padStart(2, '0');
  const mStr = String(minutes).padStart(2, '0');
  return `${hStr}:${mStr}`;
};

export const formatTimeLabel = (startStr, endStr) => {
  if (!startStr || !endStr) return 'All-Day';
  const formatSingle = (t) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12 < 10 ? '0' + h12 : h12}:${m < 10 ? '0' + m : m} ${ampm}`;
  };
  return `${formatSingle(startStr)} - ${formatSingle(endStr)}`;
};