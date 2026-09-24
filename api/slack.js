import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    let rawPayload = req.body.payload;
    if (!rawPayload && typeof req.body === 'string') {
        const params = new URLSearchParams(req.body);
        rawPayload = params.get('payload');
    }
    
    if (!rawPayload) return res.status(400).send('No payload');

    const payload = JSON.parse(rawPayload);

    if (payload.type === 'message_action' && payload.callback_id === 'send_to_tasky') {
      const messageText = payload.message.text;
      const slackUser = payload.user?.name || payload.user?.username || 'Slack User';

      // Pulling the URL from the existing Vite variable, and the Secret Key from our new secure variable
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SECRET_KEY;
      
      const supabase = createClient(supabaseUrl, supabaseKey);

      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase.from('tasks').insert({
        title: `Slack Request from ${slackUser}`,
        desc: messageText,
        company: 'Internal', 
        status: 'pending',
        priority: 'Standard',
        recurrenceType: 'once',
        date: today
      });

      if (error) {
        console.log("Supabase Rejected the Insert:", error);
        return res.status(500).send('Database Error');
      }

      return res.status(200).send('OK');
    }

    return res.status(200).send('OK');

  } catch (err) {
    console.log("Syntax/Parse Error:", err);
    return res.status(500).send('Server Error');
  }
}