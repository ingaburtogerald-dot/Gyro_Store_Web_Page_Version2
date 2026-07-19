// Franja de confianza bajo el Hero. Mismas señales que PublicFooter
// (TRUST_SIGNALS, confirmadas por el negocio) + WhatsApp como diferenciador
// propio de esta franja. Un solo lugar (trustSignals.ts) evita que footer y
// home se desincronicen.
import { MessageCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TRUST_SIGNALS } from "~/lib/trustSignals";

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
      className="mx-auto w-full max-w-[1400px] px-4 pb-6 pt-2"
    >
      <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
        {BADGES.map((b) => (
          <div
            key={b.label}
            className="flex items-center gap-2.5 rounded-full border border-border/40 bg-surface/40 px-4 py-2.5 text-sm font-semibold text-muted"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/10 text-accent-2" aria-hidden>
              <b.icon className="h-3.5 w-3.5" />
            </span>
            {b.label}
          </div>
        ))}
      </div>
    </section>
  );
}
