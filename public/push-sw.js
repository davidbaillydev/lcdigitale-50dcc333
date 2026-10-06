// Service worker de notifications uniquement (aucun cache de pages).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let msg = { title: "Votre commande", body: "Votre commande a été mise à jour.", url: "/" };
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        const r = await fetch("/api/public/push/message?endpoint=" + encodeURIComponent(sub.endpoint), { cache: "no-store" });
        if (r.ok) msg = { ...msg, ...(await r.json()) };
      }
    } catch (e) {}
    await self.registration.showNotification(msg.title, { body: msg.body, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: msg.url }, tag: msg.url });
  })());
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) if (new URL(c.url).pathname === url && "focus" in c) return c.focus();
    return self.clients.openWindow(url);
  })());
});
