// Carrusel horizontal de productos (estilo "Lo Más Nuevo" / "Tal vez te interese").
// Fila con scroll-snap + flechas prev/next que aparecen/deshabilitan según la posición,
// y degradados de borde. Reusa <ProductCard> para no duplicar la tarjeta. La animación
// de deslizamiento es scroll suave nativo (hardware-accelerated), no reflow.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@remix-run/react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { ProductCard } from "./ProductCard";
import type { CatalogProduct, Category } from "~/store/api/catalogApi";
import { cn, getProductUrl, formatCordobas } from "~/lib/utils";

export function ProductCarousel({
  title,
  subtitle,
  products,
  categories,
  variant = "product",
  hidePills = false,
}: {
  title: string;
  subtitle?: string;
  products: CatalogProduct[];
  categories: Category[];
  /** "product" = tarjetas con precio+CTA (PDP). "showcase" = tiles editoriales
   *  grandes (imagen + nombre + descripción, sin precio) estilo dbrand. */
  variant?: "product" | "showcase";
  /** Oculta los pills de variantes en las tarjetas (recomendaciones de la ficha). */
  hidePills?: boolean;
}) {
  const showcase = variant === "showcase";
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
    <section className="py-2 md:py-8" aria-label={title}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-heading text-[17px] font-bold tracking-tight text-text sm:text-2xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[11px] font-light text-muted sm:text-sm">{subtitle}</p>}
        </div>

        {/* Flechas (también en móvil ahora): se deshabilitan en los extremos. En móvil
            son la pista visible de que el carrusel se desliza de izquierda a derecha. */}
        <div className="flex shrink-0 gap-2">
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
                  "ease-expo grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full transition active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                  // showcase (dbrand "Popular Devices"): círculo claro sólido + flecha oscura.
                  // product (resto de carruseles): outline sutil sobre superficie oscura (sin cambios).
                  showcase
                    ? cn(
                        "bg-white/90 text-bg hover:bg-white",
                        "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white/90",
                      )
                    : cn(
                        "border border-white/10 bg-surface text-muted hover:border-white/25 hover:text-text",
                        "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-muted",
                      ),
                )}
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
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
            "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:gap-5",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {products.map((p, i) =>
            showcase ? (
              <li
                key={p.id}
                className="w-[54%] shrink-0 snap-start md:w-[31%] lg:w-[23.5%]"
              >
                <ShowcaseCard product={p} index={i} />
              </li>
            ) : (
              <li
                key={p.id}
                className="w-[40%] shrink-0 snap-start md:w-[23.5%] lg:w-[19%]"
              >
                <ProductCard product={p} categories={categories} index={i} showPills={!hidePills} />
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  );
}

// Tile editorial grande (estilo dbrand "Popular Devices"): foto protagonista en un
// stage rounded-2xl + nombre, precio y descripción corta. Sin CTA — es descubrimiento;
// el tap lleva a la ficha, donde vive la conversión. El precio SÍ va (mercado sensible
// al precio: sin él, el visitante no puede evaluar el tile y no convierte). DESIGN.md §4/§6.
function ShowcaseCard({ product, index }: { product: CatalogProduct; index: number }) {
  const reduce = useReducedMotion();
  const image = product.images?.[0];
  const description = product.description
    ? String(product.description).replace(/<[^>]*>?/gm, "").trim()
    : "";
  const compareAt = product.compareAtPrice ?? 0;
  const onSale = compareAt > product.price;

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: (index % 4) * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="group"
    >
      <Link
        to={getProductUrl(product.id, product.name)}
        prefetch="intent"
        viewTransition
        aria-label={product.name}
        className="block focus-visible:outline-none"
      >
        {/* Stage de imagen: la foto ya trae su propio fondo blanco — sin recuadro
            artificial (product-stage es un no-op de layout aquí, ver globals.css).
            Más compacto en móvil (aspect-[4/3]) para que se intuyan más tarjetas a
            la derecha; desde sm recupera la proporción editorial original. */}
        <div className="ease-expo product-stage relative aspect-square overflow-hidden rounded-2xl transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_20px_48px_-16px_rgba(0,0,0,0.5)]">
          {image ? (
            <img
              src={image}
              alt={product.name}
              loading={index < 4 ? "eager" : "lazy"}
              decoding="async"
              className="ease-expo h-full w-full object-cover transition-transform duration-[600ms] will-change-transform group-hover:scale-[1.06]"
              style={{ viewTransitionName: `vt-product-${product.id}` } as React.CSSProperties}
            />
          ) : (
            <div className="grid h-full place-items-center text-muted">
              <ImageOff className="h-8 w-8" />
            </div>
          )}
        </div>

        <h3 className="mt-3 text-[13px] font-bold leading-snug tracking-tight text-text transition-colors group-hover:text-accent-2 sm:text-xl sm:mt-4">
          {product.name}
        </h3>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-[13px] font-extrabold tabular-nums text-accent-2 sm:text-lg">{formatCordobas(product.price)}</span>
          {onSale && (
            <span className="text-xs text-muted line-through tabular-nums sm:text-sm">{formatCordobas(compareAt)}</span>
          )}
        </div>
        {/* line-clamp-2 en móvil: menos altura por tarjeta en el carrusel showcase
            (aspect-[4/5] ya es alto de por sí). Desktop conserva 4 líneas. */}
        {description && (
          <p className="mt-1.5 line-clamp-2 sm:line-clamp-4 max-w-[400px] text-[11px] font-light leading-relaxed text-pretty text-muted sm:text-sm sm:mt-2">
            {description}
          </p>
        )}
      </Link>
    </motion.article>
  );
}
