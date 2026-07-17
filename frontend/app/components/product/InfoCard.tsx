import { cn } from "~/lib/utils";
import type { LucideIcon } from "lucide-react";

interface InfoCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  variant?: "default" | "highlight";
  className?: string;
}

export function InfoCard({ icon: Icon, title, description, variant = "default", className }: InfoCardProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-none border bg-surface-2 p-4",
        variant === "highlight" ? "border-accent-2/30 bg-accent-2/5" : "border-border",
        className
      )}
    >
      <Icon className="mt-0.5 h-6 w-6 shrink-0 text-accent-2" />
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-semibold text-text">{title}</h4>
        {description && <p className="text-xs text-muted leading-relaxed">{description}</p>}
      </div>
    </div>
  );
}
