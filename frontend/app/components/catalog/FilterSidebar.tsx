// Sidebar de REFINAMIENTOS del storefront (solo escritorio ≥ lg): orden, precio
// y toggles. Las categorías viven en la barra flotante de chips (CategoryChips),
// visible en todas las pantallas. En móvil el flujo sigue siendo FilterFab +
// FilterSheet; todos editan el MISMO estado (uiSlice), así que los filtros
// sobreviven al cambiar de viewport.
import { ArrowDownUp, Tag, PackageCheck, RotateCcw } from "lucide-react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  type CatalogSort,
  setCategory,
  setSort,
  setPriceMin,
  setPriceMax,
  setOnlyOnSale,
  setOnlyInStock,
  resetFilters,
  selectActiveFilterCount,
} from "~/store/slices/uiSlice";
import { cn } from "~/lib/utils";

const SORTS: Array<{ value: CatalogSort; label: string }> = [
  { value: "relevant", label: "Relevancia" },
  { value: "price-asc", label: "Precio: menor a mayor" },
  { value: "price-desc", label: "Precio: mayor a menor" },
];

export function FilterSidebar() {
  const dispatch = useAppDispatch();
  const activeCategory = useAppSelector((s) => s.ui.activeCategory);
  const sort = useAppSelector((s) => s.ui.sort);
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
      {/* Orden + precio + toggles */}
      <section className="space-y-5 rounded-2xl border border-border bg-white/[0.03] p-4 backdrop-blur-md">
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wider text-muted">
            <ArrowDownUp className="h-3.5 w-3.5" /> Ordenar por
          </h3>
          <div className="space-y-0.5">
            {SORTS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => dispatch(setSort(o.value))}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  sort === o.value
                    ? "bg-accent/12 font-semibold text-accent-2"
                    : "font-light text-muted hover:bg-surface-2 hover:text-text",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                    sort === o.value ? "bg-accent" : "bg-border",
                  )}
                  aria-hidden
                />
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">
            Precio (C$)
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={priceMin ?? ""}
              onChange={(e) => dispatch(setPriceMin(toNum(e.target.value)))}
              placeholder="Mín"
              aria-label="Precio mínimo"
              className="h-10 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <span className="text-muted" aria-hidden>—</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={priceMax ?? ""}
              onChange={(e) => dispatch(setPriceMax(toNum(e.target.value)))}
              placeholder="Máx"
              aria-label="Precio máximo"
              className="h-10 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
        </div>

        <div className="space-y-1">
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
      </section>

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
      className="flex min-h-[44px] w-full items-center justify-between rounded-lg px-1 text-left"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-text">
        <span className="text-muted">{icon}</span>
        {label}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-surface-2",
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
