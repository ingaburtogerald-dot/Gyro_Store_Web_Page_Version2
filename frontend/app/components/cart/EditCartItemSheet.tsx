import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { VariantPicker, type VariantSelection } from "~/components/product/VariantPicker";
import { useGetCatalogItemQuery } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { updateItem } from "~/store/slices/cartSlice";
import type { CartItem } from "~/types/cart";
import { formatCordobas, cn } from "~/lib/utils";

function lineKey(i: Pick<CartItem, "catalogId" | "variantName">) {
  return `${i.catalogId}::${i.variantName}`;
}

export function EditCartItemSheet({
  item,
  open,
  onClose,
}: {
  item: CartItem;
  open: boolean;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const [selection, setSelection] = useState<VariantSelection | null>(null);
  
  // Cargamos los datos reales del producto para obtener todas sus variantes
  const { data: detail, isFetching, isError } = useGetCatalogItemQuery(item.catalogId, {
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
  const price = variant?.price ?? item.price;

  // Miniatura: foto del color elegido si existe; si no, la que ya tenía el ítem.
  const thumb =
    (selection?.color && detail?.imagesByColor?.[selection.color]?.[0]) ||
    detail?.images?.[0] ||
    item.image ||
    "";

  function save() {
    if (!detail || !variant || !inStock) return;
    
    const oldKey = lineKey(item);
    
    dispatch(
      updateItem({
        oldKey,
        newItem: {
          catalogId: detail.id,
          variantId: variant.id,
          name: variant.name || item.name,
          variantName: variant.variantName || "Estándar",
          price,
          image: thumb,
          quantity: item.quantity, // Conservamos la cantidad que tenía
        },
      }),
    );
    onClose();
    toast.success("Variante actualizada");
  }

  // SSR check
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-sans"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <button
            aria-label="Cerrar editor de variante"
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Editar variante de ${item.name}`}
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface text-text shadow-2xl"
          >
            {/* Cabecera: miniatura + nombre + precio */}
            <div className="flex items-center gap-3 px-5 pb-2 pt-5">
              <div className="product-stage grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl">
                {thumb ? (
                  <img src={thumb} alt="" className="h-full w-full object-contain p-1.5" />
                ) : (
                  <ImageOff className="h-5 w-5 text-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-1 font-heading text-base font-bold">{item.name}</h2>
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
                  No se pudieron cargar las variantes.
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
            <div className="space-y-3 border-t border-border p-5">
              <button
                type="button"
                onClick={save}
                disabled={!variant || !inStock}
                className={cn(
                  "ease-expo flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition duration-300 active:scale-[0.97]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  variant && inStock
                    ? "bg-accent text-bg hover:bg-accent-hover"
                    : "cursor-not-allowed bg-surface-2 text-muted",
                )}
              >
                <Check className="h-5 w-5" />
                {!detail
                  ? "Cargando…"
                  : variant && inStock
                    ? "Actualizar variante"
                    : "Variante agotada"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
