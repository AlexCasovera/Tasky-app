// api/cron-dispatch.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Allow GET requests (Vercel crons default to GET)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Vercel Cron Security: Ensures only Vercel can trigger this automated endpoint
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
  
  // Calculate today's date locked to Arizona time (UTC-7) to ensure day boundary consistency
  const azDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Phoenix" }));
  const targetDate = azDate.toISOString().split('T')[0];

  try {
    // 1. Fetch all users who have toggled the dispatch ON and have a connected Slack ID
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('slack_user_id, name, full_name, dispatch_target_name, dispatch_priority_only')
      .eq('dispatch_enabled', true)
      .not('slack_user_id', 'is', null);

    if (profileError) throw profileError;
    if (!profiles || profiles.length === 0) {
      return res.status(200).json({ message: 'No active dispatches found for today.' });
    }

    // 2. Fetch all active tasks across the company
    const { data: allTasks, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .neq('status', 'completed');

    if (taskError) throw taskError;

    let messagesSent = 0;

    // 3. Process each opted-in user sequentially
    for (const profile of profiles) {
      // The worker schedule we are pulling (Fallback to the user's own profile name)
      const targetName = profile.dispatch_target_name || profile.name || profile.full_name;
      const firstFirstName = targetName.split(' ')[0];

      // Filter tasks for this specific user
      const filteredTasks = (allTasks || []).filter(task => {
        const isAssigned = (task.assignees || []).includes(targetName);
        if (!isAssigned) return false;
        
        if (profile.dispatch_priority_only && task.priority !== 'High') return false;

        const isScheduledToday = task.date === targetDate;
        const isPastDue = task.date && task.date < targetDate;

        return isScheduledToday || isPastDue;
      });

      // Format Date for Slack Header
      const parsedDate = new Date(targetDate + 'T12:00:00Z');
      const options = { weekday: 'long', month: 'short', day: 'numeric' };
      const dateFormatted = isNaN(parsedDate.getTime()) ? targetDate : parsedDate.toLocaleDateString('en-US', options);

      // Build Slack Block Kit
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
          const isPastDue = t.date && t.date < targetDate;
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

      // Send payload to Slack API
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