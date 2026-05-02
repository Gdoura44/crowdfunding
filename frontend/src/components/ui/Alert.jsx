export default function Alert({ variant = "info", children, className = "", small = true }) {
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

  return (
    <div className={cls} role="status">
      {children}
    </div>
  );
}

