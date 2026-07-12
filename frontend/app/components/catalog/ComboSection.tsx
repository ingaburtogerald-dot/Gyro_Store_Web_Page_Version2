// Sección "Combos" del storefront: fila destacada de paquetes (2 productos a
// precio especial). Se renderiza en el home cuando hay combos activos y no hay
// filtros aplicados. Los datos llegan por SSR desde el loader de la home.
import { Sparkles } from "lucide-react";
import type { Combo } from "~/store/api/catalogApi";
import { ComboCard } from "./ComboCard";

export function ComboSection({ combos }: { combos: Combo[] }) {
  if (!combos.length) return null;

  return (
    <section className="pt-6 lg:pt-8">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-accent" />
        <div>
          <h2 className="font-heading text-xl font-bold leading-none">Combos que ahorran</h2>
          <p className="mt-1 text-sm text-muted">Llevá dos productos juntos a precio especial</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {combos.map((combo, i) => (
          <ComboCard key={combo.id} combo={combo} index={i} />
        ))}
      </div>
    </section>
  );
}
