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

    const supabaseUrl = 'https://pjnuhzdzvxojudkfnofh.supabase.co';
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ACTION 1: USER CLICKS THE SHORTCUT -> OPEN THE SLACK MODAL
    if (payload.type === 'message_action' && payload.callback_id === 'send_to_tasky') {
      const rawMessageText = payload.message.text || '';
      const defaultTitle = rawMessageText.length > 100 ? rawMessageText.substring(0, 100) + '...' : rawMessageText;
      const today = new Date().toISOString().split('T')[0];

      // DYNAMIC FETCH: Pull profiles and companies at the same time to beat Slack's timeout limit
      const [
        { data: profiles, error: profileError },
        { data: companies, error: companyError }
      ] = await Promise.all([
        supabase.from('profiles').select('full_name').order('full_name'),
        supabase.from('companies').select('name').order('name')
      ]);

      // Map Profiles
      let assigneeOptions = [];
      if (!profileError && profiles && profiles.length > 0) {
        assigneeOptions = profiles
          .filter(p => p.full_name) 
          .map(p => ({
            text: { type: 'plain_text', text: p.full_name.substring(0, 70) },
            value: p.full_name.substring(0, 70)
          }));
      } else {
        assigneeOptions = [{ text: { type: 'plain_text', text: 'Unassigned' }, value: 'Unassigned' }];
      }

      // Map Companies
      let companyOptions = [];
      if (!companyError && companies && companies.length > 0) {
        companyOptions = companies
          .filter(c => c.name) 
          .map(c => ({
            text: { type: 'plain_text', text: c.name.substring(0, 70) },
            value: c.name.substring(0, 70)
          }));
      } else {
        companyOptions = [{ text: { type: 'plain_text', text: 'Internal' }, value: 'Internal' }];
      }

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
            callback_id: 'tasky_modal_submit', 
            title: { type: 'plain_text', text: 'Create Tasky Task' },
            submit: { type: 'plain_text', text: 'Create Task' },
            blocks: [
              {
                type: 'input',
                block_id: 'title_block',
                element: { type: 'plain_text_input', action_id: 'title_input', initial_value: defaultTitle },
                label: { type: 'plain_text', text: 'Task Title' }
              },
              {
                type: 'input',
                block_id: 'desc_block',
                optional: true, 
                element: { type: 'plain_text_input', multiline: true, action_id: 'desc_input' },
                label: { type: 'plain_text', text: 'Description' }
              },
              {
                type: 'input',
                block_id: 'company_block',
                element: {
                  type: 'static_select',
                  action_id: 'company_input',
                  options: companyOptions 
                },
                label: { type: 'plain_text', text: 'Company' }
              },
              {
                type: 'input',
                block_id: 'assignee_block',
                element: {
                  type: 'static_select',
                  action_id: 'assignee_input',
                  options: assigneeOptions 
                },
                label: { type: 'plain_text', text: 'Employee' } // <--- Changed from 'Assignee' to 'Employee'
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
      const values = payload.view.state.values;
      
      const title = values.title_block.title_input.value;
      const description = values.desc_block.desc_input.value || '';
      const company = values.company_block.company_input.selected_option.value;
      const assignee = values.assignee_block.assignee_input.selected_option.value;
      const date = values.date_block.date_input.selected_date;

      const { error } = await supabase.from('tasks').insert({
        id: Date.now().toString(),
        title: title,
        description: description,
        company: company,
        assignees: [assignee], 
        status: 'pending',
        priority: 'Medium',
        recurrence_type: 'once',
        date: date
      });

      if (error) {
        console.log("Supabase Rejected Modal Insert:", JSON.stringify(error));
        return res.status(500).end();
      }

      return res.status(200).end();
    }

    return res.status(200).end();

  } catch (err) {
    console.log("Syntax/Parse Error:", err);
    return res.status(500).end();
  }
}