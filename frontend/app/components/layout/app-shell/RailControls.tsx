import { Link } from "@remix-run/react";
import { LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import { CartButton } from "~/components/cart/CartButton";
import type { Role } from "~/lib/constants";
import type { SessionUser } from "~/lib/authStrategies";

const EASE = [0.16, 1, 0.3, 1] as const;

export function LoginButton({ expanded }: { expanded: boolean }) {
  if (!expanded) {
    return (
      <Link
        to="/login"
        title="Iniciar sesión"
        aria-label="Iniciar sesión"
        className="group grid h-11 w-11 place-items-center rounded-lg bg-gradient-to-b from-accent to-accent-hover text-bg shadow-md shadow-accent/25 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <LogIn className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
      </Link>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <Link
        to="/login"
        className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-b from-accent to-accent-hover px-4 py-2.5 text-sm font-semibold text-bg shadow-md shadow-accent/25 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <span
          aria-hidden
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
        />
        <LogIn className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        <span className="relative">Iniciar Sesión</span>
      </Link>
    </motion.div>
  );
}

export function RailControls({
  expanded,
  canCRM,
  user,
  roles,
}: {
  expanded: boolean;
  canCRM: boolean;
  user: SessionUser | null;
  roles: Role[];
}) {
  if (user) return null;

  return (
    <div
      className={cn(
        "shrink-0 border-t border-border p-3",
        expanded ? "flex flex-col gap-2" : "flex flex-col items-center gap-2",
      )}
    >
      <div className={cn("flex items-center gap-2", expanded ? "justify-between" : "flex-col")}>
        <div className={cn("flex items-center gap-2", !expanded && "flex-col")}>
          <CartButton />
        </div>
      </div>

      <LoginButton expanded={expanded} />
    </div>
  );
}
