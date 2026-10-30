// api/cron-dispatch.js
import { createClient } from '@supabase/supabase-js';

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDateToUTC(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatUTCDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function isTaskScheduledOnDay(task, dateStr, dayOfWeekStr) {
  if (!task) return false;
  if (task.endDate && dateStr > task.endDate) return false;

  if (task.recurrenceType === 'fixed') {
    const startDate = task.date;
    if (startDate && dateStr < startDate) return false;
    if (!task.activeDays || !task.activeDays.includes(dayOfWeekStr)) return false;

    const intervalWeeks = Math.max(1, Math.round((task.cadenceDays || 7) / 7));
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

  if (task.recurrenceType === 'once' || task.recurrenceType === 'completion') {
    return task.date < targetDateStr;
  }

  if (task.recurrenceType === 'fixed') {
      let missedDate = null;
      const maxLookback = Math.max(7, task.cadenceDays || 7);
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
        const completedDates = task.completedDates || [];
        const exceptionDates = task.exceptionDates || [];
        if (completedDates.includes(missedDate)) return false;
        if (exceptionDates.includes(missedDate)) return false;
        return true;
      }
      return false;
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized cron execution' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pjnuhzdzvxojudkfnofh.supabase.co';
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const slackBotToken = process.env.SLACK_BOT_TOKEN;

  if (!supabaseKey || !slackBotToken) {
    return res.status(500).json({ error: 'Missing critical environment variables' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const azDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Phoenix" }));
  const targetDate = azDate.toISOString().split('T')[0];
  const targetDayStr = daysOfWeek[azDate.getDay()];

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
      .select('*')
      .neq('status', 'completed');

    if (taskError) throw taskError;

    let messagesSent = 0;

    for (const profile of profiles) {
      const targetName = profile.dispatch_target_name || profile.name || profile.full_name;
      const firstFirstName = targetName.split(' ')[0];

      const filteredTasks = (allTasks || []).filter(task => {
        const isAssigned = (task.assignees || []).includes(targetName);
        if (!isAssigned) return false;
        
        if (profile.dispatch_priority_only && task.priority !== 'High') return false;

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
          text: { type: 'mrkdwn', text: `🎉 *All clear!* No pending tasks found for ${targetName} today.` }
        });
      } else {
        const taskLines = filteredTasks.map(t => {
          const isPastDue = isTaskPastDue(t, targetDate);
          const overdueBadge = isPastDue ? ' 🚨 *OVERDUE*' : '';
          const priorityBadge = t.priority === 'High' ? ' 🔴 *HIGH PRIORITY*' : '';
          const timeBadge = t.time_label || 'All-Day';
          const companyBadge = t.company ? ` • [${t.company}]` : '';
          return `• *${timeBadge}* — ${t.title}${companyBadge}${overdueBadge}${priorityBadge}`;
        });

        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `*Here is the agenda for today (${filteredTasks.length} task${filteredTasks.length > 1 ? 's' : ''}):*\n\n` + taskLines.join('\n') }
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