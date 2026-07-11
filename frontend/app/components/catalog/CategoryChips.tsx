// Sub-navegación de categorías: fila de chips con scroll horizontal (todos los
// tamaños) y degradados en los bordes que indican que hay más. Las subcategorías
// abren en un dropdown renderizado por PORTAL con position:fixed, para escapar del
// recorte del contenedor con overflow y del backdrop-filter de la barra (un dropdown
// absolute dentro de overflow-auto se corta; ver skill impeccable → Interaction).
//
// Apertura ACCESIBLE EN TODOS LOS DISPOSITIVOS: en desktop el dropdown abre al hacer
// hover sobre el chip; en móvil/táctil (donde no hay hover) el chevron es un botón
// real que hace toggle con tap. Se cierra al tocar fuera o con Escape.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, ChevronDown } from "lucide-react";
import { Link } from "@remix-run/react";
import type { Category } from "~/store/api/catalogApi";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { getProductUrl } from "~/lib/utils";
import { setCategory, openPublicSidebar } from "~/store/slices/uiSlice";
import { cn } from "~/lib/utils";

const MENU_WIDTH = 240; // w-60

export function CategoryChips({ categories }: { categories: Category[] }) {
  const dispatch = useAppDispatch();
  const activeCategory = useAppSelector((s) => s.ui.activeCategory);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  // Timeout para no cerrar el menú si el mouse cruza 1px de hueco chip↔dropdown.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Al cambiar de categoría, centra el chip activo (útil al scrollear la barra).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCategory]);

  // Cierre por clic fuera / Escape (necesario para el modo tap en móvil, donde no
  // hay mouseleave). Ignora clics dentro del propio dropdown o sobre su disparador.
  useEffect(() => {
    if (!openCat) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-subcat-menu]") || t?.closest("[data-subcat-trigger]")) return;
      setOpenCat(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenCat(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openCat]);

  // Posiciona el dropdown bajo el chip, sin salirse del viewport (clamp horizontal).
  function computePos(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left), window.innerWidth - MENU_WIDTH - 8);
    return { left, top: r.bottom };
  }
  function openMenu(id: string, el: HTMLElement) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMenuPos(computePos(el));
    setOpenCat(id);
  }
  function toggleMenu(id: string, el: HTMLElement) {
    if (openCat === id) {
      setOpenCat(null);
      return;
    }
    openMenu(id, el);
  }
  function keepMenu() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }
  function closeMenu() {
    timeoutRef.current = setTimeout(() => setOpenCat(null), 150);
  }

  const openData = categories.find((c) => c.id === openCat);

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
            "text-muted hover:bg-surface-hover hover:text-text focus-visible:ring-2 focus-visible:ring-accent",
          )}
        >
          <Menu className="h-4 w-4" />
          Todo
        </button>

        <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden />

        {categories.map((c) => {
          const active = activeCategory === c.id;
          const isOpen = openCat === c.id;
          const hasSub = Boolean(c.subcategories && c.subcategories.length > 0);

          return (
            <div
              key={c.id}
              data-cat-item
              className={cn(
                "flex shrink-0 items-center rounded-lg transition-colors",
                active ? "bg-accent/12" : "hover:bg-surface-hover",
              )}
              onMouseEnter={(e) => hasSub && openMenu(c.id, e.currentTarget)}
              onMouseLeave={hasSub ? closeMenu : undefined}
            >
              <button
                ref={active ? activeRef : null}
                type="button"
                role="tab"
                aria-selected={active}
                aria-haspopup={hasSub ? "menu" : undefined}
                aria-expanded={hasSub ? isOpen : undefined}
                onClick={(e) => {
                  // Con subcategorías: clic en el nombre ABRE el submenú (lo intuitivo).
                  // Sin subcategorías: filtra por esa categoría.
                  if (hasSub) {
                    const wrap = e.currentTarget.closest("[data-cat-item]") as HTMLElement;
                    toggleMenu(c.id, wrap ?? e.currentTarget);
                  } else {
                    dispatch(setCategory(c.id));
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-lg py-1.5 pl-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                  hasSub ? "pr-1" : "pr-3",
                  active ? "font-semibold text-accent-2" : "font-medium text-muted hover:text-text",
                )}
              >
                {c.icon && (
                  <span aria-hidden className="text-[15px] leading-none">
                    {c.icon}
                  </span>
                )}
                {c.name}
              </button>

              {/* Chevron = disparador real de subcategorías (tap en móvil / hover en
                  desktop). Botón separado para no anidar <button> dentro de <button>. */}
              {hasSub && (
                <button
                  type="button"
                  data-subcat-trigger
                  aria-label={`Ver subcategorías de ${c.name}`}
                  aria-expanded={isOpen}
                  onClick={(e) => {
                    const wrap = e.currentTarget.closest("[data-cat-item]") as HTMLElement;
                    toggleMenu(c.id, wrap ?? e.currentTarget);
                  }}
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                    active ? "text-accent-2" : "text-muted hover:text-text",
                  )}
                >
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")}
                  />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Dropdown de subcategorías (portal a <body> → fixed real, sin recortes).
          Visible en TODOS los tamaños (antes era hidden md:block → roto en móvil). */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {openCat && menuPos && openData?.subcategories?.length ? (
              <motion.div
                data-subcat-menu
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                style={{ position: "fixed", left: menuPos.left, top: menuPos.top + 4, width: MENU_WIDTH }}
                className="z-[60] overflow-hidden rounded-xl border border-border card-premium shadow-2xl"
                onMouseEnter={keepMenu}
                onMouseLeave={closeMenu}
              >
                <ul className="p-1.5">
                  {/* Filtrar por la categoría padre (el clic en el chip ahora abre el menú). */}
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        dispatch(setCategory(openData.id));
                        setOpenCat(null);
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-text transition-colors hover:bg-surface-hover"
                    >
                      Ver todos
                    </button>
                  </li>
                  <li aria-hidden className="my-1 h-px bg-border" />
                  {openData.subcategories.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        to={getProductUrl(sub.id, sub.name)}
                        onClick={() => setOpenCat(null)}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-hover hover:text-text"
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
