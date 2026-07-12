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
import { Link, useNavigate } from "@remix-run/react";
import { motion, AnimatePresence, useAnimationControls, useReducedMotion } from "framer-motion";
import { ArrowLeft, Heart, Share2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { CartDrawer } from "~/components/cart/CartDrawer";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { hydrate, openCart, selectCartCount } from "~/store/slices/cartSlice";
import { setCategory } from "~/store/slices/uiSlice";
import { cn } from "~/lib/utils";

const SCROLL_THRESHOLD = 80;

export function ProductTopNav({
  title,
  productId,
  categoryId,
  categoryName,
}: {
  title: string;
  productId: string;
  categoryId?: string;
  categoryName?: string;
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
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

  const goCategory = useCallback(() => {
    if (categoryId) dispatch(setCategory(categoryId));
    navigate("/#catalogo");
  }, [categoryId, dispatch, navigate]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-200 ease-out",
          scrolled
            ? "border-b border-border bg-surface/95 backdrop-blur-md"
            : "border-b border-transparent bg-bg",
        )}
      >
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 md:h-16 md:gap-3 md:px-6">
          {/* Volver */}
          <button
            type="button"
            onClick={goBack}
            aria-label="Volver"
            className="ease-expo -ml-2 flex h-11 items-center gap-2 rounded-full px-2.5 text-text transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2/50 md:-ml-2.5"
          >
            <ArrowLeft className="h-6 w-6 shrink-0" />
            <span className="hidden pr-1 text-sm font-semibold md:inline">Volver</span>
          </button>

          {/* Contexto: breadcrumb reducido (desktop) + título truncado */}
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 md:justify-start">
            <nav aria-label="Ruta" className="hidden shrink-0 items-center gap-1.5 text-sm text-muted md:flex">
              <Link to="/#catalogo" className="transition-colors hover:text-text">
                Catálogo
              </Link>
              <span aria-hidden className="text-muted/60">/</span>
            </nav>
            <h1
              aria-current="page"
              className="min-w-0 truncate text-center text-sm font-semibold text-text md:text-left"
            >
              {title}
            </h1>
          </div>

          {/* Acciones: favorito · compartir · carrito */}
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <FavoriteButton productId={productId} />
            <IconButton onClick={share} label="Compartir producto">
              <Share2 className="h-5 w-5" />
            </IconButton>
            <CartButton />
          </div>
        </div>

        {/* Breadcrumb completo (tablet+): navegable, cada segmento salvo el último.
            No compite con el título: tamaño caption, muted, con aire. */}
        <div className="mx-auto hidden w-full max-w-6xl px-6 pb-2 sm:block md:hidden lg:block">
          <nav aria-label="Migas de pan" className="flex items-center gap-2 text-xs text-muted">
            <Link to="/" className="transition-colors hover:text-text">Inicio</Link>
            <span aria-hidden className="text-muted/50">/</span>
            <Link to="/#catalogo" className="transition-colors hover:text-text">Catálogo</Link>
            {categoryName && (
              <>
                <span aria-hidden className="text-muted/50">/</span>
                <button type="button" onClick={goCategory} className="transition-colors hover:text-text">
                  {categoryName}
                </button>
              </>
            )}
            <span aria-hidden className="text-muted/50">/</span>
            <span aria-current="page" className="truncate font-medium text-text/90">{title}</span>
          </nav>
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
  ...rest
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
} & Partial<Pick<React.AriaAttributes, "aria-pressed">>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      {...rest}
      className="grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2/50"
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
