import { useState } from "react";
import { Link } from "@remix-run/react";
import { motion, useReducedMotion } from "framer-motion";
import { ShoppingCart, ImageOff, Star } from "lucide-react";
import { toast } from "sonner";
import { QuickAddSheet } from "./QuickAddSheet";
import { Button } from "~/components/ui/Button";
import type { CatalogProduct, Category } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { formatCordobas, cn, getProductUrl } from "~/lib/utils";

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
  const hoverImage = product.images?.[1];
  const soldOut = (product.stock ?? 0) <= 0;
  const lowStock = !soldOut && (product.stock ?? 0) > 0 && (product.stock ?? 0) <= 5;
  const compareAt = product.compareAtPrice ?? 0;
  const onSale = compareAt > product.price;
  const discountPct = onSale ? Math.round((1 - product.price / compareAt) * 100) : 0;
  const savedAmount = onSale ? compareAt - product.price : 0;
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
      to={getProductUrl(product.id, product.name)}
      prefetch="intent"
      viewTransition
      aria-label={product.name}
      className={cn(
        "product-stage ease-expo relative block overflow-hidden rounded-xl bg-surface-2",
        isList ? "aspect-square h-full w-full shrink-0" : "aspect-square w-full",
      )}
    >
      <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1.5">
        {onSale && (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-bg">
            −{discountPct}%
          </span>
        )}
        {product.isPromo && !onSale && (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-bg">
            Oferta
          </span>
        )}
      </div>

      {lowStock && (
        <div className="absolute right-2 top-2 z-10">
          <span className="rounded-full bg-warning px-2.5 py-0.5 text-[11px] font-bold text-bg shadow-sm">
            ¡Últimas {product.stock}!
          </span>
        </div>
      )}

      {image ? (
        <img
          src={image}
          alt={product.name}
          loading={index < 4 ? "eager" : "lazy"}
          fetchPriority={index < 4 ? "high" : "auto"}
          decoding="async"
          className={cn(
            "ease-expo h-full w-full object-contain p-4 transition duration-[600ms] will-change-transform",
            "group-hover:scale-[1.06]",
            soldOut && "opacity-60 grayscale"
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

  const Eyebrow = category ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
      <span aria-hidden>{category.icon}</span>
      <span className="truncate">{category.name}</span>
    </span>
  ) : null;

  const Name = (
    <div>
      <Link
        to={getProductUrl(product.id, product.name)}
        prefetch="intent"
        viewTransition
        className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-text transition-colors group-hover:text-text"
      >
        {product.name}
      </Link>
      {/* Mock Social Proof */}
      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted">
        <div className="flex items-center text-accent">
          <Star className="h-3 w-3 fill-current" />
        </div>
        <span className="font-semibold text-text/90">4.9</span>
        <span className="opacity-70">(124)</span>
      </div>
    </div>
  );

  const Price = (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold tabular-nums leading-none text-accent">
          {formatCordobas(product.price)}
        </span>
        {onSale && (
          <span className="text-xs text-muted line-through">
            {formatCordobas(compareAt)}
          </span>
        )}
      </div>
    </div>
  );

  const Cta = (
    <Button
      variant="primary"
      onClick={handleCta}
      disabled={soldOut}
      aria-haspopup={needsPicker ? "dialog" : undefined}
      className="w-full h-11"
    >
      <ShoppingCart className="h-4 w-4" />
      {soldOut ? "Agotado" : "Agregar"}
    </Button>
  );

  const motionProps = {
    initial: reduce ? false : ({ opacity: 0, y: 20 } as const),
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-40px" },
    transition: { duration: 0.5, delay: (index % 4) * 0.06, ease: [0.16, 1, 0.3, 1] as const },
    whileHover: reduce ? undefined : { y: -2 },
  };

  const shell = cn(
    "ease-expo group relative overflow-hidden rounded-xl border border-border bg-surface transition-all duration-300",
    "hover:border-white/25 hover:shadow-[0_8px_32px_rgba(0,0,0,0.35)]",
  );

  const Sheet = sheetMounted ? (
    <QuickAddSheet product={product} open={sheetOpen} onClose={() => setSheetOpen(false)} />
  ) : null;

  if (isList) {
    return (
      <motion.article {...motionProps} className={cn(shell, "flex p-3 sm:gap-4 sm:p-4")}>
        <div className="relative w-[40%] max-w-[200px] shrink-0 self-center">{Stage}</div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-1 pl-4">
          {Eyebrow}
          {Name}
          {product.description && (
            <p className="line-clamp-2 text-xs font-medium leading-relaxed text-muted">
              {String(product.description).replace(/<[^>]*>?/gm, '')}
            </p>
          )}
          <div className="mt-3 flex flex-col gap-3">
            {Price}
            <div className="w-full max-w-[200px]">{Cta}</div>
          </div>
        </div>
        {Sheet}
      </motion.article>
    );
  }

  return (
    <motion.article {...motionProps} className={cn(shell, "flex flex-col p-4")}>
      {Stage}
      <div className="flex flex-1 flex-col gap-1.5 pt-4">
        {Eyebrow}
        {Name}
        <div className="mt-auto space-y-3 pt-3">
          {Price}
          {Cta}
        </div>
      </div>
      {Sheet}
    </motion.article>
  );
}
