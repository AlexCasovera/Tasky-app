// api/dispatch.js
import { createClient } from '@supabase/supabase-js';

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDateToUTC(dateStr) {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatUTCDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function isTaskScheduledOnDay(task, dateStr, dayOfWeekStr) {
  if (!task) return false;
  const endDate = task.end_date || task.endDate;
  if (endDate && dateStr > endDate) return false;

  const recurrenceType = task.recurrence_type || task.recurrenceType || 'once';
  const activeDays = task.active_days || task.activeDays;
  const cadenceDays = task.cadence_days || task.cadenceDays || 7;

  if (recurrenceType === 'fixed') {
    const startDate = task.date;
    if (startDate && dateStr < startDate) return false;
    if (!activeDays || !activeDays.includes(dayOfWeekStr)) return false;

    const intervalWeeks = Math.max(1, Math.round(cadenceDays / 7));
    if (intervalWeeks > 1 && startDate) {
      const sDate = parseDateToUTC(startDate);
      const sSunday = new Date(sDate);
      sSunday.setUTCDate(sDate.getUTCDate() - sDate.getUTCDay());

      const cDate = parseDateToUTC(dateStr);
      const cSunday = new Date(cDate);
      cSunday.setUTCDate(cDate.getUTCDate() - cDate.getUTCDay());

      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksDiff = Math.round((cSunday.getTime() - sSunday.getTime()) / msPerWeek);

      if (weeksDiff % intervalWeeks !== 0) return false;
    }
    return true;
  }
  return task.date === dateStr;
}

function isTaskPastDue(task, targetDateStr) {
  if (!task.date || task.date.trim() === '') return false;
  if (task.status === 'completed') return false;

  const recurrenceType = task.recurrence_type || task.recurrenceType || 'once';
  const cadenceDays = task.cadence_days || task.cadenceDays || 7;

  if (recurrenceType === 'once' || recurrenceType === 'completion') {
    return task.date < targetDateStr;
  }

  if (recurrenceType === 'fixed') {
    let missedDate = null;
    const maxLookback = Math.max(7, cadenceDays);
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
      const completedDates = task.completed_dates || task.completedDates || [];
      const exceptionDates = task.exception_dates || task.exceptionDates || [];
      if (completedDates.includes(missedDate)) return false;
      if (exceptionDates.includes(missedDate)) return false;
      return true;
    }
    return false;
  }
  return false;
}

function matchesAssignee(taskAssignees, targetName) {
  if (!taskAssignees || !targetName) return false;
  const list = Array.isArray(taskAssignees) ? taskAssignees : [taskAssignees];
  
  const cleanTarget = targetName.toLowerCase().replace(/\s*\(.*?\)/g, '').trim();

  return list.some(rawAssignee => {
    const name = typeof rawAssignee === 'string' ? rawAssignee : (rawAssignee?.name || rawAssignee?.full_name || '');
    const cleanName = name.toLowerCase().replace(/\s*\(.*?\)/g, '').trim();
    if (!cleanName) return false;

    return cleanName === cleanTarget || 
           cleanName.startsWith(cleanTarget) || 
           cleanTarget.startsWith(cleanName);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { targetMemberName, slackUserId, onlyHighPriority, date } = req.body;

  if (!targetMemberName || !slackUserId) {
    return res.status(400).json({ error: 'Missing targetMemberName or slackUserId' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pjnuhzdzvxojudkfnofh.supabase.co';
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PBUZMbHEPkkpjDoDd7m18g_C_6c3cZW';
  const slackBotToken = process.env.SLACK_BOT_TOKEN;

  if (!supabaseKey || !slackBotToken) {
    return res.status(500).json({ error: 'Missing critical environment variables' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const targetDate = date || new Date().toISOString().split('T')[0];
  const parsedTargetDate = parseDateToUTC(targetDate);
  const targetDayStr = daysOfWeek[parsedTargetDate.getUTCDay()];

  try {
    const { data: allTasks, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .neq('status', 'completed');

    if (taskError) throw taskError;

    const filteredTasks = (allTasks || []).filter(task => {
      if (!matchesAssignee(task.assignees, targetMemberName)) return false;
      if (onlyHighPriority && task.priority !== 'High') return false;

      const isScheduledToday = isTaskScheduledOnDay(task, targetDate, targetDayStr);
      const isPastDue = isTaskPastDue(task, targetDate);

      return isScheduledToday || isPastDue;
    });

    const parsedDate = new Date(targetDate + 'T12:00:00Z');
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    const dateFormatted = isNaN(parsedDate.getTime()) ? targetDate : parsedDate.toLocaleDateString('en-US', options);

    const firstFirstName = targetMemberName.split(' ')[0];

    let blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `☀️ Dispatch: ${firstFirstName}'s Agenda`, emoji: true }
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
        text: { type: 'mrkdwn', text: `🎉 *All clear!* No pending tasks found for ${targetMemberName} today.` }
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
        const timeBadge = t.time_label || t.timeLabel || 'All-Day';
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
        channel: slackUserId,
        text: `☀️ Daily Dispatch for ${targetMemberName}: ${dateFormatted} (${filteredTasks.length} tasks)`,
        blocks: blocks
      })
    });

    if (!slackResponse.ok) {
      const errorData = await slackResponse.json();
      throw new Error(`Slack API error: ${errorData.error}`);
    }

    return res.status(200).json({ success: true, count: filteredTasks.length });
  } catch (error) {
    console.error('Dispatch API error:', error);
    return res.status(500).json({ error: error.message });
  }
}