// api/cron-dispatch.js
import { createClient } from '@supabase/supabase-js';

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function cleanName(str) {
  if (!str) return '';
  return String(str).replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
}

function parseDateToUTC(dateStr) {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatUTCDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function isTaskScheduledOnDay(task, targetDateStr, targetDayStr) {
  if (!task) return false;
  const taskDate = (task.date || task.date_scheduled || '').split('T')[0];
  const endDate = (task.end_date || '').split('T')[0];

  if (endDate && targetDateStr > endDate) return false;

  const recurrenceType = task.recurrence_type || 'once';

  if (recurrenceType === 'fixed') {
    if (taskDate && targetDateStr < taskDate) return false;

    const activeDays = Array.isArray(task.active_days) ? task.active_days : [];
    if (activeDays.length > 0 && !activeDays.includes(targetDayStr)) return false;

    const cadenceDays = Number(task.cadence_days) || 7;
    const intervalWeeks = Math.max(1, Math.round(cadenceDays / 7));
    if (intervalWeeks > 1 && taskDate) {
      const sDate = parseDateToUTC(taskDate);
      const sSunday = new Date(sDate);
      sSunday.setUTCDate(sDate.getUTCDate() - sDate.getUTCDay());

      const cDate = parseDateToUTC(targetDateStr);
      const cSunday = new Date(cDate);
      cSunday.setUTCDate(cDate.getUTCDate() - cDate.getUTCDay());

      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksDiff = Math.round((cSunday.getTime() - sSunday.getTime()) / msPerWeek);

      if (weeksDiff % intervalWeeks !== 0) return false;
    }
    return true;
  }

  return taskDate === targetDateStr;
}

function isTaskPastDue(task, targetDateStr) {
  const taskDate = (task.date || task.date_scheduled || '').split('T')[0];
  if (!taskDate) return false;

  const recurrenceType = task.recurrence_type || 'once';
  const completedDates = Array.isArray(task.completed_dates) ? task.completed_dates : [];

  if (recurrenceType === 'once') {
    if (task.status === 'completed') return false;
    return taskDate < targetDateStr;
  }

  if (recurrenceType === 'fixed') {
    const cadenceDays = Number(task.cadence_days) || 7;
    const maxLookback = Math.max(7, cadenceDays);
    let missedDate = null;

    for (let i = 1; i <= maxLookback; i++) {
      const d = parseDateToUTC(targetDateStr);
      d.setUTCDate(d.getUTCDate() - i);
      const checkDateStr = formatUTCDate(d);
      const dayOfWeekStr = daysOfWeek[d.getUTCDay()];

      if (isTaskScheduledOnDay(task, checkDateStr, dayOfWeekStr)) {
        missedDate = checkDateStr;
        break;
      }
    }

    if (missedDate && missedDate < targetDateStr) {
      if (completedDates.includes(missedDate)) return false;
      const exceptionDates = Array.isArray(task.exception_dates) ? task.exception_dates : [];
      if (exceptionDates.includes(missedDate)) return false;
      return true;
    }
  }

  return false;
}

function matchesMember(taskAssignees, targetMemberName) {
  if (!taskAssignees) return false;
  const list = Array.isArray(taskAssignees) ? taskAssignees : [taskAssignees];
  const targetClean = cleanName(targetMemberName);

  return list.some(a => {
    const nameClean = cleanName(a);
    return nameClean === targetClean || nameClean.startsWith(targetClean) || targetClean.startsWith(nameClean);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized cron execution' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pjnuhzdzvxojudkfnofh.supabase.co';
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PBUZMbHEPkkpjDoDd7m18g_C_6c3cZW';
  const slackBotToken = process.env.SLACK_BOT_TOKEN;

  if (!supabaseKey || !slackBotToken) {
    return res.status(500).json({ error: 'Missing critical environment variables' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Target date for Arizona
  const targetDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix' }).format(new Date());
  const parsedTargetDate = parseDateToUTC(targetDate);
  const targetDayStr = daysOfWeek[parsedTargetDate.getUTCDay()];

  try {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('slack_user_id, name, full_name, dispatch_target_name, dispatch_priority_only')
      .eq('dispatch_enabled', true)
      .not('slack_user_id', 'is', null);

    if (profileError) throw profileError;
    if (!profiles || profiles.length === 0) {
      return res.status(200).json({ message: 'No active dispatches found for today.' });
    }

    const { data: allTasks, error: taskError } = await supabase
      .from('tasks')
      .select('*');

    if (taskError) throw taskError;

    let messagesSent = 0;

    for (const profile of profiles) {
      const targetName = profile.dispatch_target_name || profile.name || profile.full_name;
      const displayName = cleanName(targetName).replace(/\b\w/g, l => l.toUpperCase()).split(' ')[0];

      const filteredTasks = (allTasks || []).filter(task => {
        if (!matchesMember(task.assignees, targetName)) return false;
        if (profile.dispatch_priority_only && task.priority !== 'High') return false;

        const completedDates = Array.isArray(task.completed_dates) ? task.completed_dates : [];
        if (task.recurrence_type === 'once' && task.status === 'completed') return false;
        if (task.recurrence_type === 'fixed' && completedDates.includes(targetDate)) return false;

        const isScheduledToday = isTaskScheduledOnDay(task, targetDate, targetDayStr);
        const isPastDue = isTaskPastDue(task, targetDate);

        return isScheduledToday || isPastDue;
      });

      const parsedDate = new Date(targetDate + 'T12:00:00Z');
      const options = { weekday: 'long', month: 'short', day: 'numeric' };
      const dateFormatted = isNaN(parsedDate.getTime()) ? targetDate : parsedDate.toLocaleDateString('en-US', options);

      let blocks = [
        {
          type: 'header',
          text: { type: 'plain_text', text: `☀️ Dispatch: ${displayName}'s Agenda`, emoji: true }
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `📅 *Daily Dispatch for ${dateFormatted}*` }]
        },
        { type: 'divider' }
      ];

      if (filteredTasks.length === 0) {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `🎉 *All clear!* No pending tasks found for ${targetName} today.` }
        });
      } else {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `*Here is the agenda for today (${filteredTasks.length} task${filteredTasks.length > 1 ? 's' : ''}):*` }
        });

        filteredTasks.forEach(t => {
          const isPastDue = isTaskPastDue(t, targetDate);
          const overdueBadge = isPastDue ? ' 🚨 *OVERDUE*' : '';
          const priorityBadge = t.priority === 'High' ? ' 🔴 *HIGH PRIORITY*' : '';
          const timeBadge = t.time_label || 'All-Day';
          const companyBadge = t.company ? ` • [${t.company}]` : '';

          blocks.push({
            type: 'section',
            block_id: `task_${t.id}`,
            text: {
              type: 'mrkdwn',
              text: `• *${timeBadge}* — *${t.title}*${companyBadge}${overdueBadge}${priorityBadge}`
            },
            accessory: {
              type: 'button',
              action_id: 'complete_task',
              text: {
                type: 'plain_text',
                text: 'Done ✅',
                emoji: true
              },
              style: 'primary',
              value: JSON.stringify({
                taskId: t.id,
                date: targetDate
              })
            }
          });
        });
      }

      const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${slackBotToken}`
        },
        body: JSON.stringify({
          channel: profile.slack_user_id,
          text: `☀️ Daily Dispatch for ${targetName}: ${dateFormatted} (${filteredTasks.length} tasks)`,
          blocks: blocks
        })
      });

      if (slackResponse.ok) {
        messagesSent++;
      } else {
        const errorData = await slackResponse.json();
        console.error(`Failed to send slack dispatch to ${profile.slack_user_id}:`, errorData);
      }
    }

    return res.status(200).json({ success: true, count: messagesSent });
  } catch (error) {
    console.error('Cron dispatch error:', error);
    return res.status(500).json({ error: error.message });
  }
}