// api/dispatch.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { targetMemberName, slackUserId, onlyHighPriority, date } = req.body || {};

  if (!slackUserId) {
    return res.status(400).json({ error: 'Missing slackUserId' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pjnuhzdzvxojudkfnofh.supabase.co';
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const slackBotToken = process.env.SLACK_BOT_TOKEN;

  if (!supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase Key in Vercel environment variables' });
  }

  if (!slackBotToken) {
    return res.status(500).json({ error: 'Missing SLACK_BOT_TOKEN in Vercel environment variables' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    const { data: allTasks, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .neq('status', 'completed');

    if (taskError) {
      return res.status(500).json({ error: taskError.message });
    }

    const memberName = targetMemberName || 'Team Member';
    const firstFirstName = memberName.split(' ')[0];

    // Filter tasks belonging to target employee
    const filteredTasks = (allTasks || []).filter(task => {
      const isAssigned = (task.assignees || []).includes(memberName);
      if (!isAssigned) return false;

      if (onlyHighPriority && task.priority !== 'High') {
        return false;
      }

      const isScheduledToday = task.date === targetDate;
      const isPastDue = task.date && task.date < targetDate;

      return isScheduledToday || isPastDue;
    });

    const parsedDate = new Date(targetDate + 'T12:00:00Z');
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    const dateFormatted = isNaN(parsedDate.getTime()) ? targetDate : parsedDate.toLocaleDateString('en-US', options);

    let blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `☀️ Good Morning, ${firstFirstName}!`,
          emoji: true
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📅 *Daily Dispatch for ${dateFormatted}*`
          }
        ]
      },
      {
        type: 'divider'
      }
    ];

    if (filteredTasks.length === 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🎉 *You're all clear!* No pending tasks found for today.`
        }
      });
    } else {
      const taskLines = filteredTasks.map(t => {
        const isPastDue = t.date && t.date < targetDate;
        const overdueBadge = isPastDue ? ' 🚨 *OVERDUE*' : '';
        const priorityBadge = t.priority === 'High' ? ' 🔴 *HIGH PRIORITY*' : '';
        const timeBadge = t.time_label || 'All-Day';
        const companyBadge = t.company ? ` • [${t.company}]` : '';
        return `• *${timeBadge}* — ${t.title}${companyBadge}${overdueBadge}${priorityBadge}`;
      });

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Here is your agenda for today (${filteredTasks.length} task${filteredTasks.length > 1 ? 's' : ''}):*\n\n` + taskLines.join('\n')
        }
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
        text: `☀️ Daily Dispatch for ${dateFormatted} (${filteredTasks.length} tasks)`,
        blocks: blocks
      })
    });

    const slackResult = await slackResponse.json();

    if (!slackResult.ok) {
      return res.status(500).json({ error: `Slack API error: ${slackResult.error}` });
    }

    return res.status(200).json({ success: true, count: filteredTasks.length });
  } catch (error) {
    console.error('Dispatch handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}
