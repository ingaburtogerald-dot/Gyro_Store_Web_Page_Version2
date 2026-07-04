// Pestaña pill del orquestador de reportes.
import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

export function SubTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-pill px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
        active ? "bg-gradient-accent text-white" : "text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
