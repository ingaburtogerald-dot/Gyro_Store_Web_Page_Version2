import { useState } from "react";
import { Link } from "@remix-run/react";
import { motion, useReducedMotion } from "framer-motion";
import { ShoppingCart, ImageOff, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { QuickAddSheet } from "./QuickAddSheet";
import { Button } from "~/components/ui/Button";
import { useGetConfigQuery, type CatalogProduct, type Category } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { formatCordobas, cn, getProductUrl, buildWhatsappUrl } from "~/lib/utils";

const MAX_PILLS = 3;

export function ProductCard({
  product,
  categories,
  layout = "grid",
  index = 0,
  showPills = true,
}: {
  product: CatalogProduct;
  categories: Category[];
  layout?: "grid" | "list";
  /** Posición en la grilla: escalona la entrada de las tarjetas visibles. */
  index?: number;
  /** Muestra los pills de variantes. Se apaga en las recomendaciones de la ficha
   *  (el usuario los veía "raros" ahí y pidió omitirlos para tarjetas más limpias). */
  showPills?: boolean;
}) {
  const dispatch = useAppDispatch();
  const { data: config } = useGetConfigQuery();
  const reduce = useReducedMotion();
  const category = categories.find((c) => c.id === product.category);
  const image = product.images?.[0];
  const soldOut = (product.stock ?? 0) <= 0;
  const lowStock = !soldOut && (product.stock ?? 0) > 0 && (product.stock ?? 0) <= 5;
  const compareAt = product.compareAtPrice ?? 0;
  const onSale = compareAt > product.price;
  const discountPct = onSale ? Math.round((1 - product.price / compareAt) * 100) : 0;
  const isList = layout === "list";

  // Pills de variantes: primero las opciones reales de la plantilla; si el
  // ítem no tiene plantilla, se muestran sus badges. (El color NO viene en la
  // card — se ve en la foto; ver DESIGN.md §7 y server/routes/catalog.js.)
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

  // "Pedir por WhatsApp": camino de compra directo, sin pasar por el carrito —
  // el mensaje trae nombre, precio y el link a la ficha. Si está agotado, el
  // mensaje pide que avisen cuando vuelva a haber stock (no se pierde el lead).
  function handleWhatsAppOrder(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = typeof window !== "undefined" ? window.location.origin + getProductUrl(product.id, product.name) : "";
    const message = soldOut
      ? `Hola, quiero que me avisen cuando vuelva a haber stock de: ${product.name}. ${url}`
      : `Hola, quiero: ${product.name} — ${formatCordobas(product.price)}. ${url}`;
    window.open(buildWhatsappUrl(config?.whatsapp ?? "50585944758", message), "_blank", "noopener,noreferrer");
  }

  // ── Escenario de la imagen (Link al detalle) ──
  // Grid: foto a tope del borde superior → rounded-t-xl. List: panel inset → rounded-xl.
  const Stage = (
    <Link
      to={getProductUrl(product.id, product.name)}
      prefetch="intent"
      viewTransition
      aria-label={product.name}
      className={cn(
        "product-stage ease-expo relative block overflow-hidden",
        isList ? "aspect-square h-full w-full shrink-0 rounded-xl" : "aspect-[4/3] w-full rounded-t-xl",
      )}
    >
      <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1.5">
        {onSale && (
          <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] sm:px-2.5 sm:text-[11px] font-bold tabular-nums text-bg">
            −{discountPct}%
          </span>
        )}
        {product.isPromo && !onSale && (
          <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] sm:px-2.5 sm:text-[11px] font-bold text-bg">
            Oferta
          </span>
        )}
      </div>

      {lowStock && (
        <div className="absolute right-2 top-2 z-10">
          <span className="rounded-md bg-warning px-2 py-0.5 text-[10px] sm:px-2.5 sm:text-[11px] font-bold text-bg shadow-sm">
            ¡Últimas {product.stock}!
          </span>
        </div>
      )}

      {image ? (
        <img
          src={image}
          alt={product.name}
          loading={index < 4 ? "eager" : "lazy"}
          decoding="async"
          className={cn(
            "ease-expo h-full w-full object-cover transition duration-[600ms] will-change-transform",
            "group-hover:scale-[1.06]",
            soldOut && "opacity-70 grayscale"
          )}
          style={{ viewTransitionName: `vt-product-${product.id}` } as React.CSSProperties}
        />
      ) : (
        <div className="grid h-full place-items-center text-muted">
          <ImageOff className="h-8 w-8" />
        </div>
      )}

      {soldOut && (
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-bg/80 px-2 py-1 text-[10px] sm:bottom-3 sm:px-3 sm:text-[11px] font-semibold text-text backdrop-blur-md">
          Agotado
        </span>
      )}
    </Link>
  );

  // Eyebrow editorial: categoría en label tracked (sin emoji; DESIGN.md §8).
  const Eyebrow = category ? (
    <span className="truncate text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
      {category.name}
    </span>
  ) : null;

  const Name = (
    <Link
      to={getProductUrl(product.id, product.name)}
      prefetch="intent"
      viewTransition
      className="line-clamp-2 min-h-[32px] text-[12px] font-bold leading-snug tracking-tight text-text transition-colors group-hover:text-accent-2 sm:text-sm sm:min-h-10"
    >
      {product.name}
    </Link>
  );

  // Variantes reales (pills de la plantilla). font-light por DESIGN.md §3.
  const Pills = visiblePills.length ? (
    <div className="flex flex-wrap items-center gap-1.5">
      {visiblePills.map((p) => (
        <span
          key={p}
          className="rounded-pill border border-white/10 px-2 py-0.5 text-[11px] font-light text-muted"
        >
          {p}
        </span>
      ))}
      {extraPills > 0 && (
        <span className="text-[11px] font-light text-muted">+{extraPills}</span>
      )}
    </div>
  ) : null;

  const Price = (
    <div className="flex items-baseline gap-2">
      <span className="text-[14px] font-extrabold tabular-nums leading-none text-accent sm:text-lg">
        {formatCordobas(product.price)}
      </span>
      {onSale && (
        <span className="text-[11px] sm:text-xs text-muted line-through tabular-nums">
          {formatCordobas(compareAt)}
        </span>
      )}
    </div>
  );

  const Cta = (
    <div className="flex items-center gap-2">
      <Button
        variant="primary"
        onClick={handleCta}
        disabled={soldOut}
        aria-haspopup={needsPicker ? "dialog" : undefined}
        className="h-9 text-xs sm:text-sm sm:h-11 flex-1"
      >
        <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        {soldOut ? "Agotado" : "Agregar"}
      </Button>
      {/* Secundario/ghost: nunca se deshabilita, ni agotado — "avísame" sigue
          siendo un lead que no queremos perder. */}
      <button
        type="button"
        onClick={handleWhatsAppOrder}
        aria-label={soldOut ? `Avísame cuando ${product.name} esté disponible, por WhatsApp` : `Pedir ${product.name} por WhatsApp`}
        title={soldOut ? "Avísame por WhatsApp" : "Pedir por WhatsApp"}
        className="grid h-9 w-9 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-lg border border-whatsapp/30 bg-whatsapp/10 text-whatsapp transition-colors hover:bg-whatsapp/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp/60"
      >
        <MessageCircle className="h-[15px] w-[15px] sm:h-[18px] sm:w-[18px]" />
      </button>
    </div>
  );

  const motionProps = {
    initial: reduce ? false : ({ opacity: 0, y: 20 } as const),
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-40px" },
    transition: { duration: 0.5, delay: (index % 4) * 0.06, ease: [0.16, 1, 0.3, 1] as const },
    // Se ELEVA en hover (no crece). El spring va anidado para que solo aplique al
    // hover (objeto táctil); la entrada sigue con ease-expo. DESIGN.md §5.
    whileHover: reduce ? undefined : { y: -4, transition: { type: "spring", stiffness: 260, damping: 24 } },
    whileTap: reduce ? undefined : { scale: 0.985, transition: { duration: 0.15 } },
  };

  // Sin sombra ni glow: la profundidad la carga el hairline que se aclara. DESIGN.md §6.
  const shell = "ease-expo group relative flex overflow-hidden rounded-xl border border-white/10 bg-surface transition-colors duration-300 hover:border-white/25";

  const Sheet = sheetMounted ? (
    <QuickAddSheet product={product} open={sheetOpen} onClose={() => setSheetOpen(false)} />
  ) : null;

  if (isList) {
    return (
      <motion.article {...motionProps} className={cn(shell, "p-3 sm:gap-4 sm:p-4")}>
        <div className="relative w-[40%] max-w-[200px] shrink-0 self-center">{Stage}</div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-1 pl-4">
          {Eyebrow}
          {Name}
          {product.description && (
            <p className="line-clamp-2 text-xs font-light leading-relaxed text-muted">
              {String(product.description).replace(/<[^>]*>?/gm, "")}
            </p>
          )}
          {showPills && Pills}
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
    <motion.article {...motionProps} className={cn(shell, "h-full flex-col")}>
      {Stage}
      <div className="flex flex-1 flex-col gap-1.5 p-2 md:p-4">
        {Eyebrow}
        {Name}
        {showPills && Pills}
        <div className="mt-auto space-y-3 pt-3">
          {Price}
          {Cta}
        </div>
      </div>
      {Sheet}
    </motion.article>
  );
}
