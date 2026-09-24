import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Slack sends a POST request with a URL-encoded JSON payload
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const payload = JSON.parse(req.body.payload);

    // Verify this is our specific Message Shortcut
    if (payload.type === 'message_action' && payload.callback_id === 'send_to_tasky') {
      const messageText = payload.message.text;
      const slackUser = payload.user.name;

      // Initialize Supabase using your existing environment variables
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL, 
        process.env.VITE_SUPABASE_ANON_KEY
      );

      // Create a basic pending task from the message
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('tasks').insert({
        id: Date.now().toString(),
        title: `Slack Request from ${slackUser}`,
        desc: messageText,
        company: 'Internal', 
        status: 'pending',
        date: today,
        priority: 'Standard',
        recurrenceType: 'once',
        comments: [`💬 Forwarded directly from Slack by ${slackUser}`]
      });

      if (error) throw error;

      // Tell Slack it worked so it stops loading
      return res.status(200).send('OK');
    }
  } catch (err) {
    console.error("Webhook Error:", err);
    return res.status(500).send('Error');
  }

  return res.status(200).end();
}