// Carrusel horizontal de productos (estilo "Lo Más Nuevo" / "Tal vez te interese").
// Fila con scroll-snap + flechas prev/next que aparecen/deshabilitan según la posición,
// y degradados de borde. Reusa <ProductCard> para no duplicar la tarjeta. La animación
// de deslizamiento es scroll suave nativo (hardware-accelerated), no reflow.
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "./ProductCard";
import type { CatalogProduct, Category } from "~/store/api/catalogApi";
import { cn } from "~/lib/utils";

export function ProductCarousel({
  title,
  subtitle,
  products,
  categories,
}: {
  title: string;
  subtitle?: string;
  products: CatalogProduct[];
  categories: Category[];
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update, products]);

  function scrollByView(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  }

  if (!products.length) return null;

  return (
    <section className="py-8" aria-label={title}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-bold tracking-tight text-text sm:text-2xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm font-light text-muted">{subtitle}</p>}
        </div>

        {/* Flechas (desktop): se deshabilitan en los extremos. */}
        <div className="hidden shrink-0 gap-2 sm:flex">
          {([-1, 1] as const).map((dir) => {
            const enabled = dir === -1 ? canPrev : canNext;
            const Icon = dir === -1 ? ChevronLeft : ChevronRight;
            return (
              <button
                key={dir}
                type="button"
                onClick={() => scrollByView(dir)}
                disabled={!enabled}
                aria-label={dir === -1 ? "Anterior" : "Siguiente"}
                className={cn(
                  "ease-expo grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-surface text-muted transition",
                  "hover:border-white/25 hover:text-text active:scale-95",
                  "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-muted",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                )}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Pista: degradado a la derecha para insinuar continuidad. */}
      <div className="relative">
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-bg to-transparent transition-opacity",
            canNext ? "opacity-100" : "opacity-0",
          )}
          aria-hidden
        />
        <ul
          ref={trackRef}
          onScroll={update}
          className={cn(
            "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:gap-5",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {products.map((p, i) => (
            <li
              key={p.id}
              className="w-[47%] shrink-0 snap-start sm:w-[31%] md:w-[23.5%] lg:w-[19%]"
            >
              <ProductCard product={p} categories={categories} index={i} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
