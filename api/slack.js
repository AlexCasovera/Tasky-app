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

    // =========================================================================
    // ACTION 1: USER CLICKS SHORTCUT -> CHECK PERMISSION -> OPEN SLACK MODAL
    // =========================================================================
    if (payload.type === 'message_action' && payload.callback_id === 'send_to_tasky') {
      
      // Check if ANY profile tied to this Slack ID is an Admin
      const { data: callerProfiles } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('slack_user_id', payload.user.id);

      const isAdmin = callerProfiles && callerProfiles.some(p => p.role === 'admin');

      // If NOT an admin, show a clean "Restricted" modal
      if (!isAdmin) {
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
              title: { type: 'plain_text', text: 'Tasky Permissions' },
              close: { type: 'plain_text', text: 'Dismiss' },
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '⚠️ *Admin Access Required*\n\nCreating tasks directly from Slack messages is reserved for Tasky Administrators.\n\nIf this message requires an action item, please forward or tag an admin.'
                  }
                }
              ]
            }
          })
        });
        return res.status(200).end();
      }

      // User is an approved Admin: prepare the form
      const rawMessageText = payload.message.text || '';
      const defaultTitle = rawMessageText.length > 100 ? rawMessageText.substring(0, 100) + '...' : rawMessageText;
      const today = new Date().toISOString().split('T')[0];

      const [
        { data: profiles, error: profileError },
        { data: companies, error: companyError }
      ] = await Promise.all([
        supabase.from('profiles').select('full_name').order('full_name'),
        supabase.from('companies').select('name').order('name')
      ]);

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
                label: { type: 'plain_text', text: 'Employee' } 
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

    // =========================================================================
    // ACTION 2: USER SUBMITS MODAL -> SAVE TASK & PING MOBILE
    // =========================================================================
    if (payload.type === 'view_submission' && payload.view.callback_id === 'tasky_modal_submit') {
      
      const { data: submitterProfiles } = await supabase
        .from('profiles')
        .select('role')
        .eq('slack_user_id', payload.user.id);

      const isSubmitterAdmin = submitterProfiles && submitterProfiles.some(p => p.role === 'admin');
      if (!isSubmitterAdmin) {
        return res.status(403).end();
      }

      const values = payload.view.state.values;
      const title = values.title_block.title_input.value;
      const description = values.desc_block.desc_input.value || '';
      const company = values.company_block.company_input.selected_option.value;
      const assignee = values.assignee_block.assignee_input.selected_option.value;
      const date = values.date_block.date_input.selected_date;
      const taskId = Date.now().toString();

      const { error: taskError } = await supabase.from('tasks').insert({
        id: taskId,
        title: title,
        description: description,
        company: company,
        assignees: [assignee],
        status: 'pending',
        priority: 'Medium',
        recurrence_type: 'once',
        date: date,
        allow_deadline_change: true,
        notify_on_task_created: true,
        notify_on_complete: true,
        notify_on_comment: true,
        notify_on_deadline_change: true
      });

      if (taskError) {
        console.log("Supabase Rejected Task Insert:", JSON.stringify(taskError));
        return res.status(500).end();
      }

      await supabase.from('notifications').insert({
        text: `New Task: "${title}" (via Slack)`,
        type: 'new_task',
        target_type: 'userName',
        target_value: assignee,
        task_id: taskId,
        task_date: date,
        read: false
      });

      const { data: profile } = await supabase
        .from('profiles')
        .select('push_subscription')
        .or(`full_name.eq."${assignee}",name.eq."${assignee}"`)
        .single();

      if (profile?.push_subscription) {
        try {
          await fetch('https://tasky-app-gilt.vercel.app/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription: profile.push_subscription,
              title: '📋 New Task Assigned',
              message: `You have been assigned: "${title}" (${company})`
            })
          });
        } catch (pushError) {
          console.log("Failed to ping /api/notify endpoint:", pushError);
        }
      }

      return res.status(200).end();
    }

    return res.status(200).end();

  } catch (err) {
    console.log("Syntax/Parse Error:", err);
    return res.status(500).end();
  }
}