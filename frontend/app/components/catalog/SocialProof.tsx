// Prueba social del home. Antes mostraba testimonios PLACEHOLDER (falsos); ahora
// integra reseñas REALES de Google/Facebook vía ReviewsWidget (widget de terceros).
// Mientras no se configure el id del widget, ReviewsWidget muestra una tarjeta que
// lleva a las reseñas de Google — nunca reseñas inventadas.
// La fila de marcas de abajo reusa BrandStrip.tsx (marquee de marcas reales).
import { ReviewsWidget } from "./ReviewsWidget";

export function SocialProof() {
  return (
    <section aria-label="Lo que dicen nuestros clientes" className="py-6 sm:py-8">
      <h2 className="font-heading text-[17px] font-bold leading-none text-text sm:text-xl">Lo que dicen nuestros clientes</h2>
      <p className="mb-4 mt-2 text-[13px] sm:text-sm text-muted">Reseñas verificadas de nuestros clientes en Google y Facebook.</p>

      <ReviewsWidget />
    </section>
  );
}
