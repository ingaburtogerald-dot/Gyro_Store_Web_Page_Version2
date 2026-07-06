// Botón flotante de filtros (mobile-first). Va abajo-izquierda para no chocar con
// el FAB del carrito (abajo-derecha). Abre el bottom sheet y muestra un badge con
// la cantidad de filtros activos. Se oculta en escritorio (lg), donde habrá filtros
// laterales en una fase posterior.
import { SlidersHorizontal } from "lucide-react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { openFilterSheet, selectActiveFilterCount } from "~/store/slices/uiSlice";

export function FilterFab() {
  const dispatch = useAppDispatch();
  const activeCount = useAppSelector(selectActiveFilterCount);

  return (
    <button
      onClick={() => dispatch(openFilterSheet())}
      aria-label="Abrir filtros"
      className="ease-expo fixed bottom-6 left-6 z-40 inline-flex h-14 items-center gap-2 rounded-full border border-white/10 bg-surface/80 px-5 text-sm font-semibold text-text shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 active:scale-90 lg:hidden"
    >
      <SlidersHorizontal className="h-5 w-5" />
      Filtros
      {activeCount > 0 && (
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-bold tabular-nums text-white">
          {activeCount}
        </span>
      )}
    </button>
  );
}
