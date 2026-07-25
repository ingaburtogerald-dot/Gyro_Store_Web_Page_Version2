import { motion } from "framer-motion";
import { Loader2, ArrowRight } from "lucide-react";

export function AnimatedPrimary({
  children,
  loading,
  reduce,
  type = "button",
  onClick,
}: {
  children: React.ReactNode;
  loading?: boolean;
  reduce: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={loading}
      whileTap={reduce || loading ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      className="group relative w-full overflow-hidden rounded-lg bg-gradient-to-b from-accent to-accent-hover px-5 py-3 text-sm font-semibold text-bg shadow-md shadow-accent/20 transition-shadow duration-300 hover:shadow-lg hover:shadow-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {!reduce && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
        />
      )}
      <span className="relative flex items-center justify-center gap-2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {children}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </>
        )}
      </span>
    </motion.button>
  );
}
