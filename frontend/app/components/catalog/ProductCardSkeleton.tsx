// Skeleton loader de la tarjeta de producto (mobile-first).
// Replica la estructura EXACTA de ProductCardMobile (layout "grid") para que, al
// cargar en conexiones lentas, la pantalla no salte: mismos contornos, misma
// imagen cuadrada con rounded-2xl, mismas líneas de texto y el bloque del botón.
// animate-pulse da el efecto de "respiración" mientras llegan los datos.
export function ProductCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col overflow-hidden rounded-2xl border border-border bg-surface p-2.5">
      {/* Imagen */}
      <div className="aspect-square w-full rounded-2xl bg-surface-2" />

      <div className="flex flex-1 flex-col px-1 pt-2">
        {/* Categoría */}
        <div className="h-3 w-1/2 rounded bg-surface-2" />
        {/* Nombre (2 líneas) */}
        <div className="mt-2 h-4 w-full rounded bg-surface-2" />
        <div className="mt-1.5 h-4 w-2/3 rounded bg-surface-2" />
        {/* Precio + punto de stock */}
        <div className="mt-2 flex items-center justify-between">
          <div className="h-5 w-1/3 rounded bg-surface-2" />
          <div className="h-3 w-1/4 rounded bg-surface-2" />
        </div>
        {/* Botón "Agregar" (mismo alto táctil de 44px) */}
        <div className="mt-2.5 h-[44px] w-full rounded-xl bg-surface-2" />
      </div>
    </div>
  );
}
