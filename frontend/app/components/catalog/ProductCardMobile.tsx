// Tarjeta de producto MOBILE-FIRST del catálogo público.
//
// Reglas de diseño (Fase 1):
//  - Cero dependencia del hover: precio y botón "Agregar" SIEMPRE visibles.
//  - Zona táctil cómoda para el pulgar: el botón mide >= 44px de alto (min-h-[44px]).
//  - Imagen a ancho completo de la tarjeta, con esquinas redondeadas (rounded-2xl).
//  - Badges pequeños e integrados (descuento "-X%" + punto de stock) que no tapan la foto.
//  - Dos disposiciones:
//      layout="grid" → compacto, pensado para grid-cols-2 en móvil (por defecto).
//      layout="list" → imagen horizontal, 1 columna ancha para productos con más detalle.
//
// Mobile-first: las clases base son las del móvil; la adaptación a escritorio
// (columnas extra, tamaños mayores) se hará en una fase posterior desde la grilla.
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
  const category = categories.find((c) => c.id === product.category);
  const image = product.images?.[0];
  const soldOut = (product.stock ?? 0) <= 0;
  const compareAt = product.compareAtPrice ?? 0;
  const onSale = compareAt > product.price;
  const discountPct = onSale ? Math.round((1 - product.price / compareAt) * 100) : 0;

  // El botón es hermano del Link (no anidado), así que no hace falta interceptar
  // la navegación; aun así detenemos la propagación por si se reusa dentro de un
  // contenedor clicable en el futuro.
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

  // ── Sub-piezas reutilizadas por ambos layouts ──

  const Thumb = (
    <Link
      to={`/producto/${product.id}`}
      prefetch="intent"
      viewTransition
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-2xl bg-surface-2",
        layout === "grid" ? "aspect-square w-full p-3" : "aspect-square w-28 p-2.5",
      )}
    >
      {/* Badge de descuento: discreto, esquina superior, no tapa el centro de la foto */}
      {onSale && (
        <span className="absolute left-2 top-2 z-10 rounded-pill bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
          -{discountPct}%
        </span>
      )}

      {image ? (
        <img
          src={image}
          alt={product.name}
          loading="lazy"
          className={cn("h-full w-full object-contain", soldOut && "opacity-40")}
          style={{ viewTransitionName: `vt-product-${product.id}` } as React.CSSProperties}
        />
      ) : (
        <div className="grid h-full place-items-center text-muted">
          <ImageOff className="h-7 w-7" />
        </div>
      )}

      {soldOut && (
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-pill bg-black/70 px-2.5 py-0.5 text-[11px] font-semibold text-white">
          Agotado
        </span>
      )}
    </Link>
  );

  // Punto de estado integrado: verde = disponible, gris = agotado.
  const StockDot = (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
      <span className={cn("h-1.5 w-1.5 rounded-full", soldOut ? "bg-muted" : "bg-whatsapp")} />
      {soldOut ? "Sin stock" : "Disponible"}
    </span>
  );

  const PriceRow = (
    <div className="flex items-baseline gap-2">
      <span className="font-heading text-base font-bold leading-none">
        {formatCordobas(product.price)}
      </span>
      {onSale && (
        <span className="text-xs text-muted line-through">{formatCordobas(compareAt)}</span>
      )}
    </div>
  );

  // ── Layout LISTA: imagen horizontal + más detalle (1 columna ancha) ──
  if (layout === "list") {
    return (
      <article className="flex gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-2.5">
        {Thumb}
        <div className="flex min-w-0 flex-1 flex-col">
          {category && (
            <span className="truncate text-[11px] text-muted">
              {category.icon} {category.name}
            </span>
          )}
          <Link
            to={`/producto/${product.id}`}
            prefetch="intent"
            viewTransition
            className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug hover:text-accent-2"
          >
            {product.name}
          </Link>
          {product.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted">{product.description}</p>
          )}

          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <div className="flex flex-col gap-1">
              {PriceRow}
              {StockDot}
            </div>
            <button
              type="button"
              onClick={quickAdd}
              disabled={soldOut}
              aria-label={soldOut ? "Producto agotado" : `Agregar ${product.name} al carrito`}
              className={cn(
                "flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition active:scale-95",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                soldOut
                  ? "cursor-not-allowed bg-surface-2 text-muted"
                  : "bg-gradient-accent text-white",
              )}
            >
              <ShoppingBag className="h-4 w-4" />
              <span>{soldOut ? "Agotado" : "Agregar"}</span>
            </button>
          </div>
        </div>
      </article>
    );
  }

  // ── Layout GRID (por defecto): compacto para grid-cols-2 en móvil ──
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface p-2.5">
      {Thumb}

      <div className="flex flex-1 flex-col px-1 pt-2">
        {category && (
          <span className="truncate text-[11px] text-muted">
            {category.icon} {category.name}
          </span>
        )}
        <Link
          to={`/producto/${product.id}`}
          prefetch="intent"
          viewTransition
          className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug hover:text-accent-2"
        >
          {product.name}
        </Link>

        <div className="mt-2 flex items-center justify-between gap-1">
          {PriceRow}
          {StockDot}
        </div>

        {/* Botón siempre visible, ancho completo, alto táctil de 44px */}
        <button
          type="button"
          onClick={quickAdd}
          disabled={soldOut}
          aria-label={soldOut ? "Producto agotado" : `Agregar ${product.name} al carrito`}
          className={cn(
            "mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            soldOut
              ? "cursor-not-allowed bg-surface-2 text-muted"
              : "bg-gradient-accent text-white",
          )}
        >
          <ShoppingBag className="h-4 w-4" /> {soldOut ? "Agotado" : "Agregar"}
        </button>
      </div>
    </article>
  );
}
