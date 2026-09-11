export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { targetType, targetValue, title, message } = req.body;

  const ONESIGNAL_APP_ID = "20d3b6ba-25ad-4cc0-8001-2170d5c692ca";
  const ONESIGNAL_REST_KEY = "os_v2_app_edj3norfvvgmbaabefynlruszldrhzv5sy3u3cvyaavzdjz6m7fbo6vkfxrhl6akedv4dkl3kpidosjb5wvwkqxrafg6gnagbu7qaza";

  let filters = [];
  if (targetType === 'role') {
    filters = [{ field: 'tag', key: 'userRole', relation: '=', value: targetValue }];
  } else if (targetType === 'userName') {
    filters = [{ field: 'tag', key: 'userName', relation: '=', value: targetValue }];
  }

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        filters,
        headings: { en: title },
        contents: { en: message },
        url: req.headers.origin || 'https://tasky-app-5gkh-alpha.vercel.app'
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}