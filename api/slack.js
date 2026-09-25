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

    // ACTION 1: USER CLICKS THE SHORTCUT -> OPEN THE SLACK MODAL
    if (payload.type === 'message_action' && payload.callback_id === 'send_to_tasky') {
      const messageText = payload.message.text;
      const slackUser = payload.user?.name || payload.user?.username || 'Slack User';
      const today = new Date().toISOString().split('T')[0];

      // Call Slack's API to construct and open the pop-up menu
      await fetch('https://slack.com/api/views.open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
        },
        body: JSON.stringify({
          trigger_id: payload.trigger_id,
          view: {
            type: 'modal',
            callback_id: 'tasky_modal_submit', // A new ID to identify when the form is submitted
            title: { type: 'plain_text', text: 'Create Tasky Task' },
            submit: { type: 'plain_text', text: 'Create Task' },
            blocks: [
              {
                type: 'input',
                block_id: 'title_block',
                element: { type: 'plain_text_input', action_id: 'title_input', initial_value: `Slack Request from ${slackUser}` },
                label: { type: 'plain_text', text: 'Task Title' }
              },
              {
                type: 'input',
                block_id: 'desc_block',
                element: { type: 'plain_text_input', multiline: true, action_id: 'desc_input', initial_value: messageText },
                label: { type: 'plain_text', text: 'Description' }
              },
              {
                type: 'input',
                block_id: 'company_block',
                element: {
                  type: 'static_select',
                  action_id: 'company_input',
                  options: [
                    { text: { type: 'plain_text', text: 'Internal' }, value: 'Internal' },
                    { text: { type: 'plain_text', text: 'TMLFO' }, value: 'TMLFO' },
                    { text: { type: 'plain_text', text: 'Leprino Personal' }, value: 'Leprino Personal' },
                    { text: { type: 'plain_text', text: 'Sparkulous' }, value: 'Sparkulous' },
                    { text: { type: 'plain_text', text: 'Personal Tasks' }, value: 'Personal Tasks' }
                  ],
                  initial_option: { text: { type: 'plain_text', text: 'Internal' }, value: 'Internal' }
                },
                label: { type: 'plain_text', text: 'Company' }
              },
              {
                type: 'input',
                block_id: 'assignee_block',
                element: {
                  type: 'static_select',
                  action_id: 'assignee_input',
                  options: [
                    { text: { type: 'plain_text', text: 'Alex M.' }, value: 'Alex M.' },
                    { text: { type: 'plain_text', text: 'Marc S.' }, value: 'Marc S.' },
                    { text: { type: 'plain_text', text: 'Adrian R.' }, value: 'Adrian R.' }
                  ],
                  initial_option: { text: { type: 'plain_text', text: 'Alex M.' }, value: 'Alex M.' }
                },
                label: { type: 'plain_text', text: 'Assignee' }
              },
              {
                type: 'input',
                block_id: 'date_block',
                element: { type: 'datepicker', action_id: 'date_input', initial_date: today },
                label: { type: 'plain_text', text: 'Due Date' }
              }
            ]
          }
        })
      });

      return res.status(200).end();
    }


    // ACTION 2: USER CLICKS SUBMIT ON THE MODAL -> SAVE TO SUPABASE
    if (payload.type === 'view_submission' && payload.view.callback_id === 'tasky_modal_submit') {
      // Extract the values from the Slack form
      const values = payload.view.state.values;
      
      const title = values.title_block.title_input.value;
      const description = values.desc_block.desc_input.value;
      const company = values.company_block.company_input.selected_option.value;
      const assignee = values.assignee_block.assignee_input.selected_option.value;
      const date = values.date_block.date_input.selected_date;

      const supabaseUrl = 'https://pjnuhzdzvxojudkfnofh.supabase.co';
      const supabaseKey = process.env.SUPABASE_SECRET_KEY;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error } = await supabase.from('tasks').insert({
        id: Date.now().toString(),
        title: title,
        description: description,
        company: company,
        assignees: [assignee], // Wrapped in an array to match your text[] database format
        status: 'pending',
        priority: 'Medium',
        recurrence_type: 'once',
        date: date
      });

      if (error) {
        console.log("Supabase Rejected Modal Insert:", JSON.stringify(error));
        return res.status(500).end();
      }

      // Slack requires an empty 200 response to successfully close the modal window
      return res.status(200).end();
    }

    return res.status(200).end();

  } catch (err) {
    console.log("Syntax/Parse Error:", err);
    return res.status(500).end();
  }
}