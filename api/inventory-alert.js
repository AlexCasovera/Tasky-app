// api/inventory-alert.js
export default async function handler(req, res) {
  // Allow CORS so your GitHub Codespace / local test environment can call it
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slackUserId, managerName, itemName, company, currentQuantity, minQuantity, triggeredBy } = req.body || {};

  if (!slackUserId) {
    return res.status(400).json({ error: 'Missing Slack User ID for the assigned inventory manager.' });
  }

  const slackToken = process.env.SLACK_BOT_TOKEN;
  if (!slackToken) {
    return res.status(500).json({ error: 'SLACK_BOT_TOKEN is not configured on the server.' });
  }

  const messageText = [
    `🚨 *Low Inventory Reorder Alert — ${company}*`,
    `• *Item:* ${itemName}`,
    `• *Current Stock:* *${currentQuantity}* _(Minimum Required: ${minQuantity})_`,
    triggeredBy ? `• *Updated By:* ${triggeredBy}` : null,
    `\n📦 _Time to place another order for ${itemName}!_`
  ].filter(Boolean).join('\n');

  try {
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${slackToken}`
      },
      body: JSON.stringify({
        channel: slackUserId,
        text: messageText
      })
    });

    const data = await slackResponse.json();
    if (!data.ok) {
      return res.status(400).json({ error: data.error || 'Slack API error' });
    }

    return res.status(200).json({ success: true, managerName });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}