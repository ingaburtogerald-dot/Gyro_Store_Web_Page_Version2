// Barra de herramientas del catálogo (sticky, visible en TODAS las pantallas).
//
// Antes el ordenamiento vivía solo en el sidebar (≥lg) o enterrado en el bottom
// sheet móvil, así que en la mayoría de pantallas no había forma visible de ordenar.
// Esta barra resuelve eso: muestra el conteo de resultados a la izquierda y un
// dropdown de orden premium a la derecha, siempre a la vista. En móvil también
// expone el botón de "Filtros" (abre el sheet), unificando el control del catálogo.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpDown, Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  type CatalogSort,
  setSort,
  openFilterSheet,
  selectActiveFilterCount,
} from "~/store/slices/uiSlice";
import { useCatalogFilter } from "~/lib/useCatalogFilter";
import type { CatalogProduct } from "~/store/api/catalogApi";
import { cn } from "~/lib/utils";

const SORTS: Array<{ value: CatalogSort; label: string; short: string }> = [
  { value: "relevant", label: "Relevancia", short: "Relevancia" },
  { value: "price-asc", label: "Precio: menor a mayor", short: "Precio ↑" },
  { value: "price-desc", label: "Precio: mayor a menor", short: "Precio ↓" },
];

export function CatalogToolbar({ products }: { products: CatalogProduct[] }) {
  const dispatch = useAppDispatch();
  const sort = useAppSelector((s) => s.ui.sort);
  const activeFilters = useAppSelector(selectActiveFilterCount);
  const current = SORTS.find((s) => s.value === sort) ?? SORTS[0];
  // Mismo hook que ProductGrid → el conteo siempre coincide con lo que se ve.
  const { filtered } = useCatalogFilter(products);
  const count = filtered.length;

  return (
    <div className="sticky top-24 z-20 -mx-4 mb-5 px-4">
      <div className="card-premium flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5 sm:gap-3 sm:px-4">
        {/* Conteo de resultados */}
        <p className="flex min-w-0 items-baseline gap-1.5 text-sm text-muted">
          <span className="font-heading text-base font-bold tabular-nums text-text sm:text-lg">
            {count}
          </span>
          <span className="truncate">{count === 1 ? "producto" : "productos"}</span>
        </p>

        <div className="flex shrink-0 items-center gap-2">
          {/* Botón de filtros (solo móvil; en ≥lg está el sidebar). */}
          <button
            type="button"
            onClick={() => dispatch(openFilterSheet())}
            className="ease-expo relative inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-sm font-semibold text-text transition duration-300 hover:border-accent/40 lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filtros</span>
            {activeFilters > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-bold tabular-nums text-bg">
                {activeFilters}
              </span>
            )}
          </button>

          <SortDropdown current={current} sort={sort} onSelect={(v) => dispatch(setSort(v))} />
        </div>
      </div>
    </div>
  );
}

function SortDropdown({
  current,
  sort,
  onSelect,
}: {
  current: (typeof SORTS)[number];
  sort: CatalogSort;
  onSelect: (v: CatalogSort) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cierra al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="ease-expo inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-sm font-semibold text-text transition duration-300 hover:border-accent/40"
      >
        <ArrowUpDown className="h-4 w-4 shrink-0 text-muted" />
        <span className="hidden text-muted sm:inline">Ordenar:</span>
        <span className="whitespace-nowrap text-text">{current.short}</span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted transition-transform duration-300", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="card-premium absolute right-0 z-30 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl p-1.5"
          >
            {SORTS.map((o) => {
              const active = o.value === sort;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onSelect(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                      active
                        ? "bg-accent/12 font-semibold text-accent-2"
                        : "font-medium text-muted hover:bg-surface-2 hover:text-text",
                    )}
                  >
                    {o.label}
                    {active && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
