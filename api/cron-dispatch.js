// api/cron-dispatch.js
import { createClient } from '@supabase/supabase-js';

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fullDaysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function toDateStr(val) {
  if (!val) return '';
  let str = String(val).trim();
  if (str.includes('T')) str = str.split('T')[0];
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
  }
  return str;
}

function parseDateToUTC(dateStr) {
  const norm = toDateStr(dateStr);
  if (!norm) return new Date();
  const [y, m, d] = norm.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function isTaskScheduledOnDay(task, targetDateStr) {
  if (!task) return false;
  const taskDate = toDateStr(task.date);
  const endDate = toDateStr(task.end_date || task.endDate);

  if (endDate && targetDateStr > endDate) return false;

  const recurrenceType = (task.recurrence_type || task.recurrenceType || 'once').toLowerCase();
  const cadenceDays = Number(task.cadence_days || task.cadenceDays) || 7;

  const targetDateObj = parseDateToUTC(targetDateStr);
  const targetDayIdx = targetDateObj.getUTCDay();
  const shortDayStr = daysOfWeek[targetDayIdx].toLowerCase();
  const fullDayStr = fullDaysOfWeek[targetDayIdx];

  if (recurrenceType === 'daily') return true;

  if (recurrenceType === 'weekdays') {
    return targetDayIdx >= 1 && targetDayIdx <= 5;
  }

  if (recurrenceType === 'fixed' || recurrenceType === 'weekly') {
    if (taskDate && targetDateStr < taskDate) return false;

    let activeDays = task.active_days || task.activeDays;
    if (typeof activeDays === 'string') {
      try { activeDays = JSON.parse(activeDays); } catch (e) { activeDays = [activeDays]; }
    }

    if (Array.isArray(activeDays) && activeDays.length > 0) {
      const matchesDay = activeDays.some(ad => {
        const s = String(ad).toLowerCase().trim();
        return s === shortDayStr || s === fullDayStr || s === String(targetDayIdx);
      });
      if (!matchesDay) return false;
    }

    const intervalWeeks = Math.max(1, Math.round(cadenceDays / 7));
    if (intervalWeeks > 1 && taskDate) {
      const sDate = parseDateToUTC(taskDate);
      const sSunday = new Date(sDate);
      sSunday.setUTCDate(sDate.getUTCDate() - sDate.getUTCDay());

      const cSunday = new Date(targetDateObj);
      cSunday.setUTCDate(targetDateObj.getUTCDate() - targetDateObj.getUTCDay());

      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksDiff = Math.round((cSunday.getTime() - sSunday.getTime()) / msPerWeek);

      if (weeksDiff % intervalWeeks !== 0) return false;
    }
    return true;
  }

  return taskDate === targetDateStr;
}

function isTaskPastDue(task, targetDateStr) {
  const taskDate = toDateStr(task.date);
  if (!taskDate) return false;
  
  const status = (task.status || '').toLowerCase();
  if (status === 'completed' || status === 'done') return false;

  const recurrenceType = (task.recurrence_type || task.recurrenceType || 'once').toLowerCase();

  if (recurrenceType === 'once' || recurrenceType === 'completion' || !recurrenceType) {
    return taskDate < targetDateStr;
  }

  if (recurrenceType === 'fixed' || recurrenceType === 'weekly') {
    const cadenceDays = Number(task.cadence_days || task.cadenceDays) || 7;
    const maxLookback = Math.max(7, cadenceDays);
    let missedDate = null;

    for (let i = 1; i <= maxLookback; i++) {
      const d = parseDateToUTC(targetDateStr);
      d.setUTCDate(d.getUTCDate() - i);
      const checkDateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

      if (isTaskScheduledOnDay(task, checkDateStr)) {
        missedDate = checkDateStr;
        break;
      }
    }

    if (missedDate && missedDate < targetDateStr) {
      let completedDates = task.completed_dates || task.completedDates || [];
      if (typeof completedDates === 'string') {
        try { completedDates = JSON.parse(completedDates); } catch (e) { completedDates = []; }
      }
      let exceptionDates = task.exception_dates || task.exceptionDates || [];
      if (typeof exceptionDates === 'string') {
        try { exceptionDates = JSON.parse(exceptionDates); } catch (e) { exceptionDates = []; }
      }
      if (completedDates.includes(missedDate) || exceptionDates.includes(missedDate)) return false;
      return true;
    }
  }

  return false;
}

function checkAssigneeMatch(taskAssignees, allowedAliases) {
  if (!taskAssignees || !allowedAliases || allowedAliases.length === 0) return false;

  let list = taskAssignees;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch (e) { list = list.split(','); }
  }
  if (!Array.isArray(list)) list = [list];

  return list.some(raw => {
    let name = typeof raw === 'string' ? raw : (raw?.name || raw?.full_name || raw?.id || '');
    name = name.toLowerCase().replace(/\s*\(.*?\)/g, '').trim();
    if (!name) return false;

    return allowedAliases.some(alias => {
      const cleanAlias = alias.toLowerCase().replace(/\s*\(.*?\)/g, '').trim();
      return name === cleanAlias || name.startsWith(cleanAlias) || cleanAlias.startsWith(name);
    });
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

  // Compute Arizona date
  const targetDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix' }).format(new Date());

  try {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, slack_user_id, name, full_name, dispatch_target_name, dispatch_priority_only')
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
      const cleanTarget = (targetName || '').replace(/\s*\(.*?\)/g, '').trim();
      const firstWord = cleanTarget.toLowerCase().split(' ')[0];

      const aliases = new Set([targetName, cleanTarget]);
      if (profile.name) aliases.add(profile.name);
      if (profile.full_name) aliases.add(profile.full_name);
      if (profile.dispatch_target_name) aliases.add(profile.dispatch_target_name);
      if (profile.id) aliases.add(profile.id);
      if (firstWord) aliases.add(firstWord);

      const aliasList = Array.from(aliases);

      const filteredTasks = (allTasks || []).filter(task => {
        if (!checkAssigneeMatch(task.assignees, aliasList)) return false;
        if (profile.dispatch_priority_only && task.priority !== 'High') return false;

        const isScheduled = isTaskScheduledOnDay(task, targetDate);
        const isPast = isTaskPastDue(task, targetDate);

        return isScheduled || isPast;
      });

      const parsedDate = parseDateToUTC(targetDate);
      const dateFormatted = parsedDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });

      const displayName = cleanTarget.charAt(0).toUpperCase() + cleanTarget.slice(1).split(' ')[0];

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
          const isPast = isTaskPastDue(t, targetDate);
          const overdueBadge = isPast ? ' 🚨 *OVERDUE*' : '';
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