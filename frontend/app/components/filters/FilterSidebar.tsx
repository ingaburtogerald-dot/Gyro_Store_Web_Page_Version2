// Sidebar de REFINAMIENTOS del storefront (solo escritorio ≥ lg): precio y toggles.
// El orden vive en la CatalogToolbar; las categorías en la barra de chips
// (CategoryChips). En móvil el flujo es el botón "Filtros" de la toolbar (FilterBar)
// + FilterSheet. Todos editan el
// MISMO estado (uiSlice), así que los filtros sobreviven al cambiar de viewport.
import { Tag, PackageCheck, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  setCategory,
  setPriceMin,
  setPriceMax,
  setOnlyOnSale,
  setOnlyInStock,
  resetFilters,
  selectActiveFilterCount,
} from "~/store/slices/uiSlice";
import { cn } from "~/lib/utils";

export function FilterSidebar() {
  const dispatch = useAppDispatch();
  const activeCategory = useAppSelector((s) => s.ui.activeCategory);
  const priceMin = useAppSelector((s) => s.ui.priceMin);
  const priceMax = useAppSelector((s) => s.ui.priceMax);
  const onlyOnSale = useAppSelector((s) => s.ui.onlyOnSale);
  const onlyInStock = useAppSelector((s) => s.ui.onlyInStock);
  const activeCount = useAppSelector(selectActiveFilterCount);

  const toNum = (v: string) => (v.trim() === "" ? null : Math.max(0, Number(v) || 0));
  const hasChanges = activeCount > 0 || activeCategory !== null;

  return (
    <aside
      aria-label="Refinar catálogo"
      className="sticky top-24 hidden max-h-[calc(100dvh-7rem)] w-64 shrink-0 flex-col gap-4 self-start overflow-y-auto pb-6 pr-1 lg:flex"
    >
      <div className="card-premium rounded-2xl p-4">
        {/* Encabezado: título + contador de filtros activos */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-heading text-sm font-bold text-text">
            <SlidersHorizontal className="h-4 w-4 text-accent-2" />
            Filtros
          </h2>
          {activeCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-bg">
              {activeCount}
            </span>
          )}
        </div>

        {/* Precio */}
        <div className="mb-5">
          <h3 className="mb-2 px-0.5 text-xs font-bold uppercase tracking-wider text-muted">
            Precio
          </h3>
          <div className="flex items-center gap-2">
            <PriceInput
              value={priceMin}
              onChange={(v) => dispatch(setPriceMin(v))}
              placeholder="Mín"
              label="Precio mínimo"
            />
            <span className="text-muted" aria-hidden>—</span>
            <PriceInput
              value={priceMax}
              onChange={(v) => dispatch(setPriceMax(v))}
              placeholder="Máx"
              label="Precio máximo"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-1 border-t border-border pt-3">
          <SwitchRow
            icon={<Tag className="h-4 w-4" />}
            label="Solo en oferta"
            checked={onlyOnSale}
            onChange={(v) => dispatch(setOnlyOnSale(v))}
          />
          <SwitchRow
            icon={<PackageCheck className="h-4 w-4" />}
            label="Solo disponibles"
            checked={onlyInStock}
            onChange={(v) => dispatch(setOnlyInStock(v))}
          />
        </div>
      </div>

      {hasChanges && (
        <button
          type="button"
          onClick={() => {
            dispatch(resetFilters());
            dispatch(setCategory(null));
          }}
          className="ease-expo inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-muted transition duration-300 hover:border-accent/40 hover:text-text"
        >
          <RotateCcw className="h-4 w-4" /> Limpiar filtros
        </button>
      )}
    </aside>
  );
}

/** Input de precio con prefijo "C$" y foco de acento. */
function PriceInput({
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
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
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
        className="h-10 w-full rounded-lg border border-border bg-surface-2 pl-8 pr-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
    </div>
  );
}

function SwitchRow({
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
      className="flex min-h-[44px] w-full items-center justify-between rounded-lg px-1 text-left transition-colors hover:bg-white/[0.03]"
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
