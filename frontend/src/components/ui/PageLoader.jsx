/**
 * Full-width loading state for route guards and heavy pages.
 */
export default function PageLoader({ label = "Chargement…" }) {
  return (
    <div
      className="fc-page-loader d-flex flex-column align-items-center justify-content-center py-5 px-3"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="fc-page-loader__card card border-0 shadow-sm text-center p-4 p-md-5">
        <div
          className="spinner-border text-primary mb-3"
          style={{ width: "2.5rem", height: "2.5rem" }}
          aria-hidden="true"
        />
        <p className="mb-0 text-muted small">{label}</p>
      </div>
    </div>
  );
}
