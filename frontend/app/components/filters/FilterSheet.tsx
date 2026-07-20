// Bottom Sheet de filtros avanzados (mobile-first): sube desde abajo de la pantalla.
// Filtros reales según el modelo de datos actual: orden, rango de precio, en oferta,
// disponibles. (No hay campo "marca" en CatalogProduct; se agregará cuando exista.)
// El filtrado vive en el uiSlice y lo aplica ProductGrid; aquí solo se edita el estado.
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Tag, PackageCheck } from "lucide-react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  setPriceMin,
  setPriceMax,
  setOnlyOnSale,
  setOnlyInStock,
  resetFilters,
  closeFilterSheet,
} from "~/store/slices/uiSlice";
import { cn } from "~/lib/utils";

export function FilterSheet() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.filterSheetOpen);
  const priceMin = useAppSelector((s) => s.ui.priceMin);
  const priceMax = useAppSelector((s) => s.ui.priceMax);
  const onlyOnSale = useAppSelector((s) => s.ui.onlyOnSale);
  const onlyInStock = useAppSelector((s) => s.ui.onlyInStock);
  const search = useAppSelector((s) => s.ui.search);

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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="filter-sheet"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <button
            aria-label="Cerrar filtros"
            onClick={() => dispatch(closeFilterSheet())}
            className="absolute inset-0 w-full h-full bg-black/60 cursor-default"
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Filtros"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-lg rounded-2xl border border-border shadow-2xl bg-surface pb-4"
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-5">
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
              {/* Búsqueda */}
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                  Búsqueda
                </h3>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => dispatch({ type: "ui/setSearch", payload: e.target.value })}
                  placeholder="Buscar productos..."
                  className="w-full rounded-xl border border-border bg-surface-2/50 px-4 py-2.5 text-sm font-medium text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </section>

              {/* Rango de precio */}
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                  Rango de precio
                </h3>
                <div className="flex items-center gap-3">
                  <PriceField
                    value={priceMin}
                    onChange={(v) => dispatch(setPriceMin(v))}
                    placeholder="Mín"
                    label="Precio mínimo"
                  />
                  <span className="text-muted" aria-hidden>—</span>
                  <PriceField
                    value={priceMax}
                    onChange={(v) => dispatch(setPriceMax(v))}
                    placeholder="Máx"
                    label="Precio máximo"
                  />
                </div>
              </section>

              {/* Toggles */}
              <section className="space-y-1 border-t border-border pt-4">
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
            <div className="flex gap-3 border-t border-border px-5 pt-4 pb-12">
              <button
                onClick={() => {
                  dispatch(resetFilters());
                  dispatch({ type: "ui/setSearch", payload: "" });
                }}
                className="min-h-[48px] flex-1 rounded-xl border border-border text-sm font-semibold text-muted transition-colors hover:text-text"
              >
                Limpiar
              </button>
              <button
                onClick={() => dispatch(closeFilterSheet())}
                className="ease-expo min-h-[48px] flex-[2] rounded-xl bg-accent text-sm font-bold text-bg transition duration-300 hover:bg-accent-2 active:scale-95"
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

/** Input de precio con prefijo "C$" (móvil: altura táctil 48px). */
function PriceField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder: string;
  label: string;
}) {
  const toNum = (v: string) => (v.trim() === "" ? null : Math.max(0, Number(v) || 0));
  return (
    <div className="relative flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">
        C$
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value ?? ""}
        onChange={(e) => onChange(toNum(e.target.value))}
        placeholder={placeholder}
        aria-label={label}
        className="h-12 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 text-base text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
    </div>
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
        <span className={cn("transition-colors", checked ? "text-accent-2" : "text-muted")}>
          {icon}
        </span>
        {label}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-surface-2 ring-1 ring-inset ring-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
