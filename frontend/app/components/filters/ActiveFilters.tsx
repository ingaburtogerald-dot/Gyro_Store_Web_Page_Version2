import { X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  setPriceMin,
  setPriceMax,
  setOnlyOnSale,
  setOnlyInStock,
  setCategory,
  resetFilters,
} from "~/store/slices/uiSlice";
import type { Category } from "~/store/api/catalogApi";

export function ActiveFilters({ categories }: { categories: Category[] }) {
  const dispatch = useAppDispatch();
  const { priceMin, priceMax, onlyOnSale, onlyInStock, activeCategory } = useAppSelector(
    (s) => s.ui
  );

  const activeFilters = [];

  if (activeCategory) {
    const cat = categories.find((c) => c.id === activeCategory);
    if (cat) {
      activeFilters.push({
        id: "category",
        label: `Categoría: ${cat.name}`,
        onRemove: () => dispatch(setCategory(null)),
      });
    }
  }

  if (priceMin !== null || priceMax !== null) {
    let label = "";
    if (priceMin !== null && priceMax !== null) {
      label = `C$${priceMin} - C$${priceMax}`;
    } else if (priceMin !== null) {
      label = `Más de C$${priceMin}`;
    } else if (priceMax !== null) {
      label = `Menos de C$${priceMax}`;
    }
    activeFilters.push({
      id: "price",
      label,
      onRemove: () => {
        dispatch(setPriceMin(null));
        dispatch(setPriceMax(null));
      },
    });
  }

  if (onlyOnSale) {
    activeFilters.push({
      id: "sale",
      label: "Ofertas",
      onRemove: () => dispatch(setOnlyOnSale(false)),
    });
  }

  if (onlyInStock) {
    activeFilters.push({
      id: "stock",
      label: "Disponibles",
      onRemove: () => dispatch(setOnlyInStock(false)),
    });
  }

  if (activeFilters.length === 0) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-text mr-2">Filtros activos:</span>
      {activeFilters.map((filter) => (
        <span
          key={filter.id}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 border border-border px-3 py-1 text-sm font-medium text-text"
        >
          {filter.label}
          <button
            type="button"
            onClick={filter.onRemove}
            className="ml-1 rounded-full p-0.5 hover:bg-surface-hover text-muted hover:text-text transition-colors"
            aria-label={`Quitar filtro ${filter.label}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => {
          dispatch(resetFilters());
          dispatch(setCategory(null));
        }}
        className="ml-2 text-sm font-semibold text-accent hover:text-accent-2 transition-colors"
      >
        Limpiar todo
      </button>
    </div>
  );
}
