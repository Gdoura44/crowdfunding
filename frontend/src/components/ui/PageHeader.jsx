export default function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="fc-page-header d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-end gap-3 mb-4">
      <div className="flex-grow-1 min-w-0">
        <h1 className="h3 mb-1 fw-bold text-dark">{title}</h1>
        {subtitle && <p className="text-muted small mb-0">{subtitle}</p>}
      </div>
      {actions ? <div className="flex-shrink-0">{actions}</div> : null}
    </header>
  );
}
