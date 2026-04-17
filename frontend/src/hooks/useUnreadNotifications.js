import { useEffect, useMemo, useState } from "react";
import { notificationsApi } from "../api/notifications";

export function useUnreadNotifications({
  enabled = true,
  pollMs = 15000,
  limit = 50,
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
        const { data } = await notificationsApi.list({ limit: opts.limit });
        const list = data.notifications || [];
        const n = list.filter((x) => !x.read).length;
        if (alive) setUnread(n);
      } catch {
        // best-effort
      } finally {
        if (alive) t = setTimeout(tick, opts.pollMs);
      }
    };

    tick();
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [opts]);

  return unread;
}

