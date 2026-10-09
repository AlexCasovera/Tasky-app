import { createClient } from '@supabase/supabase-js';

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isTaskActiveOnDay(task, dayOfWeekStr, dateStr) {
  if (!task) return false;
  if (task.status === 'completed') return false;
  if (task.completed_dates && task.completed_dates.includes(dateStr)) return false;
  if (task.exception_dates && task.exception_dates.includes(dateStr)) return false;
  if (task.end_date && dateStr > task.end_date) return false;

  if (task.recurrence_type === 'fixed') {
    const startDate = task.date || task.date_scheduled;
    if (startDate && dateStr < startDate) return false;
    if (!task.active_days || !task.active_days.includes(dayOfWeekStr)) return false;

    const intervalWeeks = Math.max(1, Math.round((task.cadence_days || 7) / 7));
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

  const taskDate = task.date || task.date_scheduled;
  return taskDate === dateStr;
}

function isTaskOverdue(task, todayStr) {
  if (!task) return false;
  if (task.status === 'completed') return false;
  const taskDate = task.date || task.date_scheduled;
  if (!taskDate || taskDate.trim() === '') return false;

  if (task.recurrence_type === 'once' || task.recurrence_type === 'completion') {
    if (taskDate < todayStr) {
      if (task.completed_dates && task.completed_dates.includes(taskDate)) return false;
      return true;
    }
    return false;
  }

  if (task.recurrence_type === 'fixed') {
    const maxLookback = Math.max(7, task.cadence_days || 7);
    for (let i = 1; i <= maxLookback; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const checkDateStr = `${y}-${m}-${day}`;
      const dayOfWeekStr = daysOfWeek[d.getDay()];

      if (isTaskActiveOnDay(task, dayOfWeekStr, checkDateStr)) {
        if (task.completed_dates && task.completed_dates.includes(checkDateStr)) continue;
        if (task.exception_dates && task.exception_dates.includes(checkDateStr)) continue;
        return true;
      }
    }
  }

  return false;
}

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pjnuhzdzvxojudkfnofh.supabase.co';
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const slackBotToken = process.env.SLACK_BOT_TOKEN;

  if (!supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase Key in Vercel environment variables (SUPABASE_SECRET_KEY or VITE_SUPABASE_ANON_KEY).' });
  }

  if (!slackBotToken) {
    return res.status(500).json({ error: 'Missing SLACK_BOT_TOKEN in Vercel environment variables.' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const isManualTest = req.method === 'POST';
    const body = req.body || {};

    let recipients = [];

    if (isManualTest) {
      const { targetMember, slackUserId, highPriorityOnly, testDate } = body;
      if (!slackUserId) {
        return res.status(400).json({ error: 'No Slack User ID found for your profile. Please add your Slack Member ID in Settings.' });
      }

      recipients.push({
        slack_user_id: slackUserId,
        target_member: targetMember || 'Alex M.',
        high_priority_only: Boolean(highPriorityOnly),
        test_date: testDate
      });
    } else {
      const { data: profiles, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('slack_dispatch_enabled', true)
        .not('slack_user_id', 'is', null);

      if (profileErr) throw profileErr;
      if (!profiles || profiles.length === 0) {
        return res.status(200).json({ message: 'No profiles configured for automatic Slack morning dispatch.' });
      }

      recipients = profiles.map(p => ({
        slack_user_id: p.slack_user_id,
        target_member: p.slack_dispatch_member || p.name,
        high_priority_only: Boolean(p.slack_dispatch_high_priority_only),
        test_date: null
      }));
    }

    const { data: allTasks, error: tasksErr } = await supabase.from('tasks').select('*');
    if (tasksErr) throw tasksErr;

    const results = [];

    for (const recipient of recipients) {
      const targetDateStr = recipient.test_date || new Date().toISOString().split('T')[0];
      const targetDateObj = new Date(targetDateStr + 'T00:00:00');
      const targetDayOfWeek = daysOfWeek[targetDateObj.getDay()];

      const memberTasks = (allTasks || []).filter(t => {
        if (!t.assignees || !Array.isArray(t.assignees)) return false;
        return t.assignees.includes(recipient.target_member);
      });

      let overdue = memberTasks.filter(t => isTaskOverdue(t, targetDateStr));
      let todaysTasks = memberTasks.filter(t => isTaskActiveOnDay(t, targetDayOfWeek, targetDateStr));

      if (recipient.high_priority_only) {
        overdue = overdue.filter(t => t.priority === 'High');
        todaysTasks = todaysTasks.filter(t => t.priority === 'High');
      }

      const formattedDateString = targetDateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });

      const firstName = recipient.target_member.split(' ')[0] || 'Team';

      let textSummary = `☀️ Good Morning, ${firstName}!\n📅 Daily Dispatch for ${formattedDateString}\n\n`;

      if (overdue.length > 0) {
        textSummary += `🚨 *PAST DUE (${overdue.length} Action Required):*\n`;
        overdue.forEach(t => {
          const taskDate = t.date || t.date_scheduled || 'Past Due';
          textSummary += `• [Due: ${taskDate}] *${t.title}* • [${t.company || 'Internal'}]\n`;
        });
        textSummary += `\n`;
      }

      if (todaysTasks.length > 0) {
        textSummary += `📋 *Today's Agenda (${todaysTasks.length} task${todaysTasks.length === 1 ? '' : 's'}):*\n`;
        todaysTasks.forEach(t => {
          const timeLabel = t.time_label || 'All-Day';
          textSummary += `• ${timeLabel} — *${t.title}* • [${t.company || 'Internal'}]\n`;
        });
      } else {
        textSummary += `🎉 *No tasks scheduled for today!* Enjoy your day.\n`;
      }

      const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${slackBotToken}`
        },
        body: JSON.stringify({
          channel: recipient.slack_user_id,
          text: `Tasky Daily Dispatch for ${formattedDateString}`,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `☀️ Good Morning, ${firstName}!`,
                emoji: true
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `📅 *Daily Dispatch for ${formattedDateString}*`
                }
              ]
            },
            {
              type: 'divider'
            },
            ...(overdue.length > 0 ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `🚨 *Past Due Tasks (${overdue.length} Action Required)*\n` +
                    overdue.map(t => `• *${t.title}* • [${t.company || 'General'}] _(Due: ${t.date || t.date_scheduled})_`).join('\n')
                }
              },
              {
                type: 'divider'
              }
            ] : []),
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: todaysTasks.length > 0
                  ? `Here is your agenda for today (*${todaysTasks.length} task${todaysTasks.length === 1 ? '' : 's'}*):\n` +
                    todaysTasks.map(t => `• *${t.time_label || 'All-Day'}* — ${t.title} • [${t.company || 'General'}]`).join('\n')
                  : `🎉 *No scheduled tasks for today!*`
              }
            }
          ]
        })
      });

      const slackResult = await slackResponse.json();
      if (!slackResult.ok) {
        throw new Error(`Slack API error: ${slackResult.error || 'Failed to send message'}`);
      }

      results.push({ user: recipient.target_member, status: 'sent', count: todaysTasks.length, overdue: overdue.length });
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('Dispatch execution error:', err);
    return res.status(500).json({ error: err.message || 'Internal dispatch error' });
  }
}