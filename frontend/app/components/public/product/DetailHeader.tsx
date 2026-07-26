// Cabecera compartida de las páginas de detalle (producto y combo): badges + título
// + botón de compartir. Fuente única para que ambas se vean idénticas.
import { motion } from "framer-motion";
import { Share2 } from "lucide-react";
import { itemFade } from "~/lib/detailMotion";

export function DetailHeader({
  title,
  onShare,
  shareLabel,
  badges,
}: {
  title: string;
  onShare: () => void;
  shareLabel: string;
  badges?: React.ReactNode;
}) {
  return (
    <motion.div variants={itemFade}>
      {badges && <div className="mb-3 flex flex-wrap gap-2">{badges}</div>}
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-heading text-2xl sm:text-[clamp(2rem,5.5vw,3.25rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-balance text-text">
          {title}
        </h1>
        <button
          type="button"
          onClick={onShare}
          aria-label={shareLabel}
          className="mt-2 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2/60 text-muted transition-colors hover:bg-surface hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2/50"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>
    </motion.div>
  );
}
