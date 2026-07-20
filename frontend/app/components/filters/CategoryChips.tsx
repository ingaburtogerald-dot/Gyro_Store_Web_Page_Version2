// Sub-navegación de categorías: fila de chips dentro de una BANDEJA ELEVADA
// (contenedor redondeado bg-surface-2 con borde y sombra) para que contraste con
// el fondo tanto en dark como en light. Los degradados de borde ahora se funden
// hacia `surface-2` (el color de la bandeja), no hacia `bg`.
//
// Las categorías con subcategorías abren un MEGA-MENÚ (estilo Master & Dynamic):
// un panel con las fotos de los productos publicados "más buscados" de esa gama +
// accesos rápidos por tipo + un "Ver todo". Renderizado por PORTAL con position:fixed
// para escapar del recorte por overflow y del backdrop-filter de la barra.
//
// Apertura ACCESIBLE EN TODOS LOS DISPOSITIVOS: en desktop abre al hacer hover sobre
// el chip; en móvil/táctil el chevron es un botón real que hace toggle con tap. Se
// cierra al tocar fuera o con Escape.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, ChevronDown, ArrowRight, ImageOff } from "lucide-react";
import { Link } from "@remix-run/react";
import type { Category } from "~/store/api/catalogApi";
import { useGetCatalogQuery } from "~/store/api/catalogApi";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { getProductUrl, formatCordobas, cn } from "~/lib/utils";
import { setCategory, openPublicSidebar } from "~/store/slices/uiSlice";

const PANEL_WIDTH = 600; // Ancho del mega-menú en desktop (se acota al viewport en móvil).
const TOP_LIMIT = 4; // Cuántos productos "top" mostrar en el preview.

type MenuPos = { left: number; top: number; width: number };

export function CategoryChips({ categories }: { categories: Category[] }) {
  const dispatch = useAppDispatch();
  const activeCategory = useAppSelector((s) => s.ui.activeCategory);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
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

  // Posiciona el panel bajo el chip, sin salirse del viewport (clamp horizontal).
  // El ancho se acota al viewport en móvil para que el mega-menú nunca desborde.
  function computePos(el: HTMLElement): MenuPos {
    const r = el.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    return { left, top: r.bottom, width };
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
      {/* BANDEJA ELEVADA: superficie propia (surface-2) + borde + sombra → contrasta
          contra `bg` en dark y en light sin depender del acento. */}
      <div className="relative flex items-center rounded-pill border border-border bg-surface-2/80 px-1.5 shadow-sm backdrop-blur-sm">
        {/* Degradados de borde: señalan scroll. Se funden hacia el color de la bandeja. */}
        <div
          className="pointer-events-none absolute inset-y-1 left-0 z-10 w-8 rounded-l-pill bg-gradient-to-r from-surface-2 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-1 right-0 z-10 w-8 rounded-r-pill bg-gradient-to-l from-surface-2 to-transparent"
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
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-3.5 py-1.5 text-sm font-medium outline-none transition-colors",
              "text-muted hover:bg-surface-hover hover:text-text focus-visible:ring-2 focus-visible:ring-accent",
            )}
          >
            <Menu className="h-4 w-4" />
            Todo
          </button>

          <span className="mx-1.5 h-4 w-px shrink-0 bg-border" aria-hidden />

          {categories.map((c) => {
            const active = activeCategory === c.id;
            const isOpen = openCat === c.id;
            const hasSub = Boolean(c.subcategories && c.subcategories.length > 0);

            return (
              <div
                key={c.id}
                data-cat-item
                className={cn(
                  "relative flex shrink-0 items-center rounded-pill transition-colors",
                  !active && "hover:bg-surface-hover/70",
                )}
                onMouseEnter={(e) => hasSub && openMenu(c.id, e.currentTarget)}
                onMouseLeave={hasSub ? closeMenu : undefined}
              >
                {/* Cápsula del filtro activo: una sola en todo el riel; Framer la
                    desliza de una categoría a otra por el layoutId compartido. */}
                {active && (
                  <motion.span
                    layoutId="activeFilter"
                    aria-hidden
                    className="absolute inset-0 rounded-pill bg-accent/15 ring-1 ring-accent/30"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <button
                  ref={active ? activeRef : null}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-haspopup={hasSub ? "menu" : undefined}
                  aria-expanded={hasSub ? isOpen : undefined}
                  onClick={(e) => {
                    // Con subcategorías: clic en el nombre ABRE el mega-menú (lo intuitivo).
                    // Sin subcategorías: filtra por esa categoría.
                    if (hasSub) {
                      const wrap = e.currentTarget.closest("[data-cat-item]") as HTMLElement;
                      toggleMenu(c.id, wrap ?? e.currentTarget);
                    } else {
                      dispatch(setCategory(c.id));
                    }
                  }}
                  className={cn(
                    "relative z-10 flex items-center gap-1.5 whitespace-nowrap rounded-pill py-1.5 pl-3.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                    hasSub ? "pr-1" : "pr-3.5",
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
                      "relative z-10 mr-0.5 grid h-7 w-7 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                      active ? "text-accent-2" : "text-muted hover:text-text",
                    )}
                  >
                    {/* Hit-area real de 44px en móvil sin agrandar el chip visual: el
                        botón sigue siendo h-7/w-7 (no afecta la altura de la fila —
                        esto es `absolute`, fuera de flujo), pero el tap responde en
                        toda esta zona ampliada. */}
                    <span className="absolute -inset-[8.5px] md:inset-0" aria-hidden />
                    <ChevronDown
                      className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")}
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mega-menú (portal a <body> → fixed real, sin recortes). Visible en TODOS
          los tamaños; en móvil el ancho se acota al viewport. */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {openCat && menuPos && openData?.subcategories?.length ? (
              <MegaMenu
                key={openData.id}
                category={openData}
                pos={menuPos}
                onKeep={keepMenu}
                onLeave={closeMenu}
                onClose={() => setOpenCat(null)}
                onSelectParent={() => {
                  dispatch(setCategory(openData.id));
                  setOpenCat(null);
                }}
              />
            ) : null}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

// ── Mega-menú de una categoría ──────────────────────────────────────────────
// Trae los productos publicados de la categoría (mismo endpoint del catálogo) y
// muestra hasta TOP_LIMIT como "más buscados" con su foto. Degrada con elegancia:
// mientras carga muestra skeletons; si no hay productos, muestra solo los tipos.
function MegaMenu({
  category,
  pos,
  onKeep,
  onLeave,
  onClose,
  onSelectParent,
}: {
  category: Category;
  pos: MenuPos;
  onKeep: () => void;
  onLeave: () => void;
  onClose: () => void;
  onSelectParent: () => void;
}) {
  const { data, isLoading } = useGetCatalogQuery({ category: category.id });
  const subcats = category.subcategories ?? [];
  // Prioriza promos y luego productos con stock para el preview.
  const top = [...(data ?? [])]
    .sort((a, b) => Number(Boolean(b.isPromo)) - Number(Boolean(a.isPromo)))
    .slice(0, TOP_LIMIT);

  return (
    <motion.div
      data-subcat-menu
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={{ position: "fixed", left: pos.left, top: pos.top + 8, width: pos.width }}
      className="z-[60] overflow-hidden rounded-card border border-border bg-surface card-premium shadow-premium"
      onMouseEnter={onKeep}
      onMouseLeave={onLeave}
      role="menu"
      aria-label={`Explorar ${category.name}`}
    >
      {/* Encabezado: categoría + "Ver todo" (filtra la gama completa). */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <span className="flex items-center gap-2 font-heading text-sm font-semibold text-text">
          {category.icon && <span aria-hidden>{category.icon}</span>}
          {category.name}
        </span>
        <button
          type="button"
          onClick={onSelectParent}
          className="group inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/10"
        >
          Ver todo
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      <div className="p-3">
        <p className="px-1 pb-2 text-xs font-semibold text-muted">Más buscados</p>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: TOP_LIMIT }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square rounded-xl bg-surface-hover" />
                <div className="mt-1.5 h-3 w-3/4 rounded bg-surface-hover" />
                <div className="mt-1 h-3 w-1/3 rounded bg-surface-hover" />
              </div>
            ))}
          </div>
        ) : top.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {top.map((p) => (
              <Link
                key={p.id}
                to={getProductUrl(p.id, p.name)}
                onClick={onClose}
                role="menuitem"
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface-2/60 transition-all hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="product-stage aspect-square overflow-hidden">
                  {p.images?.[0] ? (
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-muted">
                      <ImageOff className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <p className="truncate text-xs font-medium text-text">{p.name}</p>
                  <p className="text-xs font-semibold text-accent">{formatCordobas(p.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-1 py-3 text-sm text-muted">Aún no hay productos destacados en esta gama.</p>
        )}

        {subcats.length > 0 && (
          <>
            <p className="px-1 pb-2 pt-4 text-xs font-semibold text-muted">Explorar por tipo</p>
            <div className="flex flex-wrap gap-1.5">
              {subcats.map((sub) => (
                <Link
                  key={sub.id}
                  to={getProductUrl(sub.id, sub.name)}
                  onClick={onClose}
                  role="menuitem"
                  className="rounded-pill border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent/40 hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
