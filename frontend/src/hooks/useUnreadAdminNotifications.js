import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/admin";
import { NOTIFICATIONS_CHANGED_EVENT } from "../utils/notificationsEvents";

export function useUnreadAdminNotifications({
  enabled = true,
  pollMs = 15000,
  limit = 80,
} = {}) {
  const [unread, setUnread] = useState(0);
  const opts = useMemo(() => ({ enabled, pollMs, limit }), [enabled, pollMs, limit]);

  useEffect(() => {
    if (!opts.enabled) {
      setUnread(0);
      return;
    }

    let alive = true;
    let t = null;

    const tick = async () => {
      try {
        const { data } = await adminApi.listNotifications({
          limit: opts.limit,
          unreadOnly: true,
        });
        const list = data.notifications || [];
        if (alive) setUnread(list.length);
      } catch {
        // au mieux
      } finally {
        if (alive) t = setTimeout(tick, opts.pollMs);
      }
    };

    const onChanged = () => {
      if (!alive) return;
      if (t) clearTimeout(t);
      tick();
    };

    tick();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => {
      alive = false;
      if (t) clearTimeout(t);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    };
  }, [opts]);

  return unread;
}

