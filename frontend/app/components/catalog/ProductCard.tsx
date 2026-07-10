// Tarjeta de producto del storefront — piel "Midnight Neon".
//
// Principios (hereda los de la tarjeta anterior y suma la nueva piel):
//  - La FOTO sigue siendo la estrella: escenario con foco radial (product-stage),
//    blur-up al cargar, parallax sutil al hover y view transition hacia el detalle.
//  - Glass real: fondo translúcido + backdrop-blur; borde cyan tenue que se
//    enciende al hover (nada de glow neón permanente).
//  - Pills compactas con las variantes reales (axesSummary del backend); si el
//    ítem no tiene, caen a los badges del catálogo. Peso light = jerarquía.
//  - Precio en cyan extrabold y CTA "Agregar al carrito" SIEMPRE visible con
//    texto oscuro sobre cyan (AA ~10:1). Si el producto tiene >1 combinación
//    (variantCount del backend), el CTA abre el QuickAddSheet para elegir la
//    variante exacta; con una sola combinación agrega directo.
//  - Dos disposiciones para el bento de la grilla: "grid" (vertical) y "list"
//    (horizontal editorial para tiles anchos: hero + ofertas).
import { useState } from "react";
import { Link } from "@remix-run/react";
import { motion, useReducedMotion } from "framer-motion";
import { ShoppingCart, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { QuickAddSheet } from "./QuickAddSheet";
import type { CatalogProduct, Category } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { formatCordobas, cn } from "~/lib/utils";

const MAX_PILLS = 3;

export function ProductCard({
  product,
  categories,
  layout = "grid",
  index = 0,
}: {
  product: CatalogProduct;
  categories: Category[];
  layout?: "grid" | "list";
  /** Posición en la grilla: escalona la entrada de las tarjetas visibles. */
  index?: number;
}) {
  const dispatch = useAppDispatch();
  const reduce = useReducedMotion();
  const category = categories.find((c) => c.id === product.category);
  const image = product.images?.[0];
  const soldOut = (product.stock ?? 0) <= 0;
  const compareAt = product.compareAtPrice ?? 0;
  const onSale = compareAt > product.price;
  const discountPct = onSale ? Math.round((1 - product.price / compareAt) * 100) : 0;
  const isList = layout === "list";

  // Pills de variantes: primero las opciones reales de la plantilla; si el
  // ítem no tiene plantilla, se muestran sus badges.
  const pills = (product.axesSummary?.length ? product.axesSummary : product.badges) ?? [];
  const visiblePills = pills.slice(0, MAX_PILLS);
  const extraPills = pills.length - visiblePills.length;

  // >1 combinación encendida → hay que elegir variante antes de agregar.
  const needsPicker = (product.variantCount ?? 1) > 1;
  const [sheetOpen, setSheetOpen] = useState(false);
  // El sheet se monta recién en el primer uso (30 cards × portal vacío = ruido).
  const [sheetMounted, setSheetMounted] = useState(false);

  function handleCta(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (soldOut) return;
    if (needsPicker) {
      setSheetMounted(true);
      setSheetOpen(true);
      return;
    }
    dispatch(
      addItem({
        catalogId: product.id,
        name: product.name,
        variantName: "Estándar",
        price: product.price,
        image: image || "",
        quantity: 1,
      }),
    );
    dispatch(openCart());
    toast.success("Agregado al carrito");
  }

  // ── Escenario de la imagen (Link al detalle) ──
  const Stage = (
    <Link
      to={`/producto/${product.id}`}
      prefetch="intent"
      viewTransition
      aria-label={product.name}
      className={cn(
        "product-stage ease-expo relative block overflow-hidden rounded-xl",
        isList ? "aspect-square h-full w-full" : "aspect-square w-full",
      )}
    >
      {/* Badges sobre la foto: morado = oferta/novedad (único uso del acento 2) */}
      <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1.5">
        {onSale && (
          <span className="rounded-full bg-badge/20 px-2 py-0.5 text-[11px] font-bold tabular-nums text-badge-2 ring-1 ring-badge/40 backdrop-blur-md">
            −{discountPct}%
          </span>
        )}
        {product.isPromo && !onSale && (
          <span className="rounded-full bg-badge/20 px-2 py-0.5 text-[11px] font-bold text-badge-2 ring-1 ring-badge/40 backdrop-blur-md">
            Oferta
          </span>
        )}
      </div>

      {image ? (
        <>
          <img
            src={image}
            alt={product.name}
<<<<<<< Updated upstream
            loading="lazy"
            onLoad={() => setLoaded(true)}
=======
            loading={index < 4 ? "eager" : "lazy"}
            fetchPriority={index < 4 ? "high" : "auto"}
            decoding="async"
>>>>>>> Stashed changes
            className={cn(
              "ease-expo h-full w-full object-contain p-6 transition duration-[600ms] will-change-transform",
              "group-hover:scale-[1.06]",
              hoverImage && !soldOut && "group-hover:opacity-0",
              soldOut && "opacity-40 grayscale"
            )}
            style={{ viewTransitionName: `vt-product-${product.id}` } as React.CSSProperties}
          />
          {/* Foto 2 revelada al hover (crossfade) */}
          {hoverImage && !soldOut && (
            <img
              src={hoverImage}
              alt=""
              aria-hidden
              loading="lazy"
              className="ease-expo pointer-events-none absolute inset-0 h-full w-full object-contain p-6 opacity-0 transition duration-[600ms] group-hover:scale-[1.06] group-hover:opacity-100"
            />
          )}
        </>
      ) : (
        <div className="grid h-full place-items-center text-muted">
          <ImageOff className="h-8 w-8" />
        </div>
      )}

      {soldOut && (
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-bg/80 px-3 py-1 text-[11px] font-semibold text-text backdrop-blur-md">
          Agotado
        </span>
      )}
    </Link>
  );

  const Eyebrow = category ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-light uppercase tracking-wider text-muted">
      <span aria-hidden>{category.icon}</span>
      <span className="truncate">{category.name}</span>
    </span>
  ) : null;

  const Name = (
    <Link
      to={`/producto/${product.id}`}
      prefetch="intent"
      viewTransition
      className={cn(
        "ease-expo line-clamp-2 font-bold leading-snug tracking-tight text-text transition-colors group-hover:text-accent-2",
        isList ? "text-lg" : "text-[0.95rem]",
      )}
    >
      {product.name}
    </Link>
  );

  const Pills = visiblePills.length > 0 && (
    <ul className="flex flex-wrap gap-1.5" aria-label="Variantes disponibles">
      {visiblePills.map((p) => (
        <li
          key={p}
          className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10.5px] font-light leading-4 text-muted"
        >
          {p}
        </li>
      ))}
      {extraPills > 0 && (
        <li className="rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[10.5px] font-medium leading-4 tabular-nums text-accent-2">
          +{extraPills}
        </li>
      )}
    </ul>
  );

  const Price = (
    <div className="flex items-baseline gap-2">
      <span
        className={cn(
          "font-heading font-extrabold tabular-nums leading-none text-accent",
          isList ? "text-2xl" : "text-lg",
        )}
      >
        {formatCordobas(product.price)}
      </span>
      {onSale && (
        <span className="text-xs font-light text-muted line-through">
          {formatCordobas(compareAt)}
        </span>
      )}
    </div>
  );

  const Cta = (
    <button
      type="button"
      onClick={handleCta}
      disabled={soldOut}
      aria-haspopup={needsPicker ? "dialog" : undefined}
      aria-label={soldOut ? "Producto agotado" : `Agregar ${product.name} al carrito`}
      className={cn(
        "ease-expo flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition duration-300 active:translate-y-px active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        soldOut
          ? "cursor-not-allowed bg-surface-2 text-muted"
          : "bg-accent text-bg hover:bg-accent-2 hover:shadow-accent-cta",
      )}
    >
      <ShoppingCart className="h-4 w-4" />
      {soldOut ? "Agotado" : "Agregar al carrito"}
    </button>
  );

  // Entrada escalonada al entrar al viewport + hover con elevación y escala.
  const motionProps = {
    initial: reduce ? false : ({ opacity: 0, y: 20 } as const),
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-40px" },
    transition: { duration: 0.5, delay: (index % 4) * 0.06, ease: [0.16, 1, 0.3, 1] as const },
    // Editorial: la tarjeta se ELEVA (no crece); el "zoom" queda solo para la foto.
    whileHover: reduce ? undefined : { y: -4, transition: { type: "spring" as const, stiffness: 260, damping: 24 } },
    // Tactile push: hundir levemente al tocar (feedback físico sin rebote).
    whileTap: reduce ? undefined : { scale: 0.985, y: 0 },
  };

  // Material premium: superficie con luz cenital + hairline superior encendido y
  // sombra profunda (card-premium). Al hover, el borde toma el acento y aparece un
  // glow cyan contenido → la tarjeta "se enciende" sin recurrir a neón permanente.
  const shell = cn(
    "card-premium ease-expo group relative h-full overflow-hidden rounded-2xl",
    "transition-[transform,border-color,box-shadow] duration-300 hover:border-accent/35 hover:shadow-accent-soft",
  );

  // Selector de variante (portal a <body>; se monta en el primer uso).
  const Sheet = sheetMounted ? (
    <QuickAddSheet product={product} open={sheetOpen} onClose={() => setSheetOpen(false)} />
  ) : null;

  // ── Tile HORIZONTAL editorial (bento: hero + ofertas, ocupa 2 columnas) ──
  if (isList) {
    return (
      <motion.article {...motionProps} className={cn(shell, "flex gap-4 p-3 sm:gap-6 sm:p-4")}>
        <div className="relative w-2/5 max-w-[220px] shrink-0 self-center">{Stage}</div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-1 pr-1">
          {Eyebrow}
          {Name}
          {product.description && (
            <p className="line-clamp-2 text-sm font-light leading-relaxed text-muted">
              {product.description}
            </p>
          )}
          {Pills}
          <div className="mt-2 flex flex-col gap-3">
            {Price}
            <div className="max-w-[240px]">{Cta}</div>
          </div>
        </div>
        {Sheet}
      </motion.article>
    );
  }

  // ── Tile VERTICAL (celda estándar del bento) ──
  return (
    <motion.article {...motionProps} className={cn(shell, "flex flex-col p-3")}>
      {Stage}
      <div className="flex flex-1 flex-col gap-1.5 px-0.5 pt-3">
        {Eyebrow}
        {Name}
        {Pills}
        <div className="mt-auto space-y-2.5 pt-2">
          {Price}
          {Cta}
        </div>
      </div>
      {Sheet}
    </motion.article>
  );
}
