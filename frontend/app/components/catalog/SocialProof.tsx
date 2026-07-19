// Prueba social — TESTIMONIOS PLACEHOLDER. No son reseñas reales: son texto de
// ejemplo para que el bloque exista con el layout correcto mientras el negocio
// junta 5-8 reseñas/capturas reales (Google/Facebook/WhatsApp). Marcado visible
// (banner + "ejemplo" en cada tarjeta) para que nadie los confunda con reales —
// sacar esa marca en cuanto se reemplacen por contenido verdadero.
// La fila de marcas de abajo reusa BrandStrip.tsx (marquee ya construido pero
// nunca montado en ningún lado) en vez de una fila de texto propia.
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";
import { BrandStrip } from "./BrandStrip";

interface Testimonial {
  name: string;
  text: string;
  rating: number; // 1-5
}

// TODO(negocio): reemplazar por reseñas reales antes de publicar la sección.
const PLACEHOLDER_TESTIMONIALS: Testimonial[] = [
  { name: "Cliente de ejemplo", text: "Excelente atención y el pedido llegó rápido. Los audífonos suenan increíble para el precio.", rating: 5 },
  { name: "Cliente de ejemplo", text: "Compré por WhatsApp y todo el proceso fue súper fácil. Muy recomendado.", rating: 5 },
  { name: "Cliente de ejemplo", text: "Buena calidad, buen precio. Ya es mi segunda compra acá.", rating: 5 },
  { name: "Cliente de ejemplo", text: "Me encantó la garantía y lo rápido que respondieron mis dudas antes de comprar.", rating: 4 },
];

export function SocialProof() {
  return (
    <section aria-label="Lo que dicen nuestros clientes" className="py-8">
      <h2 className="font-heading text-xl font-bold leading-none text-text">Lo que dicen nuestros clientes</h2>
      <p className="mb-4 mt-2 inline-flex items-center gap-1.5 rounded-pill bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
        Reseñas de ejemplo — pendiente reemplazar por reales
      </p>

      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {PLACEHOLDER_TESTIMONIALS.map((t, i) => (
          <div key={i} className="w-[82%] shrink-0 snap-start rounded-2xl border border-border/60 bg-surface/40 p-5 sm:w-auto">
            <div className="flex items-center gap-0.5" aria-hidden>
              {Array.from({ length: 5 }).map((_, s) => (
                <Star key={s} className={cn("h-3.5 w-3.5", s < t.rating ? "fill-accent-2 text-accent-2" : "text-border")} />
              ))}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-text/90">&ldquo;{t.text}&rdquo;</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
              {t.name} <span className="italic normal-case text-muted/60">· ejemplo</span>
            </p>
          </div>
        ))}
      </div>

      {/* Marcas que distribuimos — fila de autoridad (marquee, contenido real). */}
      <div className="mt-8">
        <BrandStrip />
      </div>
    </section>
  );
}
