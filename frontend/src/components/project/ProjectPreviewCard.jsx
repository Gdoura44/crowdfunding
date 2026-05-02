function safeDate(s) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString("fr-FR");
  } catch {
    return "";
  }
}

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

export default function ProjectPreviewCard({ title, description, category, fundingGoal, startAt, deadline }) {
  const goal = Number(fundingGoal || 0);
  const pct = goal > 0 ? clamp((0 / goal) * 100, 0, 100) : 0;
  const desc = String(description || "");

  return (
    <div className="card border-0 fc-surface-card">
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <span className="badge bg-light text-dark border">Aperçu</span>
          <span className="badge bg-secondary">Brouillon</span>
        </div>
        <h3 className="h6 fw-semibold text-dark mb-1">{title?.trim() ? title : "Titre du projet"}</h3>
        <div className="small text-muted mb-2">
          {category?.trim() ? category : "Catégorie"}
          {(startAt || deadline) && (
            <>
              {" "}
              · {startAt ? `démarre ${safeDate(startAt)}` : "démarre —"}
              {deadline ? ` · échéance ${safeDate(deadline)}` : ""}
            </>
          )}
        </div>
        <p className="small text-muted mb-3" style={{ whiteSpace: "pre-wrap" }}>
          {desc.trim() ? (desc.length > 220 ? `${desc.slice(0, 220)}…` : desc) : "La description apparaîtra ici."}
        </p>

        <div className="mb-2">
          <div className="d-flex justify-content-between small text-muted mb-1">
            <span>0 / {goal || "—"} TND</span>
            <span>{Math.round(pct)}%</span>
          </div>
          <div className="progress" style={{ height: "8px" }}>
            <div
              className="progress-bar"
              role="progressbar"
              style={{ width: `${pct}%`, backgroundColor: "var(--fc-brand)" }}
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        <div className="small text-muted border rounded-3 p-3 mb-0 bg-light">
          <strong>Conseil :</strong> gardez un objectif réaliste, une description claire, et des dates cohérentes.
        </div>
      </div>
    </div>
  );
}

