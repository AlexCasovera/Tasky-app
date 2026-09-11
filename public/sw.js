self.addEventListener('push', function(event) {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'Tasky Alert', body: event.data.text() };
  }

  const options = {
    body: data.body || 'You have a new task update',
    icon: data.icon || '/favicon.svg',
    vibrate: [100, 50, 100],
    data: { url: self.location.origin }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Tasky Alert', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data ? event.notification.data.url : '/')
  );
});