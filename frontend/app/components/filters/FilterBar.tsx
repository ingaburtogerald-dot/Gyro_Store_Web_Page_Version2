// Barra de herramientas del catálogo (sticky, visible en TODAS las pantallas).
//
// Antes el ordenamiento vivía solo en el sidebar (≥lg) o enterrado en el bottom
// sheet móvil, así que en la mayoría de pantallas no había forma visible de ordenar.
// Esta barra resuelve eso: muestra el conteo de resultados a la izquierda y un
// dropdown de orden premium a la derecha, siempre a la vista. En móvil también
// expone el botón de "Filtros" (abre el sheet), unificando el control del catálogo.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpDown, Check, ChevronDown, SlidersHorizontal, Tag, PackageCheck } from "lucide-react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  type CatalogSort,
  setSort,
  openFilterSheet,
  selectActiveFilterCount,
  setPriceMin,
  setPriceMax,
  setOnlyOnSale,
  setOnlyInStock,
} from "~/store/slices/uiSlice";
import { useCatalogFilter } from "~/hooks/useCatalogFilter";
import type { CatalogProduct } from "~/store/api/catalogApi";
import { cn } from "~/lib/utils";

const SORTS: Array<{ value: CatalogSort; label: string; short: string }> = [
  { value: "relevant", label: "Relevancia", short: "Relevancia" },
  { value: "price-asc", label: "Precio: menor a mayor", short: "Precio ↑" },
  { value: "price-desc", label: "Precio: mayor a menor", short: "Precio ↓" },
];

export function FilterBar({ products }: { products: CatalogProduct[] }) {
  const dispatch = useAppDispatch();
  const sort = useAppSelector((s) => s.ui.sort);
  const activeFilters = useAppSelector(selectActiveFilterCount);
  const current = SORTS.find((s) => s.value === sort) ?? SORTS[0];
  const priceMin = useAppSelector((s) => s.ui.priceMin);
  const priceMax = useAppSelector((s) => s.ui.priceMax);
  const onlyOnSale = useAppSelector((s) => s.ui.onlyOnSale);
  const onlyInStock = useAppSelector((s) => s.ui.onlyInStock);
  const search = useAppSelector((s) => s.ui.search);
  
  // Mismo hook que ProductGrid → el conteo siempre coincide con lo que se ve.
  const { filtered } = useCatalogFilter(products);
  const count = filtered.length;

  // Sticky justo bajo el header (PublicHeader: h-17 + hairline = 69px, constante
  // en todos los breakpoints — ya no lleva una fila de categorías aparte en móvil,
  // esa entrada vive en el CategoriesDrawer). Un offset desalineado con la altura
  // real del header dejaba una franja "muerta" por la que las cards se colaban
  // detrás de la barra al hacer scroll — de ahí el bug de "tarjeta atravesada".
  // + env(safe-area-inset-top): el header ahora suma su propio padding-top de
  // safe-area (Dynamic Island) a su alto real; sin sumarlo acá se desalinean
  // en dispositivos con notch.
  return (
    <div className="-mx-4 mb-5 px-4">
      <div className="card-premium flex items-center justify-between gap-2 rounded-2xl px-2.5 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
        {/* Botón de filtros (solo móvil) - Izquierda en móvil. Emparejado en altura
            y estilo con "Ordenar"; la etiqueta va siempre visible (no ícono suelto)
            y el botón se tiñe de acento cuando hay filtros activos. */}
        <div className="flex shrink-0 lg:hidden">
          <button
            type="button"
            onClick={() => dispatch(openFilterSheet())}
            aria-label="Abrir filtros"
            className={cn(
              "ease-expo relative inline-flex items-center gap-1.5 rounded-xl border bg-surface-2/60 px-2.5 py-1.5 text-[12px] sm:gap-2 sm:px-3.5 sm:py-2.5 sm:text-sm font-semibold transition duration-300",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              activeFilters > 0
                ? "border-accent/50 text-accent-2"
                : "border-border text-text hover:border-accent/40",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Filtros</span>
            {activeFilters > 0 && (
              <span className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 sm:h-5 sm:min-w-5 place-items-center rounded-full bg-accent px-1 text-[9px] sm:text-[10px] font-bold tabular-nums text-bg ring-2 ring-surface shadow-md">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* Filtros integrados (solo en escritorio) - Izquierda en escritorio */}
        <div className="hidden lg:flex items-center gap-4 mr-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Búsqueda</span>
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => dispatch({ type: "ui/setSearch", payload: e.target.value })}
              className="w-[120px] rounded-lg bg-surface-2 border border-border px-2 py-1 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/40 transition-all duration-300 placeholder:text-muted"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Precio C$</span>
            <input
              type="number"
              placeholder="Mín"
              value={priceMin ?? ""}
              onChange={(e) => dispatch(setPriceMin(e.target.value ? Number(e.target.value) : null))}
              className="w-[72px] rounded-lg bg-surface-2 border border-border px-2 py-1 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/40 transition-all duration-300"
            />
            <span className="text-muted font-medium">—</span>
            <input
              type="number"
              placeholder="Máx"
              value={priceMax ?? ""}
              onChange={(e) => dispatch(setPriceMax(e.target.value ? Number(e.target.value) : null))}
              className="w-[72px] rounded-lg bg-surface-2 border border-border px-2 py-1 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/40 transition-all duration-300"
            />
          </div>
          <FilterChip
            active={onlyOnSale}
            onClick={() => dispatch(setOnlyOnSale(!onlyOnSale))}
            icon={<Tag className="h-4 w-4" />}
            label="Ofertas"
          />
          <FilterChip
            active={onlyInStock}
            onClick={() => dispatch(setOnlyInStock(!onlyInStock))}
            icon={<PackageCheck className="h-4 w-4" />}
            label="Disponible"
          />

          {/* Separador visual */}
          <div className="h-6 w-px bg-border mx-1"></div>

          {/* Ordenar: Relevancia */}
          <SortDropdown current={current} sort={sort} onSelect={(v) => dispatch(setSort(v))} />
        </div>

        {/* Grupo de la derecha: Conteo de resultados */}
        <div className="flex shrink-0 items-center ml-auto">
          {/* Mostramos el dropdown en móvil a la derecha si los filtros están ocultos */}
          <div className="lg:hidden mr-4">
             <SortDropdown current={current} sort={sort} onSelect={(v) => dispatch(setSort(v))} />
          </div>

          <p className="flex min-w-0 items-baseline gap-1 text-sm text-muted">
            <span className="font-heading text-[15px] font-bold tabular-nums text-text sm:text-lg">
              {count}
            </span>
            <span className="truncate hidden sm:inline">{count === 1 ? "producto" : "productos"}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// Chip de filtro binario (activo/inactivo). Estética editorial: un solo acento
// plano cuando está activo (sin gradiente), hairline + muted cuando no. El estado
// activo es inequívoco por color de fondo, no por un matiz sutil.
function FilterChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "ease-expo flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        active
          ? "border-transparent bg-accent text-bg"
          : "border-border bg-surface-2/60 text-muted hover:border-accent/40 hover:text-text",
      )}
    >
      {icon}
      {label}
    </motion.button>
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
        className="ease-expo inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-2/60 px-2.5 py-1.5 text-[12px] sm:gap-2 sm:px-3.5 sm:py-2.5 sm:text-sm font-semibold text-text transition duration-300 hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowUpDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-muted" />
        <span className="hidden text-muted sm:inline">Ordenar:</span>
        <span className="whitespace-nowrap text-text">{current.short}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted transition-transform duration-300", open && "rotate-180")}
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
