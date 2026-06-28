// Bottom Sheet de filtros avanzados (mobile-first): sube desde abajo de la pantalla.
// Filtros reales según el modelo de datos actual: orden, rango de precio, en oferta,
// disponibles. (No hay campo "marca" en CatalogProduct; se agregará cuando exista.)
// El filtrado vive en el uiSlice y lo aplica ProductGrid; aquí solo se edita el estado.
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ArrowDownUp, Tag, PackageCheck } from "lucide-react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  type CatalogSort,
  setSort,
  setPriceMin,
  setPriceMax,
  setOnlyOnSale,
  setOnlyInStock,
  resetFilters,
  closeFilterSheet,
} from "~/store/slices/uiSlice";
import { cn } from "~/lib/utils";

const SORTS: Array<{ value: CatalogSort; label: string }> = [
  { value: "relevant", label: "Relevancia" },
  { value: "price-asc", label: "Precio: menor a mayor" },
  { value: "price-desc", label: "Precio: mayor a menor" },
];

export function FilterSheet() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.filterSheetOpen);
  const sort = useAppSelector((s) => s.ui.sort);
  const priceMin = useAppSelector((s) => s.ui.priceMin);
  const priceMax = useAppSelector((s) => s.ui.priceMax);
  const onlyOnSale = useAppSelector((s) => s.ui.onlyOnSale);
  const onlyInStock = useAppSelector((s) => s.ui.onlyInStock);

  // Bloquea el scroll del fondo y cierra con Escape mientras el sheet está abierto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dispatch(closeFilterSheet());
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, dispatch]);

  // Convierte el input numérico a number|null (vacío = sin límite).
  const toNum = (v: string) => (v.trim() === "" ? null : Math.max(0, Number(v) || 0));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <button
            aria-label="Cerrar filtros"
            onClick={() => dispatch(closeFilterSheet())}
            className="absolute inset-0 bg-black/60"
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Filtros"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="relative w-full max-w-lg rounded-t-3xl border-t border-border bg-surface pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            {/* Asa de arrastre + título */}
            <div className="flex flex-col items-center pt-3">
              <span className="h-1.5 w-10 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <h2 className="font-heading text-lg font-bold">Filtros</h2>
              <button
                onClick={() => dispatch(closeFilterSheet())}
                aria-label="Cerrar"
                className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-6 overflow-y-auto px-5 py-2">
              {/* Orden */}
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted">
                  <ArrowDownUp className="h-4 w-4" /> Ordenar por
                </h3>
                <div className="flex flex-wrap gap-2">
                  {SORTS.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => dispatch(setSort(o.value))}
                      className={cn(
                        "rounded-pill border px-4 py-2 text-sm transition-colors",
                        sort === o.value
                          ? "border-transparent bg-gradient-accent text-white"
                          : "border-border bg-surface-2 text-muted hover:text-text",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Rango de precio */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-muted">Rango de precio (C$)</h3>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={priceMin ?? ""}
                    onChange={(e) => dispatch(setPriceMin(toNum(e.target.value)))}
                    placeholder="Mín"
                    aria-label="Precio mínimo"
                    className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  <span className="text-muted">—</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={priceMax ?? ""}
                    onChange={(e) => dispatch(setPriceMax(toNum(e.target.value)))}
                    placeholder="Máx"
                    aria-label="Precio máximo"
                    className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
              </section>

              {/* Toggles */}
              <section className="space-y-1">
                <ToggleRow
                  icon={<Tag className="h-4 w-4" />}
                  label="Solo en oferta"
                  checked={onlyOnSale}
                  onChange={(v) => dispatch(setOnlyOnSale(v))}
                />
                <ToggleRow
                  icon={<PackageCheck className="h-4 w-4" />}
                  label="Solo disponibles"
                  checked={onlyInStock}
                  onChange={(v) => dispatch(setOnlyInStock(v))}
                />
              </section>
            </div>

            {/* Acciones */}
            <div className="flex gap-3 border-t border-border px-5 pt-4">
              <button
                onClick={() => dispatch(resetFilters())}
                className="min-h-[48px] flex-1 rounded-xl border border-border text-sm font-semibold text-muted transition-colors hover:text-text"
              >
                Limpiar
              </button>
              <button
                onClick={() => dispatch(closeFilterSheet())}
                className="min-h-[48px] flex-[2] rounded-xl bg-gradient-accent text-sm font-semibold text-white active:scale-95"
              >
                Ver resultados
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-[48px] w-full items-center justify-between rounded-xl px-1 text-left"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-text">
        <span className="text-muted">{icon}</span>
        {label}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-gradient-accent" : "bg-surface-2",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
