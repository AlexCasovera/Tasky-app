import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pjnuhzdzvxojudkfnofh.supabase.co';
    
    const supabaseKey = 
      process.env.SUPABASE_SECRET_KEY || 
      process.env.SUPABASE_SERVICE_ROLE_KEY || 
      process.env.VITE_SUPABASE_ANON_KEY || 
      process.env.SUPABASE_ANON_KEY;

    if (!supabaseKey) {
      return res.status(500).json({ 
        error: 'Missing Supabase Key in Vercel environment variables.' 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const todayDate = new Date();
    const todayStr = todayDate.toISOString().split('T')[0];
    const formattedDate = todayDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });

    const body = req.body || {};
    const testUserId = body.testUserId;

    // 1. Fetch eligible profiles with a linked Slack ID
    let profileQuery = supabase
      .from('profiles')
      .select('id, name, full_name, role, slack_user_id, slack_briefing_prefs')
      .not('slack_user_id', 'is', null);

    if (testUserId) {
      profileQuery = profileQuery.eq('id', testUserId);
    }

    const { data: profiles, error: profileErr } = await profileQuery;
    if (profileErr || !profiles) {
      return res.status(500).json({ error: profileErr?.message || 'No profiles found' });
    }

    // 2. Fetch all active tasks scheduled for today
    const { data: allTasks, error: taskErr } = await supabase
      .from('tasks')
      .select('*')
      .neq('status', 'completed');

    if (taskErr) {
      return res.status(500).json({ error: taskErr.message });
    }

    let dispatchedCount = 0;

    // 3. Process dispatch for each profile
    for (const profile of profiles) {
      const prefs = profile.slack_briefing_prefs || {};
      
      if (!testUserId && !prefs.enabled) {
        continue;
      }

      const rawUserName = profile.name || profile.full_name || '';
      const slackId = profile.slack_user_id;
      if (!slackId) continue;

      // Automatically construct name aliases:
      // "Adrian R. (ADMIN)" -> matches both "Adrian R. (ADMIN)" AND "Adrian R."
      const cleanName = rawUserName.replace(/\s*\((admin|master|worker|employee)\)/i, '').trim();
      const targetNames = [rawUserName, cleanName];

      // If user chose a specific assignee in settings, include that too
      if (prefs.target_assignee && prefs.target_assignee !== 'auto') {
        targetNames.push(prefs.target_assignee);
      }

      // Filter tasks assigned to ANY of the user's aliases for today
      let userTasks = (allTasks || []).filter(t => {
        const assignees = t.assignees || [];
        const isAssigned = assignees.some(a => targetNames.includes(a));
        const isToday = t.date === todayStr || t.date_scheduled === todayStr;
        return isAssigned && isToday;
      });

      if (prefs.high_priority_only) {
        userTasks = userTasks.filter(t => t.priority === 'High');
      }

      userTasks.sort((a, b) => {
        if (a.start_time && !b.start_time) return -1;
        if (!a.start_time && b.start_time) return 1;
        return (a.start_time || '').localeCompare(b.start_time || '');
      });

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `☀️ Good Morning, ${cleanName.split(' ')[0]}!`,
            emoji: true
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `📅 *Daily Dispatch for ${formattedDate}*`
            }
          ]
        },
        { type: 'divider' }
      ];

      if (userTasks.length === 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🎉 *You have no active tasks scheduled for today.* Enjoy your day!'
          }
        });
      } else {
        const taskLines = userTasks.map(t => {
          const time = t.time_label || 'All-Day';
          const priorityTag = t.priority === 'High' ? ' `🚨 HIGH`' : '';
          const companyTag = t.company ? ` • _[${t.company}]_` : '';
          return `• *${time}* — *${t.title}*${companyTag}${priorityTag}`;
        });

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Here is your agenda for today (*${userTasks.length} task${userTasks.length > 1 ? 's' : ''}*):\n\n${taskLines.join('\n')}`
          }
        });
      }

      const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
        },
        body: JSON.stringify({
          channel: slackId,
          text: `☀️ Good Morning, ${cleanName}! Here is your Tasky agenda for today.`,
          blocks: blocks
        })
      });

      const slackJson = await slackRes.json();
      if (slackJson.ok) {
        dispatchedCount++;
      } else {
        console.error(`Failed to DM ${cleanName} (${slackId}):`, slackJson.error);
        return res.status(500).json({ error: `Slack API error: ${slackJson.error}` });
      }
    }

    return res.status(200).json({ success: true, dispatched: dispatchedCount });

  } catch (error) {
    console.error('Dispatch Handler Error:', error);
    return res.status(500).json({ error: error.message });
  }
}