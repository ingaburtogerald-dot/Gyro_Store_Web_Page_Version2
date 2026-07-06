// Tarjeta de producto del catálogo público — dirección "Obsidian Atelier".
//
// Principios de diseño:
//  - La FOTO es la estrella: escenario con foco radial (product-stage), imagen
//    grande con blur-up al cargar y parallax sutil (scale) al hover.
//  - Sin borde ni sombra permanente: la tarjeta flota y se ELEVA al hover.
//  - Precio y "Agregar" SIEMPRE visibles (mobile-first, cero dependencia del hover).
//  - "Agregar" = botón circular glass, hermano del Link (no navega); en desktop
//    se enciende a esmeralda al hover. Alto/área táctil >= 44px.
//  - Dos disposiciones que alimentan el bento de la grilla:
//      layout="grid" → vertical compacto (celda 1 columna).
//      layout="list" → horizontal editorial (tile ancho: hero + ofertas).
import { useState } from "react";
import { Link } from "@remix-run/react";
import { ShoppingBag, ImageOff } from "lucide-react";
import { toast } from "sonner";
import type { CatalogProduct, Category } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { formatCordobas, cn } from "~/lib/utils";

export function ProductCardMobile({
  product,
  categories,
  layout = "grid",
}: {
  product: CatalogProduct;
  categories: Category[];
  layout?: "grid" | "list";
}) {
  const dispatch = useAppDispatch();
  const [loaded, setLoaded] = useState(false);
  const category = categories.find((c) => c.id === product.category);
  const image = product.images?.[0];
  const soldOut = (product.stock ?? 0) <= 0;
  const compareAt = product.compareAtPrice ?? 0;
  const onSale = compareAt > product.price;
  const discountPct = onSale ? Math.round((1 - product.price / compareAt) * 100) : 0;
  const isList = layout === "list";

  // El botón es hermano del Link (no anidado): no hace falta interceptar la
  // navegación; detenemos la propagación por si se reusa en un contenedor clicable.
  function quickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (soldOut) return;
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

  // ── Escenario de la imagen (Link) ──
  const Stage = (
    <Link
      to={`/producto/${product.id}`}
      prefetch="intent"
      viewTransition
      aria-label={product.name}
      className={cn(
        "product-stage ease-expo relative block overflow-hidden rounded-[1.25rem]",
        isList ? "aspect-square h-full w-full" : "aspect-square w-full",
      )}
    >
      {/* Descuento: píldora glass discreta, no roja-gritona */}
      {onSale && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-bg/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-accent-2 ring-1 ring-white/10 backdrop-blur-md">
          −{discountPct}%
        </span>
      )}

      {image ? (
        <img
          src={image}
          alt={product.name}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={cn(
            "ease-expo h-full w-full object-contain p-6 transition duration-[600ms] will-change-transform",
            "group-hover:scale-[1.07]",
            soldOut && "opacity-40 grayscale",
            loaded ? "scale-100 blur-0 opacity-100" : "scale-105 blur-md opacity-0",
          )}
          style={{ viewTransitionName: `vt-product-${product.id}` } as React.CSSProperties}
        />
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

  // ── Botón circular "Agregar" (glass; se enciende al hover en desktop) ──
  const AddCircle = (
    <button
      type="button"
      onClick={quickAdd}
      disabled={soldOut}
      aria-label={soldOut ? "Producto agotado" : `Agregar ${product.name} al carrito`}
      className={cn(
        "ease-expo grid h-11 w-11 place-items-center rounded-full border backdrop-blur-md transition duration-300 active:scale-90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        soldOut
          ? "cursor-not-allowed border-border bg-surface-2 text-muted"
          : "border-white/10 bg-bg/70 text-text hover:scale-110 hover:border-accent hover:bg-accent hover:text-white hover:shadow-[0_10px_28px_-8px_rgba(16,185,129,0.55)]",
      )}
    >
      <ShoppingBag className="h-[18px] w-[18px]" />
    </button>
  );

  const Eyebrow = category ? (
    <span className="inline-flex items-center gap-1 text-[11px] tracking-wide text-muted">
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
        "ease-expo line-clamp-2 font-medium leading-snug text-text transition-colors group-hover:text-accent-2",
        isList ? "text-lg" : "text-[0.95rem]",
      )}
    >
      {product.name}
    </Link>
  );

  const Price = (
    <div className="flex items-baseline gap-2">
      <span
        className={cn(
          "font-heading font-semibold tabular-nums leading-none text-text",
          isList ? "text-2xl" : "text-lg",
        )}
      >
        {formatCordobas(product.price)}
      </span>
      {onSale && (
        <span className="text-xs text-muted line-through">{formatCordobas(compareAt)}</span>
      )}
    </div>
  );

  // ── Tile HORIZONTAL editorial (bento: hero + ofertas, ocupa 2 columnas) ──
  if (isList) {
    return (
      <article className="group ease-expo relative flex h-full gap-4 rounded-3xl p-2 transition duration-500 hover:-translate-y-1 sm:gap-6 sm:p-3">
        <div className="relative w-2/5 max-w-[220px] shrink-0">
          {Stage}
          <div className="absolute bottom-3 right-3">{AddCircle}</div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-2 pr-2">
          {Eyebrow}
          {Name}
          {product.description && (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted">{product.description}</p>
          )}
          <div className="mt-1">{Price}</div>
        </div>
      </article>
    );
  }

  // ── Tile VERTICAL (celda estándar del bento) ──
  return (
    <article className="group ease-expo relative flex h-full flex-col transition duration-500 hover:-translate-y-1">
      <div className="relative">
        {Stage}
        <div className="absolute bottom-3 right-3">{AddCircle}</div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-1 pt-3.5">
        {Eyebrow}
        {Name}
        <div className="mt-auto pt-1.5">{Price}</div>
      </div>
    </article>
  );
}
