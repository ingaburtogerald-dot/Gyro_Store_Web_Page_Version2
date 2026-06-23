// Botón de pestaña pill reutilizable — activo con gradiente de acento, inactivo muted.
import { cn } from "~/lib/utils";

interface TabBtnProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

export function TabBtn({ active, onClick, children, className }: TabBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-pill px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
        active ? "bg-gradient-accent text-white" : "text-muted hover:text-text",
        className,
      )}
    >
      {children}
    </button>
  );
}
