import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@tasky.app',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subscription, title, message } = req.body;

  if (!subscription) {
    return res.status(400).json({ error: 'Missing push subscription object' });
  }

  const payload = JSON.stringify({
    title: title || 'Task Update',
    body: message || 'You have a new task notification',
    icon: '/icons.svg'
  });

  try {
    await webpush.sendNotification(subscription, payload);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Web Push Error:', error);
    return res.status(500).json({ error: error.message });
  }
}