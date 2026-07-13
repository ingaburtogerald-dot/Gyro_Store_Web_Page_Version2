import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, Package, AlertTriangle, Sparkles, Plus, Tag } from "lucide-react";
import { ProductAutocomplete } from "./ProductAutocomplete";
import { formatCordobas, cn } from "~/lib/utils";
import { useOrderCalculator } from "~/hooks/useOrderCalculator";

export interface OrderLine {
  uid: string;
  productId: string;
  quantity: number | "";
  salePrice: number | "";
  mode?: "M1" | "M2";
}

interface ProductDetails {
  id: string;
  code: string;
  name: string;
  price: number;
  stock: number;
  origin: "native" | "migrated" | string;
}

interface OrderLineItemsTableProps {
  lines: OrderLine[];
  products: ProductDetails[];
  wholesaleDiscounts?: { minQty: number; maxQty: number | null; discountPercent: number }[];
  onChange: (lines: OrderLine[]) => void;
  onAddLine?: () => void;
  isTicket?: boolean;
}

export function OrderLineItemsTable({
  lines,
  products,
  wholesaleDiscounts = [],
  onChange,
  onAddLine,
  isTicket = false,
}: OrderLineItemsTableProps) {
  // Productos ordenados por código para el selector
  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => String(a.code || "").localeCompare(String(b.code || ""), undefined, { numeric: true })),
    [products],
  );

  const { getSuggestedPrice } = useOrderCalculator(lines, wholesaleDiscounts);

  function update(i: number, patch: Partial<OrderLine>) {
    const newLines = [...lines];
    newLines[i] = { ...newLines[i], ...patch };
    onChange(newLines);
  }

  function remove(i: number) {
    onChange(lines.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {lines.map((line, i) => {
          const p = products.find((pr) => pr.id === line.productId);
          const lineSubtotal = (Number(line.quantity) || 0) * (Number(line.salePrice) || 0);
          const lineOverStock = !!p && typeof line.quantity === "number" && line.quantity > p.stock;
          
          return (
            <motion.div
              key={line.uid}
              layout
              initial={{ opacity: 0, y: 8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="space-y-3 rounded-xl border border-border bg-surface-2/50 p-3.5"
            >
              {/* Fila superior: número + código + producto + stock + eliminar */}
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-accent text-xs font-bold text-white">
                  {i + 1}
                </span>
                {p?.code && (
                  <span className="shrink-0 rounded-md bg-surface px-2 py-0.5 font-mono text-xs text-muted">{p.code}</span>
                )}
                <div className="min-w-0 flex-1">
                  <ProductAutocomplete
                    products={sortedProducts}
                    value={line.productId}
                    onChange={(val) => update(i, { productId: val })}
                  />
                </div>
                {p && (
                  <span
                    className={cn(
                      "hidden shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium sm:flex nums",
                      lineOverStock ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent-2",
                    )}
                  >
                    <Package className="h-3 w-3" /> {p.stock} en stock
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={lines.length === 1 && !isTicket}
                  className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-30"
                  aria-label="Quitar línea"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Fila inferior: cantidad + precio + subtotal */}
              <div className="flex flex-wrap gap-3 sm:flex-nowrap sm:items-start">
                <label className="block w-20 shrink-0 sm:w-24">
                  <span className="mb-1 block text-xs text-muted">Cantidad</span>
                  <input
                    type="number"
                    min={1}
                    max={p?.stock}
                    className="input"
                    placeholder="0"
                    value={line.quantity}
                    onChange={(e) => update(i, { quantity: e.target.value === "" ? "" : (parseInt(e.target.value, 10) || 0) })}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                  />
                </label>
                <label className="block min-w-0 flex-1">
                  <span className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    <span>Precio unitario (C$)</span>
                    {p && (() => {
                      const qty = Number(line.quantity) || 0;
                      const { suggestedPrice, discountPercent } = getSuggestedPrice(p.price, qty, p.origin === "migrated");

                      return (
                        <div className="flex items-center gap-2">
                          {discountPercent > 0 && (
                            <span className="rounded-pill bg-accent/15 px-1.5 py-0.5 font-semibold text-accent-2">
                              −{discountPercent}% mayoreo
                            </span>
                          )}
                          {!isTicket && (
                            <button
                              type="button"
                              onClick={() => update(i, { salePrice: Math.round(suggestedPrice) })}
                              className="flex items-center gap-1 rounded-pill bg-warning/15 px-2 py-0.5 font-semibold text-warning ring-1 ring-warning/30 transition-all hover:bg-warning hover:text-white active:scale-95 nums"
                              title="Aplicar el precio sugerido a esta línea"
                            >
                              <Sparkles className="h-3 w-3" /> Sugerido {formatCordobas(suggestedPrice)}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </span>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    placeholder="Precio..."
                    value={line.salePrice}
                    onChange={(e) => update(i, { salePrice: e.target.value === "" ? "" : (parseFloat(e.target.value) || 0) })}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                  />
                </label>
                <div className="w-full pt-1 text-right sm:w-auto sm:shrink-0 sm:pt-5">
                  <span className="block text-xs text-muted">Subtotal</span>
                  <span className="nums text-sm font-bold text-text">{formatCordobas(lineSubtotal)}</span>
                </div>
              </div>

              {p && typeof line.quantity === "number" && line.quantity > p.stock && (
                <p className="flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Solo hay {p.stock} uds disponibles.
                </p>
              )}

              {p?.origin === "migrated" && !isTicket && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
                  <span className="flex items-center gap-1 rounded-pill bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
                    <Tag className="h-3 w-3" /> Migrado
                  </span>
                  <span className="text-xs text-muted">
                    Cálculo <span className="font-semibold text-text">{line.mode ?? "M2"}</span> · comisión escalonada sobre la utilidad neta
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {onAddLine && (
        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onAddLine}
            className="inline-flex w-full justify-center items-center gap-1.5 rounded-lg border border-dashed border-accent-2/40 px-3 py-2 text-sm font-semibold text-accent-2 transition-colors hover:bg-accent-2/5 sm:w-auto"
          >
            <Plus className="h-4 w-4" /> Agregar producto
          </button>
        </div>
      )}
    </div>
  );
}
