// Notifications only: no app-shell or asset cache. No customer data in notifications.
const database = () => new Promise((resolve, reject) => {
  const request = indexedDB.open("lc-staff-alerts", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("device");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const readDevice = async () => {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("device", "readonly");
    const request = transaction.objectStore("device").get("registration");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
};
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => event.waitUntil((async () => {
  try {
    const device = await readDevice();
    if (!device) return;
    const response = await fetch("/api/public/push/staff-messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: device.id, token: device.token }), cache: "no-store" });
    if (!response.ok) return;
    const { messages } = await response.json();
    for (const message of messages ?? []) {
      await self.registration.showNotification(message.title, { body: message.body, icon: "/icon-192.png", badge: "/icon-192.png", tag: message.tag, renotify: true, requireInteraction: true, silent: false, vibrate: [200, 100, 200], data: { url: message.url } });
    }
  } catch { /* never disclose tokens or private data */ }
})()));
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/espace", self.location.origin);
  if (target.origin !== self.location.origin || !target.pathname.startsWith("/espace")) return;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      if (new URL(client.url).origin === target.origin && "focus" in client) { await client.navigate(target.href); return client.focus(); }
    }
    return self.clients.openWindow(target.href);
  })());
});