// api/notify.js
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.VITE_VAPID_PUBLIC_KEY ||
  'BHwkF10ChvQHdkA8haU2qwiLokceGAgQeWqmyE-3R0ZiygmKWXv50YVjCI3TauwJ5OyS47iUsz0wotPEPV8gH_8';

const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@tasky.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subscription, profileId, title, message } = req.body || {};

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Missing valid push subscription.' });
  }

  if (!VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Missing VAPID_PRIVATE_KEY in environment variables.' });
  }

  const payload = JSON.stringify({
    title: title || 'Tasky Notification',
    body: message || '',
    message: message || '',
    url: '/'
  });

  try {
    await webpush.sendNotification(subscription, payload, { TTL: 14400 });
    return res.status(200).json({ success: true });
  } catch (err) {
    const statusCode = err?.statusCode;

    // 410 Gone or 404 Not Found means Apple/Google permanently invalidated this endpoint
    if ((statusCode === 410 || statusCode === 404) && profileId) {
      try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey =
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_SECRET_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data: profile } = await supabase
            .from('profiles')
            .select('push_subscription, push_subscriptions')
            .eq('id', profileId)
            .single();

          if (profile) {
            const currentList = Array.isArray(profile.push_subscriptions) ? profile.push_subscriptions : [];
            const cleanedList = currentList.filter(s => s?.endpoint && s.endpoint !== subscription.endpoint);
            const cleanedSingle =
              profile.push_subscription?.endpoint === subscription.endpoint
                ? (cleanedList[cleanedList.length - 1] || null)
                : profile.push_subscription;

            await supabase
              .from('profiles')
              .update({
                push_subscriptions: cleanedList,
                push_subscription: cleanedSingle
              })
              .eq('id', profileId);
          }
        }
      } catch (cleanupErr) {
        console.error('Failed to clean up expired push token:', cleanupErr);
      }

      return res.status(200).json({ success: false, expired: true, cleanedUp: true });
    }

    console.error('WebPush send error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send push notification.' });
  }
}