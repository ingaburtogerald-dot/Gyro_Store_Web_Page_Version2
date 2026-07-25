import { cn } from "~/lib/utils";

export function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all duration-200 ease-out",
        danger
          ? "text-muted hover:bg-danger/10 hover:text-danger"
          : "text-text hover:bg-surface-2 hover:text-accent",
      )}
    >
      <Icon className={cn(
        "h-4 w-4 transition-transform duration-200 group-hover:scale-110",
        danger ? "text-muted group-hover:text-danger" : "text-muted group-hover:text-accent"
      )} />
      <span className="transition-transform duration-200 group-hover:translate-x-0.5">{label}</span>
    </button>
  );
}
