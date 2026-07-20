// Barra de navegación contextual de la página de producto (Editorial Dark).
// Reemplaza al breadcrumb estático y al PublicHeader en /producto/*: es el nav
// que el usuario realmente necesita en una ficha — volver, saber dónde está, y
// acciones (favorito, compartir, carrito).
//
// Comportamiento:
//  · sticky top-0, z-50. En reposo es transparente (deja ver el fondo bg).
//  · al pasar 80px de scroll: superficie con blur + hairline inferior (200ms).
//  · móvil = flecha + título truncado + iconos; tablet+ = añade breadcrumb.
//
// El carrito vive aquí (como en PublicHeader) para que la ficha no pierda acceso
// al carrito: monta el CartDrawer e hidrata desde localStorage al montar.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "@remix-run/react";
import { motion, AnimatePresence, useAnimationControls, useReducedMotion } from "framer-motion";
import { ArrowLeft, Heart, LayoutGrid, Share2, ShoppingCart, User } from "lucide-react";
import { toast } from "sonner";
import { CartDrawer } from "~/components/cart/CartDrawer";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { hydrate, openCart, selectCartCount } from "~/store/slices/cartSlice";
import { cn } from "~/lib/utils";
import { useAuth } from "~/hooks/useAuth";
import { UserMenu } from "~/components/layout/UserMenu";

const SCROLL_THRESHOLD = 80;

export function ProductTopNav({
  title,
  productId,
  onOpenCategories,
}: {
  title: string;
  productId: string;
  /** Abre el CategoriesDrawer (solo móvil): único camino a OTRA categoría desde
   *  la ficha, ya que esta ruta no monta el mega-menú de PublicHeader. */
  onOpenCategories?: () => void;
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  // El carrito vive en este nav: hidratamos desde localStorage al montar (igual
  // que PublicHeader, al que reemplaza en la ficha).
  useEffect(() => {
    dispatch(hydrate());
  }, [dispatch]);

  // Transición de scroll: superficie + blur + hairline tras pasar el umbral.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Volver: si hay historia dentro del sitio (React Router marca history.state.idx),
  // retrocede; si se llegó por enlace directo, va al catálogo (home = catálogo).
  const goBack = useCallback(() => {
    const idx = (window.history.state && (window.history.state as { idx?: number }).idx) ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/");
  }, [navigate]);

  // Compartir: Web Share API nativa; si no existe, copia el enlace.
  const share = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `Mira este producto en Gyro Store: ${title}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Enlace copiado al portapapeles");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        await navigator.clipboard.writeText(url);
        toast.success("Enlace copiado al portapapeles");
      }
    }
  }, [title]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 transition-all duration-300 ease-out",
          scrolled
            ? "border-b border-white/5 bg-surface/70 backdrop-blur-xl shadow-sm"
            : "border-b border-transparent bg-bg",
        )}
      >
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 md:h-16 md:px-6">
          {/* Izquierda: Volver */}
          <div className="flex items-center flex-1">
            <button
              type="button"
              onClick={goBack}
              aria-label="Volver al catálogo"
              className="ease-expo flex h-10 w-10 md:h-9 md:w-auto items-center justify-center md:justify-start gap-1.5 rounded-full bg-surface-2/80 border border-border/50 md:px-3.5 text-text transition-all hover:bg-surface-hover hover:border-accent/30 hover:text-accent-2 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:-ml-2"
            >
              <ArrowLeft className="h-5 w-5 md:h-4 md:w-4 shrink-0" />
              <span className="hidden text-xs font-semibold uppercase tracking-wider md:inline">Volver</span>
            </button>
          </div>

          {/* Centro: Título */}
          <div className="flex-[2] text-center min-w-0 px-2">
            <h1
              aria-current="page"
              className="truncate font-heading text-base md:text-lg font-bold text-text"
            >
              {title}
            </h1>
          </div>

          {/* Derecha: Favorito, Compartir, Carrito */}
          <div className="flex flex-1 justify-end shrink-0 items-center gap-0.5 sm:gap-1">
            <FavoriteButton productId={productId} />
            <IconButton onClick={share} label="Compartir producto">
              <Share2 className="h-5 w-5" />
            </IconButton>
            <CartButton />
          </div>
        </div>
      </header>

      {/* Drawer del carrito montado aquí (este nav reemplaza a PublicHeader en la ficha). */}
      <CartDrawer />
    </>
  );
}

// Botón de icono con hit-area 44×44, hover en superficie y focus ring de acento.
function IconButton({
  onClick,
  label,
  children,
  className,
  ...rest
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
} & Partial<Pick<React.AriaAttributes, "aria-pressed">>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      {...rest}
      className={cn(
        "grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2/50",
        className,
      )}
    >
      {children}
    </button>
  );
}

// Favorito con persistencia local (no hay wishlist en backend todavía). El estado
// NO se comunica solo por color: cambia la forma del icono (relleno) + aria-pressed.
function FavoriteButton({ productId }: { productId: string }) {
  const [fav, setFav] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    try {
      const arr: string[] = JSON.parse(localStorage.getItem("gyro_favs") || "[]");
      setFav(arr.includes(productId));
    } catch {
      /* noop */
    }
  }, [productId]);

  const toggle = useCallback(() => {
    setFav((prev) => {
      const next = !prev;
      try {
        const arr: string[] = JSON.parse(localStorage.getItem("gyro_favs") || "[]");
        const set = new Set(arr);
        next ? set.add(productId) : set.delete(productId);
        localStorage.setItem("gyro_favs", JSON.stringify([...set]));
      } catch {
        /* noop */
      }
      return next;
    });
    if (!fav) toast.success("Añadido a favoritos");
  }, [productId, fav]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
      aria-pressed={fav}
      className={cn(
        "grid h-11 w-11 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2/50",
        fav ? "text-accent hover:bg-surface-2" : "text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      <motion.span
        key={fav ? "on" : "off"}
        initial={reduce ? false : { scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <Heart className={cn("h-5 w-5", fav && "fill-current")} />
      </motion.span>
    </button>
  );
}

// Botón de carrito con contador y "pop" al agregar (misma fuente de verdad).
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
      className="relative grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2/50"
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
            className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold tabular-nums text-bg ring-2 ring-bg"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
