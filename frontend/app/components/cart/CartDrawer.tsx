// Drawer lateral del carrito (slide-in desde la derecha). Lista ítems, permite
// ajustar cantidad/eliminar y abre el modal de checkout.
import { useState } from "react";
import { useNavigate } from "@remix-run/react";
import { motion, AnimatePresence, useDragControls, useReducedMotion } from "framer-motion";
import { X, Minus, Plus, Trash2, ImageOff, Pencil, Gift } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { CheckoutModal } from "./CheckoutModal";
import { EditCartItemSheet } from "./EditCartItemSheet";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  closeCart,
  removeItem,
  setQuantity,
  selectCartItems,
  selectCartOpen,
  selectCartTotal,
  lineKey,
} from "~/store/slices/cartSlice";
import { formatCordobas } from "~/lib/utils";

export function CartDrawer() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isOpen = useAppSelector(selectCartOpen);
  const items = useAppSelector(selectCartItems);
  const total = useAppSelector(selectCartTotal);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);

  // Desktop conserva el panel lateral de siempre; en móvil se vuelve un bottom
  // sheet (al alcance del pulgar), arrastrable desde el asa para cerrar.
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const reduce = useReducedMotion();
  const dragControls = useDragControls();

  // "Seguir comprando": cierra el carrito y lleva directo a la grilla del catálogo.
  // El #catalogo lo resuelve la home (efecto al montar, si venís de otra página);
  // el scroll manual cubre el caso de ya estar en la home (no remonta).
  function keepShopping() {
    dispatch(closeCart());
    navigate("/#catalogo");
    setTimeout(
      () => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      120,
    );
  }

  const itemToEdit = editingItemKey ? items.find((i) => lineKey(i) === editingItemKey) : null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => dispatch(closeCart())}
            className="fixed inset-0 z-30 md:z-50 bg-black/60 backdrop-blur-sm"
          />
        )}
        {isOpen && (
          <motion.aside
            key="cart-panel"
            initial={isDesktop ? { x: "100%", y: 0 } : { x: 0, y: "-100%" }}
            animate={{ x: 0, y: 0 }}
            exit={isDesktop ? { x: "100%", y: 0 } : { x: 0, y: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag={isDesktop ? false : "y"}
            dragConstraints={{ top: -1000, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, info) => {
              if (!isDesktop && (info.velocity.y < -300 || info.offset.y < -100)) {
                dispatch(closeCart());
              }
            }}
            // Desktop: Panel lateral de toda la altura.
            // Móvil: Top sheet (85vh), arrastrable hacia arriba, z-30 para quedar tras el header (z-40).
            className="fixed z-30 md:z-50 flex flex-col bg-surface shadow-2xl md:inset-y-0 md:right-0 md:h-[100dvh] md:w-full md:max-w-md md:border-l md:border-border max-md:inset-x-0 max-md:top-0 max-md:h-[85dvh] max-md:w-full max-md:rounded-b-3xl max-md:border-b max-md:border-border max-md:pt-[calc(env(safe-area-inset-top)+69px)]"
            role="dialog"
            aria-label="Carrito de compras"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-border p-4">
              <h2 className="text-lg font-bold">Tu carrito</h2>
              <button
                onClick={() => dispatch(closeCart())}
                aria-label="Cerrar"
                className="grid h-11 w-11 place-items-center text-muted hover:text-text md:h-8 md:w-8"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

              <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
                {items.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted">Tu carrito está vacío.</p>
                ) : (
                  <>
                  {items.map((item) => {
                    const key = lineKey(item);
                    const isCombo = Boolean(item.comboId);
                    return (
                      <div key={key} className="flex gap-3 rounded-xl border border-border bg-bg p-3">
                        <div className="product-stage h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                          {item.image ? (
                            <img src={item.image} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full place-items-center text-muted">
                              <ImageOff className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col">
                          <p className="flex items-center gap-1 text-sm font-medium leading-tight">
                            {isCombo && <Gift className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />}
                            {item.name}
                          </p>
                          {isCombo ? (
                            <p className="text-xs text-muted">
                              {item.comboProducts?.map((p) => p.name).join(" + ")}
                            </p>
                          ) : (
                            item.variantName !== "Estándar" && (
                              <p className="text-xs text-muted">{item.variantName}</p>
                            )
                          )}
                          <div className="mt-auto flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <QtyBtn onClick={() => dispatch(setQuantity({ key, quantity: item.quantity - 1 }))}>
                                <Minus className="h-3 w-3" />
                              </QtyBtn>
                              <span className="w-5 text-center text-sm">{item.quantity}</span>
                              <QtyBtn onClick={() => dispatch(setQuantity({ key, quantity: item.quantity + 1 }))}>
                                <Plus className="h-3 w-3" />
                              </QtyBtn>
                            </div>
                            <span className="text-sm font-semibold">
                              {formatCordobas(item.price * item.quantity)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col self-start">
                          {/* Editar variante no aplica a un combo (es una línea atómica).
                              h-11/w-11 = hit-area real de 44px en móvil (el ícono visual
                              sigue chico); desde md vuelve al tamaño compacto original. */}
                          {!isCombo && (
                            <button
                              onClick={() => setEditingItemKey(key)}
                              aria-label="Editar"
                              className="grid h-11 w-11 shrink-0 place-items-center text-muted hover:text-text active:scale-95 md:h-8 md:w-8"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => dispatch(removeItem(key))}
                            aria-label="Eliminar"
                            className="grid h-11 w-11 shrink-0 place-items-center text-muted hover:text-danger active:scale-95 md:h-8 md:w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Invitación a seguir sumando productos antes de finalizar. */}
                  <button
                    type="button"
                    onClick={keepShopping}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-bg/40 py-3 text-sm font-medium text-muted transition-colors hover:border-accent/40 hover:text-text"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar otro producto
                  </button>
                  </>
                )}
              </div>

              {items.length > 0 && (
                <footer className="shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-muted">Total</span>
                    <span className="font-heading text-xl font-bold">{formatCordobas(total)}</span>
                  </div>
                  <Button variant="whatsapp" className="w-full" onClick={() => setCheckoutOpen(true)}>
                    Finalizar pedido por WhatsApp
                  </Button>
                </footer>
              )}

              {/* Asa de arrastre en móvil (al fondo) */}
              <div className="flex w-full justify-center pb-3 pt-2 md:hidden" aria-hidden>
                <div className="h-1.5 w-12 rounded-full bg-border/80" />
              </div>
            </motion.aside>
        )}
      </AnimatePresence>

      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
      
      {itemToEdit && (
        <EditCartItemSheet 
          item={itemToEdit} 
          open={!!editingItemKey} 
          onClose={() => setEditingItemKey(null)} 
        />
      )}
    </>
  );
}

// h-11/w-11 = hit-area real de 44px en móvil (el borde visible sigue del mismo
// tamaño que antes gracias al ícono chico centrado); desde md vuelve a compacto.
function QtyBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-md border border-border text-muted transition-colors hover:text-text active:scale-95 md:h-6 md:w-6"
    >
      {children}
    </button>
  );
}
