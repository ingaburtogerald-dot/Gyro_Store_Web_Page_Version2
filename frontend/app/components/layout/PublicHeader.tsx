// Header sticky del catálogo público (Amazon-style): logo · búsqueda integrada ·
// redes · carrito con contador · acceso. La búsqueda va en la fila principal en
// desktop y en una segunda fila full-width en móvil. El carrito vive aquí (antes
// era un FAB): este header también HIDRATA el carrito desde localStorage al montar.
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "@remix-run/react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { KeyRound, Pencil, LayoutDashboard, ShoppingBag } from "lucide-react";
import { Logo } from "~/components/ui/Logo";
import { MegaSearchBar } from "~/components/catalog/MegaSearchBar";
import { CartDrawer } from "~/components/cart/CartDrawer";
import { AboutUsModal } from "./AboutUsModal";
import { cn } from "~/lib/utils";
import { roleLandingPath } from "~/lib/constants";
import { useGetConfigQuery } from "~/store/api/catalogApi";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { hydrate, openCart, selectCartCount } from "~/store/slices/cartSlice";
import { selectIsAdmin, selectEditMode, selectStatus, selectRoles, toggleEditMode } from "~/store/slices/authSlice";

/** Botón del carrito con contador y "pop" al agregar. Comparte fuente de verdad
 *  con el resto de la app (cartSlice); reemplaza al antiguo CartFab. */
function CartButton() {
  const dispatch = useAppDispatch();
  const count = useAppSelector(selectCartCount);
  const controls = useAnimationControls();
  const prev = useRef(count);

  useEffect(() => {
    if (count > prev.current) {
      controls.start({ scale: [1, 1.25, 0.95, 1], transition: { duration: 0.4, ease: "easeOut" } });
    }
    prev.current = count;
  }, [count, controls]);

  return (
    <motion.button
      animate={controls}
      onClick={() => dispatch(openCart())}
      aria-label={count > 0 ? `Abrir carrito, ${count} artículo${count === 1 ? "" : "s"}` : "Abrir carrito"}
      className="relative grid h-10 w-10 place-items-center rounded-pill text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <ShoppingBag className="h-5 w-5" />
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold tabular-nums text-bg"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function PublicHeader({ bottomBar }: { bottomBar?: React.ReactNode }) {
  const { data: config } = useGetConfigQuery();
  const social = config?.socialLinks;
  const dispatch = useAppDispatch();
  const isAdmin = useAppSelector(selectIsAdmin);
  const editMode = useAppSelector(selectEditMode);
  const status = useAppSelector(selectStatus);
  const roles = useAppSelector(selectRoles);
  const location = useLocation();
  // El botón "Editar" del catálogo solo tiene sentido en el home (donde está la grilla).
  const isHome = location.pathname === "/";
  // La búsqueda solo tiene sentido donde hay grilla (home). En detalle/contacto se oculta.
  const showSearch = isHome;
  // Tras iniciar sesión, vuelve a la página actual del catálogo.
  const loginTo = `/login?redirectTo=${encodeURIComponent(location.pathname + location.search)}`;
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // El carrito ahora vive en el header: hidratamos desde localStorage al montar.
  useEffect(() => {
    dispatch(hydrate());
  }, [dispatch]);

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-lg">
      <div className="flex w-full items-center gap-3 px-4 py-3 md:px-8 lg:gap-6">
        <button
          onClick={() => setIsAboutOpen(true)}
          className="group -ml-1 shrink-0 rounded-xl px-2 py-1 text-left transition-all duration-300 hover:bg-white/5 active:scale-95"
          aria-label="Acerca de Gyro Store"
        >
          <Logo size={38} withText textClassName="text-xl transition-all group-hover:brightness-125" />
        </button>

        {/* Búsqueda integrada (desktop, centro). En móvil va en la 2ª fila. */}
        {showSearch && (
          <div className="hidden flex-1 justify-center md:flex">
            <div className="w-full max-w-2xl">
              <MegaSearchBar />
            </div>
          </div>
        )}

        <div className={cn("flex items-center gap-1 sm:gap-2", !showSearch && "ml-auto")}>
          {isAdmin && isHome && (
            <button
              onClick={() => dispatch(toggleEditMode())}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill border px-3 py-2 text-sm transition-colors",
                editMode ? "border-transparent bg-gradient-accent text-white" : "border-border text-muted hover:text-text",
              )}
              title="Modo edición del catálogo"
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">{editMode ? "Editando" : "Editar"}</span>
            </button>
          )}

          <CartButton />

          {/* Con sesión activa: ir al panel (no se cierra la sesión). Sin sesión: acceso. */}
          {status === "authenticated" ? (
            <Link
              to={roleLandingPath(roles)}
              className="inline-flex items-center gap-1.5 rounded-pill bg-gradient-accent px-4 py-2 text-sm font-semibold text-white shadow-md shadow-accent/25 transition-all hover:shadow-lg hover:shadow-accent/40 hover:brightness-110 active:scale-95"
              title="Centro de Administración"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Centro de Administración</span>
            </Link>
          ) : status === "unauthenticated" ? (
            <Link
              to={loginTo}
              className="inline-flex items-center gap-1.5 rounded-pill px-3 py-2 text-sm text-muted transition-colors hover:text-text"
              title="Acceso Colaboradores"
            >
              <KeyRound className="h-4 w-4" />
              <span className="hidden sm:inline">Acceso</span>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Búsqueda móvil: segunda fila full-width dentro del header. */}
      {showSearch && (
        <div className="px-4 pb-3 md:hidden">
          <MegaSearchBar />
        </div>
      )}
      {bottomBar}
    </header>
    {/* Drawer del carrito: montado junto al header para que funcione en TODAS
        las páginas públicas (home, detalle, contacto) con un solo origen. */}
    <CartDrawer />
    <AboutUsModal open={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </>
  );
}
