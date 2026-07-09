// Sub-navegación de categorías: barra flotante de chips con scroll horizontal.
// Visible en todas las pantallas (en desktop reemplaza a las categorías del
// sidebar, que quedó solo con refinamientos). La barra "flota" con borde suave
// y sombra; la barra de scroll se oculta y los chips usan snap al deslizar.
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import type { Category } from "~/store/api/catalogApi";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { setCategory } from "~/store/slices/uiSlice";
import { cn } from "~/lib/utils";

// Las categorías llegan por props desde el loader SSR (sin parpadeo en el primer paint).
export function CategoryChips({ categories }: { categories: Category[] }) {
  const dispatch = useAppDispatch();
  const activeCategory = useAppSelector((s) => s.ui.activeCategory);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Al cambiar de categoría, centra el chip activo dentro del carril horizontal.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCategory]);

  // [id | null, etiqueta] de cada chip: "Todo" + las categorías del negocio.
  const chips: Array<[string | null, string]> = [
    [null, "Todo"],
    ...categories.map((c) => [c.id, `${c.icon} ${c.name}`] as [string, string]),
  ];

  return (
    <div
      className={cn(
        "flex w-full overflow-x-auto items-center py-1 gap-1",
        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
      role="tablist"
      aria-label="Categorías"
    >
      {chips.map(([id, label]) => {
        const active = activeCategory === id;
        return (
          <button
            key={id ?? "all"}
            ref={active ? activeRef : null}
            role="tab"
            aria-selected={active}
            onClick={() => dispatch(setCategory(id))}
            className={cn(
              "relative shrink-0 whitespace-nowrap px-3 py-1.5 text-sm font-medium transition-all duration-200 border border-transparent outline-none",
              "hover:border-border hover:rounded-sm focus-visible:border-accent",
              active ? "text-accent-2 font-bold" : "text-text hover:text-white",
            )}
          >
            {id === null ? (
              <span className="relative z-10 flex items-center gap-1.5">
                <Menu className="h-4 w-4" />
                {label}
              </span>
            ) : (
              <span className="relative z-10">{label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
