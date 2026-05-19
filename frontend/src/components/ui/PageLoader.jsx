import { Loader2 } from "lucide-react";

/**
 * Full-width loading state for route guards and heavy pages.
 */
export default function PageLoader({ label = "Chargement…" }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 px-4 min-h-[200px]"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col items-center space-y-4">
        <Loader2
          className="w-10 h-10 text-primary animate-spin"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
      </div>
    </div>
  );
}
