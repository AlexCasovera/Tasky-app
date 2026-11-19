// src/utils.ts
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
const VAPID_PUBLIC_KEY = "BHwkF10ChvQHdkA8haU2qwiLokceGAgQeWqmyE-3R0ZiygmKWXv50YVjCI3TauwJ5OyS47iUsz0wotPEPV8gH_8";

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

const saveSubscriptionToProfile = async (userName: string, subscription: any) => {
  const subJson = typeof subscription?.toJSON === 'function' ? subscription.toJSON() : subscription;
  if (!subJson?.endpoint) return { error: new Error('Invalid push subscription object.') };

  const { data: profile, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, push_subscription, push_subscriptions')
    .eq('name', userName)
    .single();

  if (fetchErr || !profile) {
    return { error: fetchErr || new Error('Profile not found.') };
  }

  let existingList = Array.isArray(profile.push_subscriptions) ? [...profile.push_subscriptions] : [];

  // Preserve legacy single subscription if not already in the array
  if (profile.push_subscription?.endpoint && !existingList.some(s => s?.endpoint === profile.push_subscription.endpoint)) {
    existingList.push(profile.push_subscription);
  }

  // Replace existing entry for this device endpoint or append new device
  const filtered = existingList.filter(s => s?.endpoint && s.endpoint !== subJson.endpoint);
  const updatedList = [...filtered, subJson].slice(-6); // Cap at 6 devices per user

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({
      push_subscription: subJson,
      push_subscriptions: updatedList
    })
    .eq('id', profile.id);

  return { error: updateErr };
};

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

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    const { error } = await saveSubscriptionToProfile(userName, subscription);

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

// Silently auto-heals dropped/rotated iOS push subscriptions when the app opens
export const syncPushSubscriptionSilently = async (userName: string) => {
  if (!userName) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    // If iOS cleared or dropped the subscription while permission is still granted, silently re-subscribe
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    const subJson = typeof subscription?.toJSON === 'function' ? subscription.toJSON() : subscription;
    if (!subJson?.endpoint) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('push_subscriptions')
      .eq('name', userName)
      .single();

    const savedList = Array.isArray(profile?.push_subscriptions) ? profile.push_subscriptions : [];
    const alreadySynced = savedList.some(
      s => s?.endpoint === subJson.endpoint && s?.keys?.p256dh === subJson.keys?.p256dh
    );

    if (!alreadySynced) {
      await saveSubscriptionToProfile(userName, subJson);
    }
  } catch (err) {
    console.warn('Silent push auto-heal skipped:', err.message);
  }
};

export const sendNativePush = async ({ targetType, targetValue, title, message }) => {
  try {
    let query = supabase.from('profiles').select('id, push_subscription, push_subscriptions');
    if (targetType === 'role') {
      query = query.eq('role', targetValue);
    } else {
      query = query.eq('name', targetValue);
    }

    const { data, error } = await query;
    if (error || !data) return;

    for (const profile of data) {
      const subsMap = new Map();

      if (Array.isArray(profile.push_subscriptions)) {
        profile.push_subscriptions.forEach(s => {
          if (s?.endpoint) subsMap.set(s.endpoint, s);
        });
      }
      if (profile.push_subscription?.endpoint && !subsMap.has(profile.push_subscription.endpoint)) {
        subsMap.set(profile.push_subscription.endpoint, profile.push_subscription);
      }

      const subscriptions = Array.from(subsMap.values());
      await Promise.allSettled(
        subscriptions.map(subscription =>
          fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription,
              profileId: profile.id,
              title,
              message
            })
          })
        )
      );
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
    require_checklist: t.requireChecklist ?? false,
    checklist: t.checklist || [],
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
    in_progress_dates: t.inProgressDates || [],
    paused_dates: t.pausedDates || [],
    created_by: t.createdBy || '',
    is_overdue: t.isOverdue ?? false,
    overdue_notified: t.overdueNotified ?? false,
    is_long_term: t.isLongTerm ?? false,
    property_name: t.propertyName || '',
    unit_name: t.unitName || '',
    require_ai_qc: Boolean(t.requireAiQc),
    ai_qc_status: t.aiQcStatus || 'none',
    ai_qc_results: t.aiQcResults || {}
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
    requireChecklist: r.require_checklist ?? false,
    checklist: typeof r.checklist === 'string' ? JSON.parse(r.checklist) : (r.checklist || []),
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
    inProgressDates: r.in_progress_dates || [],
    pausedDates: r.paused_dates || [],
    createdBy: r.created_by || '',
    isOverdue: r.is_overdue ?? false,
    overdueNotified: r.overdue_notified ?? false,
    isLongTerm: r.is_long_term ?? false,
    propertyName: r.property_name || '',
    unitName: r.unit_name || '',
    requireAiQc: Boolean(r.require_ai_qc),
    aiQcStatus: r.ai_qc_status || 'none',
    aiQcResults: typeof r.ai_qc_results === 'string' ? JSON.parse(r.ai_qc_results) : (r.ai_qc_results || {})
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