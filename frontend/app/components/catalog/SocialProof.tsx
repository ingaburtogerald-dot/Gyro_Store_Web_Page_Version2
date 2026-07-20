// Prueba social del home. Antes mostraba testimonios PLACEHOLDER (falsos); ahora
// integra reseñas REALES de Google/Facebook vía ReviewsWidget (widget de terceros).
// Mientras no se configure el id del widget, ReviewsWidget muestra una tarjeta que
// lleva a las reseñas de Google — nunca reseñas inventadas.
// La fila de marcas de abajo reusa BrandStrip.tsx (marquee de marcas reales).
import { BrandStrip } from "./BrandStrip";
import { ReviewsWidget } from "./ReviewsWidget";

export function SocialProof() {
  return (
    <section aria-label="Lo que dicen nuestros clientes" className="py-8">
      <h2 className="font-heading text-xl font-bold leading-none text-text">Lo que dicen nuestros clientes</h2>
      <p className="mb-4 mt-2 text-sm text-muted">Reseñas verificadas de nuestros clientes en Google y Facebook.</p>

      <ReviewsWidget />

      {/* Marcas que distribuimos — fila de autoridad (marquee, contenido real). */}
      <div className="mt-8">
        <BrandStrip />
      </div>
    </section>
  );
}
