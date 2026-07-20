// Franja de confianza bajo el Hero. Mismas señales que PublicFooter
// (TRUST_SIGNALS, confirmadas por el negocio) + WhatsApp como diferenciador
// propio de esta franja. Un solo lugar (trustSignals.ts) evita que footer y
// home se desincronicen.
import { MessageCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TRUST_SIGNALS } from "~/lib/trustSignals";
import { cn } from "~/lib/utils";

interface TrustBadge {
  icon: LucideIcon;
  label: string;
}

const BADGES: TrustBadge[] = [...TRUST_SIGNALS, { icon: MessageCircle, label: "Atención por WhatsApp" }];

export function TrustStrip() {
  if (BADGES.length === 0) return null;

  return (
    <section
      aria-label="Por qué comprar en Gyro Store"
      className="mx-auto w-full max-w-[1400px] px-4 pb-4 pt-1 sm:pb-6 sm:pt-2"
    >
      {/* Móvil: scroll horizontal compacto (una sola fila, sin ocupar media pantalla).
          Desde sm: vuelve al wrap centrado original. */}
      <div
        className={cn(
          "flex items-center gap-2 overflow-x-auto pb-0.5",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "sm:flex-wrap sm:justify-center sm:gap-3 sm:overflow-visible sm:pb-0",
        )}
      >
        {BADGES.map((b) => (
          <div
            key={b.label}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border/40 bg-surface/40 px-3 py-1.5 text-[11px] font-semibold text-muted sm:gap-2.5 sm:px-4 sm:py-2.5 sm:text-sm"
          >
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10 text-accent-2 sm:h-7 sm:w-7" aria-hidden>
              <b.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </span>
            {b.label}
          </div>
        ))}
      </div>
    </section>
  );
}
