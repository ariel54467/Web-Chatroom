// Shows chat notifications sent by the "push" Edge Function, even when the site is closed.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

const windows = () => self.clients.matchAll({ type: "window", includeUncontrolled: true });

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil((async () => {
    // Stay quiet when the person is already looking at this chat.
    const open = await windows();
    if (open.some(client => client.focused && client.visibilityState === "visible"
      && new URL(client.url).searchParams.get("chat") === data.room)) return;
    await self.registration.showNotification(data.title || "Chatterly", {
      body: data.body || "New message",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.room || "chatterly",
      renotify: true,
      data: { url: data.url || "/chat", room: data.room },
    });
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const { url = "/chat", room } = event.notification.data || {};
  event.waitUntil((async () => {
    const open = (await windows()).find(client => new URL(client.url).origin === self.location.origin);
    if (!open) return self.clients.openWindow(url);
    await open.focus();
    // The open app switches to the chat without reloading.
    open.postMessage({ type: "open-chat", room });
  })());
});
