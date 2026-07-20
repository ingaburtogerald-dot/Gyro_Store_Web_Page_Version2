// Header full-width del storefront (estilo Apple / Razer): el header toma todo el
// protagonismo en la parte superior. Estructura en 3 zonas:
//   · Logo (izquierda) → estático + GIF al hover/click, siempre lleva al inicio.
//   · Navegación (centro) → links de categorías.
//   · Iconos (derecha) → Search · Cart · Login.
// La búsqueda es DESPLEGABLE: por defecto solo se ve la lupa; al pulsarla, los
// links de categoría se desvanecen (Framer Motion) y la barra de búsqueda se
// expande ocupando ese espacio, mostrando un panel de recomendaciones.
//
// NOTA: `CartButton` se mantiene exportado aquí porque AppShell lo importa.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@remix-run/react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { ShoppingBag, Search, User, X, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Plus, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "~/components/ui/Logo";
import { IconButton } from "~/components/ui/IconButton";
import { SearchBar } from "~/components/filters/SearchBar";
import { CartDrawer } from "~/components/cart/CartDrawer";
import { CategoriesDrawer } from "./CategoriesDrawer";
import { UserMenu } from "./UserMenu";
import { useAuth } from "~/hooks/useAuth";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { hydrate, openCart, selectCartCount } from "~/store/slices/cartSlice";
import { setSearch, setCategory } from "~/store/slices/uiSlice";
import { selectIsAdmin, selectEditMode } from "~/store/slices/authSlice";
import {
  useGetCatalogQuery,
  useGetLandingConfigQuery,
  useUpdateLandingConfigMutation,
  useGetConfigQuery,
  useGetPopularSearchQuery,
} from "~/store/api/catalogApi";
import { buildCategoryTree } from "~/lib/categories";
import { cn, getProductUrl, formatCordobas } from "~/lib/utils";
import type { Category } from "~/types/catalog";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Botón del carrito con contador y micro-interacciones. Al agregar un producto
 *  la bolsa "rebota" y emite un anillo (ping); en hover/tap responde con un
 *  pequeño scale. Comparte fuente de verdad con el resto de la app (cartSlice).
 *  `variant="bar"` lo adapta a la barra inferior móvil (icono + etiqueta). */
export function CartButton({ variant }: { variant?: "bar" }) {
  const dispatch = useAppDispatch();
  const count = useAppSelector(selectCartCount);
  const controls = useAnimationControls();
  const [ping, setPing] = useState(false);
  const prev = useRef(count);

  useEffect(() => {
    if (count > prev.current) {
      // Rebote de la bolsa + anillo que se expande y desvanece.
      controls.start({
        scale: [1, 1.18, 0.94, 1],
        rotate: [0, -8, 6, 0],
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
      });
      setPing(true);
      const t = setTimeout(() => setPing(false), 650);
      return () => clearTimeout(t);
    }
    prev.current = count;
  }, [count, controls]);

  const label = count > 0 ? `Abrir carrito, ${count} artículo${count === 1 ? "" : "s"}` : "Abrir carrito";

  if (variant === "bar") {
    return (
      <button
        onClick={() => dispatch(openCart())}
        aria-label={label}
        className="relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] sm:text-[11px] font-medium text-muted transition-colors hover:text-accent-2"
      >
        <span className="relative">
          <motion.span animate={controls} className="block">
            <ShoppingBag className="h-5 w-5" />
          </motion.span>
          {ping && (
            <motion.span
              aria-hidden
              initial={{ scale: 0.6, opacity: 0.6 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute inset-0 rounded-full ring-2 ring-accent"
            />
          )}
          {count > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-pill bg-accent px-0.5 text-[9px] sm:text-[10px] sm:h-4 sm:min-w-4 sm:px-1 font-bold tabular-nums text-bg ring-2 ring-surface">
              {count}
            </span>
          )}
        </span>
        Carrito
      </button>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      onClick={() => dispatch(openCart())}
      aria-label={label}
      className="relative grid h-9 w-9 sm:h-11 sm:w-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <motion.span animate={controls} className="block">
        <ShoppingBag className="h-[18px] w-[18px] sm:h-[22px] sm:w-[22px]" />
      </motion.span>
      {/* Anillo "ping" al agregar */}
      <AnimatePresence>
        {ping && (
          <motion.span
            aria-hidden
            initial={{ scale: 0.6, opacity: 0.7 }}
            animate={{ scale: 1.8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 rounded-full ring-2 ring-accent"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 20 }}
            className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-pill bg-accent px-1 text-[10px] sm:text-[11px] sm:h-5 sm:min-w-5 font-bold tabular-nums text-bg ring-2 ring-bg"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function PublicHeader({ bottomBar }: { bottomBar?: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const search = useAppSelector((s) => s.ui.search);

  // Búsqueda desplegable: por defecto oculta (solo la lupa).
  const [searchOpen, setSearchOpen] = useState(false);

  // Drawer de categorías (solo móvil): el mega-menú de abajo es hidden md:flex,
  // así que en <md esta es la única forma de navegar categorías desde el header.
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // Mega-menú (Apple/Razer): categoría cuyo panel de contenido está desplegado.
  const [openCat, setOpenCat] = useState<string | null>(null);
  const closeTimer = useRef<number>();

  // Modo edición inline (solo admin). El header es global (AppShell), así que lee
  // el estado de Redux por su cuenta.
  const isAdmin = useAppSelector(selectIsAdmin);
  const editMode = useAppSelector(selectEditMode);
  const editing = isAdmin && editMode;

  // Categorías del catálogo (fuente única compartida con el rail). `allCategories`
  // = las que tienen productos en inventario (candidatas para el header).
  const { data: products = [] } = useGetCatalogQuery();
  const { data: config } = useGetConfigQuery();
  const allCategories = useMemo(() => buildCategoryTree(products, config?.categories || []), [products, config?.categories]);

  // Panel de recomendaciones del buscador: términos + productos reales (telemetría
  // cacheada 1h en el servidor). Los productos destacados cruzan esos ids contra el
  // catálogo que este header ya tiene en caché (sin pedir nada aparte).
  const { data: popularSearch } = useGetPopularSearchQuery();
  const popularKeywords = popularSearch?.terms ?? [];
  const featuredProducts = useMemo(() => {
    if (!popularSearch?.productIds?.length || !products.length) return [];
    const byId = new Map(products.map((p) => [p.id, p]));
    return popularSearch.productIds
      .map((id) => byId.get(id))
      .filter((p): p is (typeof products)[number] => Boolean(p))
      .slice(0, 4)
      .map((p) => ({ id: p.id, name: p.name, price: p.price, image: p.images?.[0] }));
  }, [popularSearch, products]);

  // Orden/visibilidad elegidos por el admin (doc landing_page). Vacío = mostrar
  // todas en su orden natural (compatibilidad con el comportamiento anterior).
  const { data: landing } = useGetLandingConfigQuery();
  const [updateLanding, { isLoading: savingHeader }] = useUpdateLandingConfigMutation();
  const headerOrder = landing?.headerCategories ?? [];

  // Categorías visibles en el header, en el orden configurado. Se filtran ids que
  // ya no existen en inventario (categoría que se quedó sin productos).
  const categories = useMemo<Category[]>(() => {
    if (!headerOrder.length) return allCategories;
    const byId = new Map(allCategories.map((c) => [c.id, c]));
    return headerOrder.map((id) => byId.get(id)).filter(Boolean) as Category[];
  }, [headerOrder, allCategories]);

  // Categorías con productos que NO están en el header (candidatas del botón "+").
  const availableToAdd = useMemo<Category[]>(() => {
    const shown = new Set(categories.map((c) => c.id));
    return allCategories.filter((c) => !shown.has(c.id));
  }, [categories, allCategories]);

  // Menú desplegable del botón "+" (agregar etiqueta).
  const [addOpen, setAddOpen] = useState(false);

  // Persiste un nuevo orden del header sin tocar los slides del Hero. Materializa el
  // orden actual visible cuando el doc aún estaba vacío (default = todas).
  async function saveHeaderOrder(ids: string[]) {
    try {
      await updateLanding({
        headerCategories: ids,
        heroSlides: landing?.heroSlides ?? [],
      }).unwrap();
    } catch (e) {
      const msg = (e as { data?: { error?: string } })?.data?.error;
      toast.error(msg || "No se pudo guardar el orden del header.");
    }
  }

  const currentIds = categories.map((c) => c.id);

  function moveCategory(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= currentIds.length) return;
    const next = [...currentIds];
    [next[idx], next[target]] = [next[target], next[idx]];
    saveHeaderOrder(next);
  }

  function removeCategory(id: string) {
    saveHeaderOrder(currentIds.filter((x) => x !== id));
  }

  function addCategory(id: string) {
    saveHeaderOrder([...currentIds, id]);
    setAddOpen(false);
  }

  function handleAddClick() {
    if (availableToAdd.length === 0) {
      toast.info("No hay más etiquetas disponibles.");
      return;
    }
    setAddOpen((v) => !v);
  }

  // Productos de cada categoría, para el contenido del mega-menú.
  const productsByCat = useMemo(() => {
    const map: Record<string, typeof products> = {};
    for (const c of categories) {
      map[c.id] = products.filter((p) => p.category === c.id || p.category === c.name);
    }
    return map;
  }, [categories, products]);

  const activeCat = openCat ? categories.find((c) => c.id === openCat) : null;
  const activeList = openCat ? productsByCat[openCat] ?? [] : [];

  // El carrito vive en el header: hidratamos desde localStorage al montar.
  useEffect(() => {
    dispatch(hydrate());
  }, [dispatch]);

  // Escape cierra la búsqueda y el mega-menú.
  useEffect(() => {
    if (!searchOpen && !openCat) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setOpenCat(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, openCat]);

  // ── Intención de hover del mega-menú: abrir al instante, cerrar con un pequeño
  //    retardo para poder cruzar el hueco entre el botón y el panel sin que parpadee.
  function openMenu(id: string) {
    window.clearTimeout(closeTimer.current);
    setOpenCat(id);
  }
  function scheduleCloseMenu() {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenCat(null), 140);
  }
  function cancelCloseMenu() {
    window.clearTimeout(closeTimer.current);
  }
  function toggleMenu(id: string) {
    window.clearTimeout(closeTimer.current);
    setOpenCat((cur) => (cur === id ? null : id));
  }

  function goCategory(id: string) {
    dispatch(setCategory(id));
    setOpenCat(null);
    navigate("/");
  }

  function openSearch() {
    setOpenCat(null);
    setSearchOpen((v) => !v);
  }

  function closeSearch() {
    setSearchOpen(false);
  }

  // Enter (o elegir una sugerencia) ejecuta la búsqueda Y cierra el overlay. Antes
  // solo navegaba a "/" y el panel quedaba abierto, obligando al usuario a tocar la
  // X para cerrarlo (bug reportado en móvil). Cerrar aquí también baja el teclado.
  function submitSearch() {
    setSearchOpen(false);
    setOpenCat(null);
    navigate("/");
  }

  return (
    <>
      {/* pt-[env(safe-area-inset-top)]: con viewport-fit=cover el contenido puede ir
          borde a borde; sin este padding el header queda bajo la Dynamic Island. */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-bg/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 sm:h-17 w-full max-w-[1600px] items-center gap-3 sm:gap-4 px-3 sm:px-4 md:px-8">
          {/* ── Logo (izquierda) — imagen ancha (80×40) que ya es la marca completa ── */}
          <Logo asLink size={50} className="shrink-0" />

          {/* ── Zona central: navegación ⇄ búsqueda ──
              Ambas capas se superponen en posición absoluta y hacen cross-fade a la
              vez (sin mode="wait"), para que el swap sea fiable y sin salto de layout. */}
          <div className="relative flex h-11 flex-1 items-center justify-center">
            <AnimatePresence initial={false}>
              {searchOpen ? (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="absolute inset-x-0 mx-auto hidden w-full max-w-3xl md:block"
                >
                  <SearchBar
                    value={search}
                    onChange={(v) => dispatch(setSearch(v))}
                    onClear={() => dispatch(setSearch(""))}
                    onSubmit={submitSearch}
                    variant="pill"
                    withPanel
                    autoFocus
                    size="md"
                    popularKeywords={popularKeywords}
                    featuredProducts={featuredProducts}
                  />
                </motion.div>
              ) : (
                <motion.nav
                  key="nav"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  aria-label="Categorías"
                  onMouseLeave={editing ? undefined : scheduleCloseMenu}
                  className="absolute inset-x-0 hidden items-center justify-start gap-1 md:flex"
                >
                  {/* Modo edición: chips con controles de reordenar/quitar + botón "+".
                      Modo normal: disparadores del mega-menú (comportamiento original). */}
                  {editing
                    ? categories.map((c, idx) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-0.5 rounded-full border border-dashed border-accent/40 bg-surface-hover/60 py-1 pl-1 pr-1.5"
                        >
                          <button
                            type="button"
                            onClick={() => moveCategory(idx, -1)}
                            disabled={idx === 0 || savingHeader}
                            title="Mover a la izquierda"
                            className="grid h-6 w-6 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <span className="whitespace-nowrap px-1 text-[13px] font-bold tracking-[-0.02em] text-text">{c.name}</span>
                          <button
                            type="button"
                            onClick={() => moveCategory(idx, 1)}
                            disabled={idx === categories.length - 1 || savingHeader}
                            title="Mover a la derecha"
                            className="grid h-6 w-6 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCategory(c.id)}
                            disabled={savingHeader}
                            title="Quitar del header"
                            className="grid h-6 w-6 place-items-center rounded-full text-muted transition-colors hover:bg-danger hover:text-white disabled:opacity-30"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    : categories.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseEnter={() => openMenu(c.id)}
                          onFocus={() => openMenu(c.id)}
                          onClick={() => toggleMenu(c.id)}
                          aria-expanded={openCat === c.id}
                          className={cn(
                            "flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-2 text-[14px] font-bold tracking-[-0.02em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                            openCat === c.id ? "bg-surface-hover text-text" : "text-muted hover:bg-surface-hover hover:text-text",
                          )}
                        >
                          {c.name}
                          <motion.span
                            aria-hidden
                            animate={{ rotate: openCat === c.id ? 180 : 0 }}
                            transition={{ duration: 0.25, ease: EASE }}
                            className="grid place-items-center"
                          >
                            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </motion.span>
                        </button>
                      ))}

                  {/* Botón "+" para agregar una etiqueta (solo modo edición). Grayed
                      out cuando no hay categorías disponibles; al pulsarlo → toast. */}
                  {editing && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={handleAddClick}
                        aria-disabled={availableToAdd.length === 0}
                        title={availableToAdd.length === 0 ? "No hay más etiquetas disponibles" : "Agregar etiqueta"}
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-full border border-dashed transition-colors",
                          availableToAdd.length === 0
                            ? "border-border/50 text-muted/40"
                            : "border-accent/50 text-accent hover:bg-accent hover:text-bg",
                        )}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <AnimatePresence>
                        {addOpen && availableToAdd.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18, ease: EASE }}
                            className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-premium"
                          >
                            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Agregar al header</p>
                            {availableToAdd.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => addCategory(c.id)}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-text transition-colors hover:bg-surface-hover"
                              >
                                <Plus className="h-3.5 w-3.5 text-accent-2" />
                                {c.name}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.nav>
              )}
            </AnimatePresence>
          </div>

          {/* ── Iconos (derecha): Categorías (solo móvil) · Search · Cart · Login ── */}
          <div className="flex shrink-0 items-center gap-1">
            {/* Solo <md: el mega-menú de categorías de arriba es hidden md:flex, así
                que en móvil esta es la única entrada a categorías desde el header. */}
            <div className="md:hidden">
              <IconButton label="Menú" onClick={() => setCategoriesOpen(true)}>
                <LayoutGrid className="h-[18px] w-[18px] sm:h-[22px] sm:w-[22px]" />
              </IconButton>
            </div>
            <IconButton
              label={searchOpen ? "Cerrar búsqueda" : "Buscar"}
              onClick={openSearch}
              active={searchOpen}
            >
              {searchOpen ? <X className="h-[18px] w-[18px] sm:h-[22px] sm:w-[22px]" /> : <Search className="h-[18px] w-[18px] sm:h-[22px] sm:w-[22px]" />}
            </IconButton>
            <CartButton />
            {/* Sesión: con usuario → menú (foto, nombre, Cerrar sesión); sin usuario → login. */}
            {user ? (
              <UserMenu />
            ) : (
              <Link
                to="/login"
                aria-label="Iniciar sesión"
                className="grid h-9 w-9 sm:h-11 sm:w-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <User className="h-[18px] w-[18px] sm:h-[22px] sm:w-[22px]" />
              </Link>
            )}
          </div>
        </div>

        {/* ── Búsqueda MÓVIL (<md): overlay a pantalla completa bajo el header, no la
            fila compartida con logo/iconos — 100% del ancho para escribir cómodo.
            En md+ la búsqueda sigue viviendo en la fila central (bloque de arriba). ── */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              key="mobile-search-panel"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: EASE }}
              className="absolute inset-x-0 top-full z-40 border-b border-border/50 bg-bg/95 px-4 py-4 shadow-premium backdrop-blur-xl md:hidden"
            >
              <SearchBar
                value={search}
                onChange={(v) => dispatch(setSearch(v))}
                onClear={() => dispatch(setSearch(""))}
                onSubmit={submitSearch}
                variant="pill"
                withPanel
                autoFocus
                size="lg"
                popularKeywords={popularKeywords}
                featuredProducts={featuredProducts}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Mega-menú (Apple/Razer): panel full-width con el contenido de la categoría ── */}
        <AnimatePresence>
          {activeCat && !searchOpen && (
            // Un solo panel que permanece montado mientras haya categoría activa;
            // al cambiar de categoría solo se intercambia su contenido (sin apilar
            // paneles saliente/entrante). Solo hace enter/exit al abrir/cerrar del todo.
            <motion.div
              key="mega-panel"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: EASE }}
              onMouseEnter={cancelCloseMenu}
              onMouseLeave={scheduleCloseMenu}
              className="absolute left-0 right-0 top-full hidden border-b border-border/50 bg-bg/95 shadow-premium backdrop-blur-xl md:block"
            >
              <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8">
                {/* Cabecera del panel: nombre + "Ver todo" */}
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[15px] font-bold tracking-[-0.01em] text-text">{activeCat.name}</h3>
                  <button
                    type="button"
                    onClick={() => goCategory(activeCat.id)}
                    className="group/all inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold tracking-[-0.01em] text-accent-2 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Ver todo
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/all:translate-x-0.5" />
                  </button>
                </div>

                {activeList.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {activeList.slice(0, 10).map((p) => (
                      <Link
                        key={p.id}
                        to={getProductUrl(p.id, p.name)}
                        onClick={() => setOpenCat(null)}
                        className="group/card flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface/40 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <div className="product-stage grid aspect-square place-items-center overflow-hidden p-3">
                          {p.images?.[0] ? (
                            <img
                              src={p.images[0]}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-contain transition-transform duration-300 group-hover/card:scale-105"
                            />
                          ) : (
                            <span className="grid h-full w-full place-items-center text-muted">
                              <Search className="h-5 w-5" />
                            </span>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-0.5 p-3">
                          <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-text">{p.name}</span>
                          <span className="mt-auto pt-1 text-[13px] font-bold tabular-nums text-accent-2">
                            {formatCordobas(p.price)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-muted">Aún no hay productos en esta categoría.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {bottomBar}
      </header>

      {/* Velo para cerrar el mega-menú al hacer clic fuera (bajo el header). */}
      <AnimatePresence>
        {activeCat && !searchOpen && (
          <motion.button
            key="mega-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            onClick={() => setOpenCat(null)}
            aria-label="Cerrar menú"
            className="fixed inset-0 top-16 z-30 hidden cursor-default bg-black/40 md:block"
          />
        )}
      </AnimatePresence>

      {/* Velo para cerrar la búsqueda al hacer clic fuera (bajo el header). */}
      <AnimatePresence>
        {searchOpen && (
          <motion.button
            key="search-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            onClick={closeSearch}
            aria-label="Cerrar búsqueda"
            className="fixed inset-0 top-16 z-30 cursor-default bg-black/50"
          />
        )}
      </AnimatePresence>

      {/* Drawer de categorías (móvil): un solo origen, compartido con ProductTopNav. */}
      <CategoriesDrawer open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />

      {/* Drawer del carrito: un solo origen para todas las páginas públicas. */}
      <CartDrawer />
    </>
  );
}
