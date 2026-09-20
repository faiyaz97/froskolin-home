self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  if (!data || typeof data !== "object") data = {};

  const title = typeof data.title === "string" && data.title.trim() ? data.title : "Froskolin";
  const body = typeof data.body === "string" ? data.body : "";
  const url = typeof data.url === "string" ? data.url : null;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/assets/froskolin-icon-192.png",
      badge: "/assets/froskolin-icon-192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification.data && event.notification.data.url;
  if (typeof rawUrl !== "string") return;

  let target;
  try {
    target = new URL(rawUrl, self.location.origin);
  } catch {
    return;
  }
  if (target.origin !== self.location.origin || !target.pathname.startsWith("/h/")) return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const client = clients.find((item) => "focus" in item);
      if (client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target.href);
        return;
      }
      await self.clients.openWindow(target.href);
    }),
  );
});
