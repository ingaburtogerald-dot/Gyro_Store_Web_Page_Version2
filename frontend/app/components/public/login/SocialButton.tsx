import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

export function SocialButton({
  icon,
  label,
  loading,
  reduce,
  onClick,
  hoverClass,
}: {
  icon: React.ReactNode;
  label: string;
  loading?: boolean;
  reduce: boolean;
  onClick?: () => void;
  hoverClass?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={loading}
      whileTap={reduce || loading ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      className={cn(
        "group flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-2/40 px-4 py-2.5 text-sm font-medium text-text transition-colors hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60 disabled:cursor-not-allowed",
        hoverClass,
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <span className={cn("inline-flex transition-transform duration-200", !reduce && "group-hover:scale-110")}>
          {icon}
        </span>
      )}
      {label}
    </motion.button>
  );
}
