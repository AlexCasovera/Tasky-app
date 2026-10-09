// api/dispatch.js
import { createClient } from '@supabase/supabase-js';

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDateKey(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isTaskActiveOnDate(task, dateStr, dayOfWeekStr) {
  if (!task || task.status === 'completed') return false;
  if (task.completed_dates && task.completed_dates.includes(dateStr)) return false;
  if (task.exception_dates && task.exception_dates.includes(dateStr)) return false;
  if (task.end_date && dateStr > task.end_date) return false;

  if (task.recurrence_type === 'fixed') {
    const startDate = task.date || task.date_scheduled;
    if (startDate && dateStr < startDate) return false;
    const activeDays = task.active_days || [];
    return activeDays.includes(dayOfWeekStr);
  }

  const tDate = task.date || task.date_scheduled;
  return tDate === dateStr;
}

function isTaskPastDue(task, todayStr) {
  if (!task || task.status === 'completed') return false;
  const tDate = task.date || task.date_scheduled;
  if (!tDate) return false;

  if (task.recurrence_type === 'once' || task.recurrence_type === 'completion') {
    return tDate < todayStr;
  }

  if (task.recurrence_type === 'fixed') {
    if (task.date && task.date < todayStr && (!task.completed_dates || !task.completed_dates.includes(task.date))) {
      return true;
    }
  }

  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pjnuhzdzvxojudkfnofh.supabase.co';
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const slackBotToken = process.env.SLACK_BOT_TOKEN;

  if (!supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase Key in Vercel environment variables.' });
  }

  if (!slackBotToken) {
    return res.status(500).json({ error: 'Missing SLACK_BOT_TOKEN in Vercel environment variables.' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const isManualTest = req.method === 'POST';
    const body = req.body || {};

    const targetDate = new Date();
    const todayStr = formatDateKey(targetDate);
    const dayOfWeekStr = daysOfWeek[targetDate.getDay()];
    const dateFormattedHeader = targetDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });

    const { data: allTasks, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .neq('status', 'completed');

    if (taskError) {
      console.error('Error fetching tasks for dispatch:', taskError);
      return res.status(500).json({ error: taskError.message });
    }

    if (isManualTest) {
      const {
        slackMemberId,
        targetAssignee,
        onlyHighPriority = false
      } = body;

      if (!slackMemberId) {
        return res.status(400).json({ error: 'Missing Slack Member ID' });
      }

      const effectiveAssignee = targetAssignee || 'Team Member';
      const firstName = effectiveAssignee.split(' ')[0] || effectiveAssignee;

      const userTasks = (allTasks || []).filter(t => {
        const assignees = t.assignees || [];
        return assignees.includes(effectiveAssignee);
      });

      const todayTasks = userTasks.filter(t => {
        const isActive = isTaskActiveOnDate(t, todayStr, dayOfWeekStr);
        if (!isActive) return false;
        if (onlyHighPriority && t.priority !== 'High') return false;
        return true;
      });

      const overdueTasks = userTasks.filter(t => {
        const isOverdue = isTaskPastDue(t, todayStr);
        if (!isOverdue) return false;
        if (onlyHighPriority && t.priority !== 'High') return false;
        return true;
      });

      const messageBlocks = [
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
              text: `📅 *Daily Dispatch for ${dateFormattedHeader}*`
            }
          ]
        },
        {
          type: 'divider'
        }
      ];

      if (overdueTasks.length > 0) {
        const overdueLines = overdueTasks.map(t => {
          const dueDate = t.date || 'Past Due';
          return `• 🚨 *[Past Due: ${dueDate}]* ${t.title} — _[${t.company || 'General'}]_`;
        }).join('\n');

        messageBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*⚠️ ACTION REQUIRED — Past Due Tasks (${overdueTasks.length}):*\n${overdueLines}`
          }
        });
        messageBlocks.push({ type: 'divider' });
      }

      if (todayTasks.length > 0) {
        const todayLines = todayTasks.map(t => {
          const timeSlot = t.time_label || 'All-Day';
          const priorityBadge = t.priority === 'High' ? '🔴 *HIGH* ' : '';
          return `• *${timeSlot}* — ${priorityBadge}${t.title} • _[${t.company || 'General'}]_`;
        }).join('\n');

        messageBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Here is your agenda for today (${todayTasks.length} ${todayTasks.length === 1 ? 'task' : 'tasks'}):*\n${todayLines}`
          }
        });
      } else {
        messageBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🎉 *No active tasks scheduled for today!* Enjoy your day.`
          }
        });
      }

      messageBlocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `_Sent automatically via Tasky Dispatch Engine_`
          }
        ]
      });

      const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${slackBotToken}`
        },
        body: JSON.stringify({
          channel: slackMemberId,
          text: `☀️ Good Morning, ${firstName}! You have ${todayTasks.length} task(s) scheduled for today.`,
          blocks: messageBlocks
        })
      });

      const slackJson = await slackRes.json();
      if (!slackJson.ok) {
        console.error('Slack Post Message Error:', slackJson);
        return res.status(500).json({ error: `Slack API error: ${slackJson.error}` });
      }

      return res.status(200).json({
        success: true,
        sentTo: effectiveAssignee,
        overdueCount: overdueTasks.length,
        todayCount: todayTasks.length
      });
    }

    // AUTOMATED VERCEL CRON RUN (GET /api/dispatch)
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('dispatch_enabled', true)
      .not('slack_member_id', 'is', null);

    if (profileErr) {
      console.error('Error fetching profiles for automated dispatch:', profileErr);
      return res.status(500).json({ error: profileErr.message });
    }

    const currentHourString = targetDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).replace(/:\d\d\s/, ':00 ');

    let dispatchedCount = 0;

    for (const profile of (profiles || [])) {
      const scheduledTime = profile.dispatch_time || '08:00 AM';
      const scheduledHourOnly = scheduledTime.replace(/:\d\d\s/, ':00 ');

      if (currentHourString !== scheduledHourOnly) {
        continue;
      }

      const effectiveAssignee = profile.dispatch_target_assignee || profile.name || profile.full_name;
      const firstName = effectiveAssignee.split(' ')[0] || effectiveAssignee;
      const onlyHighPriority = profile.dispatch_high_priority_only || false;

      const userTasks = (allTasks || []).filter(t => {
        const assignees = t.assignees || [];
        return assignees.includes(effectiveAssignee);
      });

      const todayTasks = userTasks.filter(t => {
        const isActive = isTaskActiveOnDate(t, todayStr, dayOfWeekStr);
        if (!isActive) return false;
        if (onlyHighPriority && t.priority !== 'High') return false;
        return true;
      });

      const overdueTasks = userTasks.filter(t => {
        const isOverdue = isTaskPastDue(t, todayStr);
        if (!isOverdue) return false;
        if (onlyHighPriority && t.priority !== 'High') return false;
        return true;
      });

      const messageBlocks = [
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
              text: `📅 *Daily Dispatch for ${dateFormattedHeader}*`
            }
          ]
        },
        {
          type: 'divider'
        }
      ];

      if (overdueTasks.length > 0) {
        const overdueLines = overdueTasks.map(t => {
          const dueDate = t.date || 'Past Due';
          return `• 🚨 *[Past Due: ${dueDate}]* ${t.title} — _[${t.company || 'General'}]_`;
        }).join('\n');

        messageBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*⚠️ ACTION REQUIRED — Past Due Tasks (${overdueTasks.length}):*\n${overdueLines}`
          }
        });
        messageBlocks.push({ type: 'divider' });
      }

      if (todayTasks.length > 0) {
        const todayLines = todayTasks.map(t => {
          const timeSlot = t.time_label || 'All-Day';
          const priorityBadge = t.priority === 'High' ? '🔴 *HIGH* ' : '';
          return `• *${timeSlot}* — ${priorityBadge}${t.title} • _[${t.company || 'General'}]_`;
        }).join('\n');

        messageBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Here is your agenda for today (${todayTasks.length} ${todayTasks.length === 1 ? 'task' : 'tasks'}):*\n${todayLines}`
          }
        });
      } else {
        messageBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🎉 *No active tasks scheduled for today!* Enjoy your day.`
          }
        });
      }

      messageBlocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `_Sent automatically via Tasky Dispatch Engine_`
          }
        ]
      });

      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${slackBotToken}`
        },
        body: JSON.stringify({
          channel: profile.slack_member_id,
          text: `☀️ Good Morning, ${firstName}! You have ${todayTasks.length} task(s) scheduled for today.`,
          blocks: messageBlocks
        })
      });

      dispatchedCount++;
    }

    return res.status(200).json({ success: true, dispatchedCount });

  } catch (err) {
    console.error('Dispatch handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}