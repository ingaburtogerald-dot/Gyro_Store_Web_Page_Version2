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
import { ShoppingBag, Search, User, X, ArrowRight, ChevronDown } from "lucide-react";
import { Logo } from "~/components/ui/Logo";
import { SearchBar } from "~/components/filters/SearchBar";
import { CartDrawer } from "~/components/cart/CartDrawer";
import { UserMenu } from "./UserMenu";
import { useAuth } from "~/hooks/useAuth";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { hydrate, openCart, selectCartCount } from "~/store/slices/cartSlice";
import { setSearch, setCategory } from "~/store/slices/uiSlice";
import { useGetCatalogQuery } from "~/store/api/catalogApi";
import { buildCategoryTree } from "~/lib/categories";
import { cn, getProductUrl, formatCordobas } from "~/lib/utils";

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
        className="relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-accent-2"
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
            <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-pill bg-accent px-1 text-[10px] font-bold tabular-nums text-bg ring-2 ring-surface">
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
      className="relative grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <motion.span animate={controls} className="block">
        <ShoppingBag className="h-[22px] w-[22px]" />
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
            className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-pill bg-accent px-1 text-[11px] font-bold tabular-nums text-bg ring-2 ring-bg"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/** Botón de icono simple del cluster derecho (Apple/Razer): sin borde, ghost. */
function IconButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof Search;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "grid h-11 w-11 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        active ? "bg-surface-hover text-accent-2" : "text-muted hover:bg-surface-hover hover:text-accent-2",
      )}
    >
      <Icon className="h-[22px] w-[22px]" />
    </button>
  );
}

export function PublicHeader({ bottomBar }: { bottomBar?: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const search = useAppSelector((s) => s.ui.search);

  // Búsqueda desplegable: por defecto oculta (solo la lupa).
  const [searchOpen, setSearchOpen] = useState(false);

  // Mega-menú (Apple/Razer): categoría cuyo panel de contenido está desplegado.
  const [openCat, setOpenCat] = useState<string | null>(null);
  const closeTimer = useRef<number>();

  // Categorías del catálogo (fuente única compartida con el rail).
  const { data: products = [] } = useGetCatalogQuery();
  const categories = useMemo(() => buildCategoryTree(products), [products]);

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

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-17 w-full max-w-[1600px] items-center gap-4 px-4 md:px-8">
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
                  className="absolute inset-x-0 mx-auto w-full max-w-3xl"
                >
                  <SearchBar
                    value={search}
                    onChange={(v) => dispatch(setSearch(v))}
                    onClear={() => dispatch(setSearch(""))}
                    onSubmit={() => navigate("/")}
                    variant="pill"
                    withPanel
                    autoFocus
                    size="md"
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
                  onMouseLeave={scheduleCloseMenu}
                  className="absolute inset-x-0 hidden items-center justify-start gap-1 md:flex"
                >
                  {categories.map((c) => (
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
                </motion.nav>
              )}
            </AnimatePresence>
          </div>

          {/* ── Iconos (derecha): Search · Cart · Login ── */}
          <div className="flex shrink-0 items-center gap-1">
            <IconButton
              icon={searchOpen ? X : Search}
              label={searchOpen ? "Cerrar búsqueda" : "Buscar"}
              onClick={openSearch}
              active={searchOpen}
            />
            <CartButton />
            {/* Sesión: con usuario → menú (foto, nombre, Cerrar sesión); sin usuario → login. */}
            {user ? (
              <UserMenu />
            ) : (
              <Link
                to="/login"
                aria-label="Iniciar sesión"
                className="grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <User className="h-[22px] w-[22px]" />
              </Link>
            )}
          </div>
        </div>

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
                        <div className="grid aspect-square place-items-center overflow-hidden bg-surface-2/50 p-3">
                          {p.images?.[0] ? (
                            <img
                              src={p.images[0]}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-contain transition-transform duration-300 group-hover/card:scale-105"
                            />
                          ) : (
                            <span className="grid h-full w-full place-items-center rounded-lg bg-surface-2 text-muted">
                              <Search className="h-5 w-5 opacity-40" />
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

      {/* Drawer del carrito: un solo origen para todas las páginas públicas. */}
      <CartDrawer />
    </>
  );
}
