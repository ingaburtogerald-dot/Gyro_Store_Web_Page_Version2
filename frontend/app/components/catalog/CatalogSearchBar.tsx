// Barra de búsqueda del catálogo público (mobile-first).
// Sticky bajo el header para quedar siempre al alcance del pulgar al hacer scroll.
// Escribe en ui.search (debounce no hace falta: el filtrado es en cliente y barato).
import { Search, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { setSearch } from "~/store/slices/uiSlice";

export function CatalogSearchBar() {
  const dispatch = useAppDispatch();
  const search = useAppSelector((s) => s.ui.search);

  return (
    <div className="sticky top-[64px] z-30 -mx-4 bg-bg/80 px-4 py-3 backdrop-blur-lg">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          inputMode="search"
          value={search}
          onChange={(e) => dispatch(setSearch(e.target.value))}
          placeholder="Buscar productos…"
          aria-label="Buscar productos"
          className="h-12 w-full rounded-2xl border border-border bg-surface pl-11 pr-11 text-base text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        {search && (
          <button
            type="button"
            onClick={() => dispatch(setSearch(""))}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
