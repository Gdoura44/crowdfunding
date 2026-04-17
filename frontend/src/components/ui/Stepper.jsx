export default function Stepper({ steps, current = 0 }) {
  const safeSteps = Array.isArray(steps) ? steps : [];
  const idx = Number.isFinite(Number(current)) ? Number(current) : 0;

  return (
    <ol className="list-unstyled d-flex flex-wrap gap-2 mb-0" aria-label="Progression">
      {safeSteps.map((s, i) => {
        const isDone = i < idx;
        const isActive = i === idx;
        const base = "badge rounded-pill border";
        const cls = isActive
          ? `${base} bg-primary`
          : isDone
            ? `${base} bg-success`
            : `${base} bg-light text-dark`;
        return (
          <li key={String(s)} className={cls} aria-current={isActive ? "step" : undefined}>
            <span className="me-2" aria-hidden="true">
              {i + 1}
            </span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}

