import { useEffect, useMemo, useState } from "react";

function resolveDismissAfterMs(variant, dismissAfterMs) {
  if (dismissAfterMs != null && dismissAfterMs !== "") {
    const n = Number(dismissAfterMs);
    if (Number.isFinite(n)) return n;
  }
  if (variant === "success") return 5000;
  return 0;
}

export default function Alert({
  variant = "info",
  children,
  className = "",
  small = true,
  dismissAfterMs,
  onDismiss,
}) {
  const map = {
    danger: "alert alert-danger",
    error: "alert alert-danger",
    success: "alert alert-success",
    warning: "alert alert-warning",
    info: "alert alert-info",
    secondary: "alert alert-secondary",
    light: "alert alert-light",
  };
  const base = map[variant] || map.info;
  const size = small ? "py-2 small" : "py-2";
  const cls = [base, "border-0", size, className].filter(Boolean).join(" ");

  const contentKey = useMemo(() => {
    if (typeof children === "string") return children;
    // For React nodes, best-effort stable key
    try {
      return JSON.stringify(children);
    } catch {
      return String(children);
    }
  }, [children]);

  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
  }, [contentKey, variant]);

  const autoDismissMs = useMemo(
    () => resolveDismissAfterMs(variant, dismissAfterMs),
    [variant, dismissAfterMs]
  );

  useEffect(() => {
    if (!Number.isFinite(autoDismissMs) || autoDismissMs <= 0) return;
    const t = setTimeout(() => {
      setVisible(false);
      try {
        onDismiss?.();
      } catch {
        // ignorer
      }
    }, autoDismissMs);
    return () => clearTimeout(t);
  }, [autoDismissMs, contentKey, variant, onDismiss]);

  if (!visible) return null;
  return (
    <div className={cls} role="status">
      {children}
    </div>
  );
}

