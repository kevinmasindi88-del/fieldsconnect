self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: "FieldsConnect",
      body: event.data ? event.data.text() : "You have a new notification.",
    };
  }

  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title
      : "FieldsConnect";

  const notificationId =
    typeof payload.notificationId === "string" &&
    payload.notificationId.trim()
      ? payload.notificationId.trim()
      : null;

  const options = {
    body:
      typeof payload.body === "string"
        ? payload.body
        : "You have a new FieldsConnect notification.",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: notificationId
      ? `fc-${notificationId}`
      : undefined,
    renotify: false,
    data: {
      url:
        typeof payload.url === "string" && payload.url.startsWith("/")
          ? payload.url
          : "/notifications",
    },
  };

  const unreadCount =
    typeof payload.unreadCount === "number" &&
    Number.isFinite(payload.unreadCount)
      ? Math.max(0, Math.floor(payload.unreadCount))
      : null;

  const tasks = [
    self.registration.showNotification(
      title,
      options
    ),
  ];

  if (
    unreadCount !== null &&
    "setAppBadge" in self.navigator
  ) {
    if (unreadCount > 0) {
      tasks.push(
        self.navigator.setAppBadge(
          unreadCount
        )
      );
    } else if (
      "clearAppBadge" in self.navigator
    ) {
      tasks.push(
        self.navigator.clearAppBadge()
      );
    }
  }

  event.waitUntil(
    Promise.all(tasks)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const destination =
    event.notification.data?.url || "/notifications";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(destination);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(destination);
      }
    })
  );
});
