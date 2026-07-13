// Header sticky del catálogo público (Amazon-style): logo · búsqueda integrada ·
// redes · carrito con contador · acceso. La búsqueda va en la fila principal en
// desktop y en una segunda fila full-width en móvil. El carrito vive aquí (antes
// era un FAB): este header también HIDRATA el carrito desde localStorage al montar.
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "@remix-run/react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { ShoppingCart, Sparkles } from "lucide-react";
import { Logo } from "~/components/ui/Logo";
import { SearchBar } from "~/components/filters/SearchBar";
import { CartDrawer } from "~/components/cart/CartDrawer";
import { AboutUsModal } from "./AboutUsModal";
import { HeaderSettingsMenu } from "./HeaderSettingsMenu";
import { cn } from "~/lib/utils";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { hydrate, openCart, selectCartCount } from "~/store/slices/cartSlice";
import { setSearch } from "~/store/slices/uiSlice";

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
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      onClick={() => dispatch(openCart())}
      aria-label={count > 0 ? `Abrir carrito, ${count} artículo${count === 1 ? "" : "s"}` : "Abrir carrito"}
      className="relative grid h-11 w-11 place-items-center rounded-full border border-border bg-surface-2/70 text-muted shadow-sm backdrop-blur-sm transition-colors hover:border-accent/40 hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <ShoppingCart className="h-5 w-5" />
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 20 }}
            // ring-bg lo separa del header con un halo del color de fondo → "flota".
            className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold tabular-nums text-bg ring-2 ring-bg shadow-accent-cta"
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
  const location = useLocation();
  // La búsqueda solo tiene sentido donde hay grilla (home). En detalle/contacto se oculta.
  const showSearch = location.pathname === "/";
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const search = useAppSelector((s) => s.ui.search);

  // El carrito ahora vive en el header: hidratamos desde localStorage al montar.
  useEffect(() => {
    dispatch(hydrate());
  }, [dispatch]);

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-border/40 bg-bg/70 backdrop-blur-xl">
      <div className="flex w-full items-center gap-3 px-4 py-3 md:px-8 lg:gap-6">
        {/* El logo ahora solo lleva al inicio; la historia de la marca vive en el
            botón "¿Quiénes Somos?" del cluster derecho. */}
        <Link
          to="/"
          className="group -ml-1 shrink-0 rounded-xl px-2 py-1 text-left transition-all duration-300 hover:bg-surface-hover active:scale-95"
          aria-label="Ir al inicio de Gyro Store"
        >
          <Logo size={32} withText textClassName="text-xl transition-all group-hover:brightness-125" />
        </Link>

        {/* Búsqueda integrada (desktop, centro). En móvil va en la 2ª fila. */}
        {showSearch && (
          <div className="hidden flex-1 justify-center md:flex">
            <div className="w-full max-w-2xl">
              <SearchBar
                value={search}
                onChange={(v) => dispatch(setSearch(v))}
                onClear={() => dispatch(setSearch(""))}
                size="md"
              />
            </div>
          </div>
        )}

        <div className={cn("flex items-center gap-1.5 sm:gap-2", !showSearch && "ml-auto")}>
          {/* "¿Quiénes Somos?": hereda el modal que antes abría el logo. Icono-solo
              en móvil, con texto en pantallas ≥ sm. */}
          <button
            onClick={() => setIsAboutOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface-2/70 px-3 text-sm font-medium text-muted shadow-sm backdrop-blur-sm transition-colors hover:border-accent/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-4"
            aria-label="¿Quiénes somos?"
          >
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="hidden sm:inline">¿Quiénes Somos?</span>
          </button>
          <CartButton />
          <HeaderSettingsMenu />
        </div>
      </div>

      {/* Búsqueda móvil: segunda fila full-width dentro del header. */}
      {showSearch && (
        <div className="px-4 pb-3 md:hidden">
          <SearchBar
            value={search}
            onChange={(v) => dispatch(setSearch(v))}
            onClear={() => dispatch(setSearch(""))}
            size="sm"
          />
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
