// Selector rápido de variante para el quick-add de la card (bottom sheet).
// Se abre solo cuando el producto tiene >1 combinación (variantCount de la lista);
// carga el detalle on-demand con RTK Query (cacheado entre aperturas) y reusa el
// VariantPicker del detalle, que trabaja con stock REAL por combinación.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@remix-run/react";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingCart, X, ImageOff, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { VariantPicker, type VariantSelection } from "~/components/product/VariantPicker";
import { useGetCatalogItemQuery, type CatalogProduct } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { formatCordobas, cn, getProductUrl } from "~/lib/utils";

export function QuickAddSheet({
  product,
  open,
  onClose,
}: {
  product: CatalogProduct;
  open: boolean;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const [selection, setSelection] = useState<VariantSelection | null>(null);
  const { data: detail, isFetching, isError } = useGetCatalogItemQuery(product.id, {
    skip: !open,
  });

  // Bloquea el scroll del fondo y cierra con Escape mientras el sheet está abierto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const variant = selection?.variant ?? null;
  const inStock = selection?.inStock ?? false;
  const price = variant?.price ?? product.price;

  // Miniatura: foto del color elegido si existe; si no, la general.
  const thumb =
    (selection?.color && detail?.imagesByColor?.[selection.color]?.[0]) ||
    detail?.images?.[0] ||
    product.images?.[0] ||
    "";

  function add() {
    if (!detail || !variant || !inStock) return;
    dispatch(
      addItem({
        catalogId: detail.id,
        variantId: variant.id,
        name: variant.name || product.name,
        variantName: variant.variantName || "Estándar",
        price,
        image: thumb,
        quantity: 1,
      }),
    );
    onClose();
    dispatch(openCart());
    toast.success("Agregado al carrito");
  }

  // SSR: el sheet solo existe tras una interacción, pero el guard evita que
  // createPortal corra en el servidor si el componente quedara montado.
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center font-sans"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <button
            aria-label="Cerrar selector de variante"
            onClick={onClose}
            className="absolute inset-0 bg-black/60"
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Elegir variante de ${product.name}`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-full max-w-lg rounded-t-3xl border-t border-border bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] text-text"
          >
            {/* Asa de arrastre */}
            <div className="flex flex-col items-center pt-3">
              <span className="h-1.5 w-10 rounded-full bg-border" />
            </div>

            {/* Cabecera: miniatura + nombre + precio de la variante elegida */}
            <div className="flex items-center gap-3 px-5 pb-2 pt-3">
              <div className="product-stage grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl">
                {thumb ? (
                  <img src={thumb} alt="" className="h-full w-full object-contain p-1.5" />
                ) : (
                  <ImageOff className="h-5 w-5 text-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-1 font-heading text-base font-bold">{product.name}</h2>
                <p className="font-heading text-lg font-extrabold tabular-nums leading-tight text-accent">
                  {formatCordobas(price)}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-5 pb-3">
              {isFetching && !detail ? (
                // Skeleton con la silueta del picker (dos ejes de ejemplo)
                <div className="mt-5 space-y-5" aria-hidden>
                  {[0, 1].map((i) => (
                    <div key={i}>
                      <div className="skeleton mb-2.5 h-4 w-24 rounded" />
                      <div className="flex gap-2.5">
                        <div className="skeleton h-11 w-24 rounded-xl" />
                        <div className="skeleton h-11 w-24 rounded-xl" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : isError || (detail && detail.variants.length === 0) ? (
                <p className="py-6 text-center text-sm text-muted">
                  No se pudieron cargar las variantes. Probá desde la página del producto.
                </p>
              ) : detail ? (
                <VariantPicker
                  variants={detail.variants}
                  axisLabels={detail.axisLabels}
                  onChange={setSelection}
                />
              ) : null}
            </div>

            {/* Acciones */}
            <div className="space-y-3 border-t border-border px-5 pt-4">
              <button
                type="button"
                onClick={add}
                disabled={!variant || !inStock}
                className={cn(
                  "ease-expo flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition duration-300 active:scale-[0.97]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  variant && inStock
                    ? "bg-accent text-bg hover:bg-accent-hover"
                    : "cursor-not-allowed bg-surface-2 text-muted",
                )}
              >
                <ShoppingCart className="h-4 w-4" />
                {!detail
                  ? "Cargando…"
                  : variant && inStock
                    ? "Agregar al carrito"
                    : "Variante agotada"}
              </button>
              <Link
                to={getProductUrl(product.id, product.name)}
                prefetch="intent"
                viewTransition
                onClick={onClose}
                className="flex min-h-[40px] items-center justify-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-accent-2"
              >
                Ver detalles completos <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
