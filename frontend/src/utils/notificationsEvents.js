export const NOTIFICATIONS_CHANGED_EVENT = "fc:notifications-changed";

export function emitNotificationsChanged() {
  try {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  } catch {
    // Sans bloquer : certains environnements (tests) peuvent refuser `Event`.
  }
}

