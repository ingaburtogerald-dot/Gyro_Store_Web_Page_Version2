// Drawer lateral del carrito (slide-in desde la derecha). Lista ítems, permite
// ajustar cantidad/eliminar y abre el modal de checkout.
import { useState } from "react";
import { useNavigate } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Trash2, ImageOff, Pencil } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { CheckoutModal } from "./CheckoutModal";
import { EditCartItemSheet } from "./EditCartItemSheet";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  closeCart,
  removeItem,
  setQuantity,
  selectCartItems,
  selectCartOpen,
  selectCartTotal,
} from "~/store/slices/cartSlice";
import { formatCordobas } from "~/lib/utils";

function lineKey(i: { catalogId: string; variantName: string }) {
  return `${i.catalogId}::${i.variantName}`;
}

export function CartDrawer() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isOpen = useAppSelector(selectCartOpen);
  const items = useAppSelector(selectCartItems);
  const total = useAppSelector(selectCartTotal);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);

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
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
        )}
        {isOpen && (
          <motion.aside
            key="cart-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface"
              role="dialog"
              aria-label="Carrito de compras"
            >
              <header className="flex items-center justify-between border-b border-border p-4">
                <h2 className="text-lg font-bold">Tu carrito</h2>
                <button onClick={() => dispatch(closeCart())} aria-label="Cerrar">
                  <X className="h-5 w-5 text-muted hover:text-text" />
                </button>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
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
                            <div className="grid h-full place-items-center text-black/20">
                              <ImageOff className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col">
                          <p className="text-sm font-medium leading-tight">
                            {isCombo && <span className="mr-1 text-accent">🎁</span>}
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
                        <div className="flex flex-col gap-3 self-start">
                          {/* Editar variante no aplica a un combo (es una línea atómica). */}
                          {!isCombo && (
                            <button
                              onClick={() => setEditingItemKey(key)}
                              aria-label="Editar"
                              className="text-muted hover:text-text"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => dispatch(removeItem(key))}
                            aria-label="Eliminar"
                            className="text-muted hover:text-danger"
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
                <footer className="border-t border-border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-muted">Total</span>
                    <span className="font-heading text-xl font-bold">{formatCordobas(total)}</span>
                  </div>
                  <Button variant="whatsapp" className="w-full" onClick={() => setCheckoutOpen(true)}>
                    Finalizar pedido por WhatsApp
                  </Button>
                </footer>
              )}
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

function QtyBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="grid h-6 w-6 place-items-center rounded-md border border-border text-muted hover:text-text"
    >
      {children}
    </button>
  );
}
