import { Bike, Package, Banknote, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const TRUST_ITEMS: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: Bike, title: "Delivery en Managua", description: "Servicio con costo extra para recibir tu producto." },
  { icon: Package, title: "Envíos a departamentos por Cargo Trans", description: "Envíos seguros a todo el país." },
  { icon: Banknote, title: "Pago contra entrega", description: "Paga en efectivo o transferencia al recibir tu producto." },
  { icon: ShieldCheck, title: "Garantía de 1 mes", description: "Cobertura por defectos de fábrica." },
];

export function TrustBox() {
  return (
    <div className="mt-0 flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 gap-3 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {TRUST_ITEMS.map((t) => {
        const Icon = t.icon;
        return (
          <div key={t.title} className="flex-shrink-0 w-[85%] sm:w-auto flex flex-col gap-1 sm:gap-1.5 rounded-xl sm:rounded-2xl bg-surface-2/60 p-3 sm:p-4 ring-1 ring-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-colors hover:bg-surface-2 snap-center">
            <div className="flex items-center gap-1.5 sm:gap-2 text-text font-medium text-[11px] sm:text-sm">
              <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-accent" /> {t.title}
            </div>
            <p className="text-[10px] sm:text-xs text-muted leading-tight sm:leading-relaxed">{t.description}</p>
          </div>
        );
      })}
    </div>
  );
}
