// Sub-navegación de categorías: fila de chips con scroll horizontal (todos los
// tamaños) y degradados en los bordes que indican que hay más. Las subcategorías
// abren en un dropdown renderizado por PORTAL con position:fixed, para escapar del
// recorte del contenedor con overflow y del backdrop-filter de la barra (un dropdown
// absolute dentro de overflow-auto se corta; ver skill impeccable → Interaction).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, ChevronDown } from "lucide-react";
import { Link } from "@remix-run/react";
import type { Category } from "~/store/api/catalogApi";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { setCategory, openPublicSidebar } from "~/store/slices/uiSlice";
import { cn } from "~/lib/utils";

export function CategoryChips({ categories }: { categories: Category[] }) {
  const dispatch = useAppDispatch();
  const activeCategory = useAppSelector((s) => s.ui.activeCategory);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  // Timeout para no cerrar el menú si el mouse cruza 1px de hueco chip↔dropdown.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Al cambiar de categoría, centra el chip activo (útil al scrollear la barra).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCategory]);

  function openMenu(id: string, el: HTMLElement) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const r = el.getBoundingClientRect();
    setMenuPos({ left: r.left, top: r.bottom });
    setHoveredCat(id);
  }
  function keepMenu() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }
  function closeMenu() {
    timeoutRef.current = setTimeout(() => setHoveredCat(null), 150);
  }

  const hoveredData = categories.find((c) => c.id === hoveredCat);

  return (
    <div className="relative w-full">
      {/* Degradados de borde: señalan scroll y evitan el corte abrupto. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-surface-2 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-surface-2 to-transparent"
        aria-hidden
      />

      <div
        className={cn(
          "flex w-full items-center gap-1 overflow-x-auto py-1.5",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
        role="tablist"
        aria-label="Categorías"
      >
        {/* Todo → abre el sidebar con el árbol completo de categorías. */}
        <button
          type="button"
          onClick={() => dispatch(openPublicSidebar())}
          className={cn(
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium outline-none transition-colors",
            "text-muted hover:bg-white/5 hover:text-text focus-visible:ring-2 focus-visible:ring-accent",
          )}
        >
          <Menu className="h-4 w-4" />
          Todo
        </button>

        <span className="mx-1 h-4 w-px shrink-0 bg-white/10" aria-hidden />

        {categories.map((c) => {
          const active = activeCategory === c.id;
          const isHovered = hoveredCat === c.id;
          const hasSub = Boolean(c.subcategories && c.subcategories.length > 0);

          return (
            <div
              key={c.id}
              className="shrink-0"
              onMouseEnter={(e) => hasSub && openMenu(c.id, e.currentTarget)}
              onMouseLeave={closeMenu}
            >
              <button
                ref={active ? activeRef : null}
                role="tab"
                aria-selected={active}
                onClick={() => dispatch(setCategory(c.id))}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                  active
                    ? "bg-accent/12 font-semibold text-accent-2"
                    : "font-medium text-muted hover:bg-white/5 hover:text-text",
                )}
              >
                {c.icon && (
                  <span aria-hidden className="text-[15px] leading-none">
                    {c.icon}
                  </span>
                )}
                {c.name}
                {hasSub && (
                  <ChevronDown
                    className={cn("h-3 w-3 opacity-60 transition-transform", isHovered && "rotate-180")}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Dropdown de subcategorías (portal a <body> → fixed real, sin recortes). */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {hoveredCat && menuPos && hoveredData?.subcategories?.length ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                style={{ position: "fixed", left: menuPos.left, top: menuPos.top + 4 }}
                className="z-[60] hidden w-60 overflow-hidden rounded-xl border border-white/10 bg-surface shadow-2xl md:block"
                onMouseEnter={keepMenu}
                onMouseLeave={closeMenu}
              >
                <ul className="p-1.5">
                  {hoveredData.subcategories.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        to={`/producto/${sub.id}`}
                        onClick={() => {
                          setHoveredCat(null);
                          closeMenu();
                        }}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-white/5 hover:text-text"
                      >
                        {sub.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
