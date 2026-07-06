// Chips de categorías con scroll horizontal (mobile-first).
// Extraído de la ruta _index para reutilizarlo y mantener la vista limpia.
// La barra de scroll se oculta; los chips usan snap para "engancharse" al deslizar.
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
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
    <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {chips.map(([id, label]) => {
        const active = activeCategory === id;
        return (
          <button
            key={id ?? "all"}
            ref={active ? activeRef : null}
            onClick={() => dispatch(setCategory(id))}
            className={cn(
              "relative shrink-0 snap-start whitespace-nowrap rounded-pill px-4 py-2 text-sm transition-colors duration-300",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
              active ? "text-bg" : "text-muted hover:text-text",
            )}
          >
            {/* Píldora invertida que se desliza entre categorías (editorial, alto contraste) */}
            {active && (
              <motion.span
                layoutId="category-pill"
                className="absolute inset-0 rounded-pill bg-text"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
