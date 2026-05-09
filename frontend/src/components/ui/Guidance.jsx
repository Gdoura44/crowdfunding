export default function Guidance({ variant = "info", title = "", children }) {
  const map = {
    info: "alert alert-info border-0 small py-2",
    warning: "alert alert-warning border-0 small py-2",
    success: "alert alert-success border-0 small py-2",
  };
  const cls = map[variant] || map.info;

  return (
    <div className={cls} role="note">
      {title ? <div className="fw-semibold text-dark mb-1">{title}</div> : null}
      <div className="mb-0">{children}</div>
    </div>
  );
}

