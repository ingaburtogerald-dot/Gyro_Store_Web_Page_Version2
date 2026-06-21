// Placeholder de portal en construcción. Cada portal lo reemplaza por su UI real
// en la fase correspondiente. Centraliza el mensaje para no duplicarlo en 6 archivos.
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export function PortalPlaceholder({
  icon: Icon,
  title,
  phase,
}: {
  icon: LucideIcon;
  title: string;
  phase: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-xl rounded-card border border-border bg-surface p-10 text-center"
    >
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-accent">
        <Icon className="h-7 w-7 text-white" />
      </div>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        Este portal se implementa en la <strong className="text-accent-2">{phase}</strong>.
      </p>
    </motion.div>
  );
}
