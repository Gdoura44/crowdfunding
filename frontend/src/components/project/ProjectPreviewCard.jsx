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
    <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
      <div className="p-5">
        {/* Badges */}
        <div className="flex justify-between items-center gap-2 mb-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground border border-border">
            Aperçu
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
            Brouillon
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-foreground mb-1 truncate">
          {title?.trim() ? title : "Titre du projet"}
        </h3>

        {/* Meta */}
        <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
          <div>{category?.trim() ? category : "Catégorie"}</div>
          {(startAt || deadline) && (
            <div>
              {startAt ? `Démarre : ${safeDate(startAt)}` : "Démarre : —"}
              {deadline ? ` · Échéance : ${safeDate(deadline)}` : ""}
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed whitespace-pre-wrap">
          {desc.trim() ? (desc.length > 220 ? `${desc.slice(0, 220)}…` : desc) : "La description apparaîtra ici."}
        </p>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>0 / {goal || "—"} TND</span>
            <span>{Math.round(pct)}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              role="progressbar"
              style={{ width: `${pct}%` }}
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Tip */}
        <div className="bg-muted/60 border border-border/60 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Conseil :</strong> gardez un objectif réaliste, une description claire, et des dates cohérentes.
        </div>
      </div>
    </div>
  );
}
