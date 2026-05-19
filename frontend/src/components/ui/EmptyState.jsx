import { FolderOpen } from "lucide-react";

/**
 * EmptyState – generic empty/zero-result placeholder.
 * Accepts an optional `icon` component (Lucide) or falls back to FolderOpen.
 */
export default function EmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  children,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 bg-muted text-muted-foreground flex items-center justify-center rounded-full mb-5" aria-hidden="true">
        <Icon className="w-8 h-8" />
      </div>
      {title && (
        <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
      )}
      {description && (
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-4">
          {description}
        </p>
      )}
      {children}
    </div>
  );
}
