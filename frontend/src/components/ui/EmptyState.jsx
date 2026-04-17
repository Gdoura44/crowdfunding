export default function EmptyState({
  icon = "fa-regular fa-folder-open",
  title,
  description,
  children,
}) {
  return (
    <div className="fc-empty card border-0 shadow-sm">
      <div className="card-body text-center py-5 px-4">
        <div className="fc-empty__icon mb-3" aria-hidden="true">
          <i className={icon} />
        </div>
        <h2 className="h6 fw-semibold text-dark mb-2">{title}</h2>
        {description && (
          <p className="text-muted small mb-3 mx-auto" style={{ maxWidth: "28rem" }}>
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
