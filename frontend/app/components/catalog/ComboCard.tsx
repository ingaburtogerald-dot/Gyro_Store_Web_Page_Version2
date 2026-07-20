// Card de combo para el storefront (sección "Combos"). Los combos son un artículo
// más: usa exactamente el mismo layout/estilo que ProductCard (foto única, precio,
// nombre, botón) para que no haya ruptura visual entre navegar productos sueltos y
// navegar combos. La foto es la del primer producto del paquete; el badge "Combo"
// + el eyebrow "N productos" son la única señal de que es un paquete.
import { Link } from "@remix-run/react";
import { motion, useReducedMotion } from "framer-motion";
import { ShoppingCart, ImageOff, Sparkles, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { useGetConfigQuery, type Combo } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { comboToCartItem } from "~/lib/combo";
import { formatCordobas, cn, buildWhatsappUrl } from "~/lib/utils";

export function ComboCard({ combo, index = 0 }: { combo: Combo; index?: number }) {
  const dispatch = useAppDispatch();
  const { data: config } = useGetConfigQuery();
  const reduce = useReducedMotion();
  // Foto propia si el admin subió una; si no, la card arma el split de las
  // fotos de los productos referenciados (degrada bien si hay !=2).
  const image = combo.image;
  const onSale = combo.savings > 0;

  function addToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    dispatch(addItem(comboToCartItem(combo)));
    dispatch(openCart());
    toast.success("Combo agregado al carrito");
  }

  function orderByWhatsApp(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = typeof window !== "undefined" ? `${window.location.origin}/combo/${combo.id}` : "";
    const message = `Hola, quiero el combo: ${combo.name} — ${formatCordobas(combo.price)}. ${url}`;
    window.open(buildWhatsappUrl(config?.whatsapp ?? "50585944758", message), "_blank", "noopener,noreferrer");
  }

  const motionProps = {
    initial: reduce ? false : ({ opacity: 0, y: 20 } as const),
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-40px" },
    transition: { duration: 0.5, delay: (index % 4) * 0.06, ease: [0.16, 1, 0.3, 1] as const },
    whileHover: reduce ? undefined : { y: -4, transition: { type: "spring" as const, stiffness: 260, damping: 24 } },
    whileTap: reduce ? undefined : { scale: 0.985, transition: { duration: 0.15 } },
  };

  // Mismo "shell" que ProductCard: sin sombra ni glow, la profundidad la carga el
  // hairline que se aclara en hover. DESIGN.md §6.
  const shell = "ease-expo group relative flex overflow-hidden rounded-xl border border-white/10 bg-surface transition-colors duration-300 hover:border-white/25";

  return (
    <motion.article {...motionProps} className={cn(shell, "flex-col")}>
      {/* Escenario: la foto del primer producto del paquete, sin recuadro artificial
          (product-stage es un no-op de layout — ver globals.css) para que su fondo
          blanco se funda con la card, igual que en ProductCard. */}
      <Link
        to={`/combo/${combo.id}`}
        prefetch="intent"
        aria-label={combo.name}
        className="product-stage ease-expo relative block aspect-square w-full overflow-hidden rounded-t-xl"
      >
        <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-0.5 text-[11px] font-bold text-bg">
          <Sparkles className="h-3 w-3" /> Combo
        </span>

        {/* El ahorro protagonista: visible de un vistazo, sin tener que leer el
            precio. Mismo lenguaje que el badge de descuento de ProductCard. */}
        {onSale && (
          <span className="absolute right-3 top-3 z-10 rounded-md bg-accent px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-bg shadow-sm">
            Ahorrás {formatCordobas(combo.savings)}
          </span>
        )}

        {image ? (
          <img
            src={image}
            alt={combo.name}
            loading={index < 4 ? "eager" : "lazy"}
            decoding="async"
            className="ease-expo h-full w-full object-contain p-6 transition duration-[600ms] will-change-transform group-hover:scale-[1.06]"
          />
        ) : combo.products.length > 0 ? (
          // Sin foto propia: split de las fotos de los productos con un "+" al
          // centro (mismo lenguaje que ComboGrid admin y el detalle). Degrada
          // bien si hay 1 o más de 2 (aunque el sistema siempre guarda 2).
          <div className="flex h-full items-stretch gap-1 p-4">
            {combo.products.map((p, i) => (
              <div key={p.id} className="flex flex-1 items-center gap-1">
                {i > 0 && <span className="shrink-0 text-lg font-light text-muted">+</span>}
                <div className="grid h-full flex-1 place-items-center overflow-hidden">
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      loading={index < 4 ? "eager" : "lazy"}
                      decoding="async"
                      className="ease-expo h-full w-full object-contain transition duration-[600ms] will-change-transform group-hover:scale-[1.06]"
                    />
                  ) : (
                    <ImageOff className="h-7 w-7 text-muted" />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid h-full place-items-center text-muted">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="truncate text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
          {combo.products.length} productos
        </span>

        <Link
          to={`/combo/${combo.id}`}
          prefetch="intent"
          className="line-clamp-2 text-sm font-bold leading-snug tracking-tight text-text transition-colors group-hover:text-accent-2"
        >
          {combo.name}
        </Link>

        <div className="mt-auto space-y-3 pt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-extrabold tabular-nums leading-none text-accent">
              {formatCordobas(combo.price)}
            </span>
            {onSale && (
              <span className="text-xs text-muted line-through tabular-nums">
                {formatCordobas(combo.normalTotal)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={addToCart} aria-label={`Agregar combo ${combo.name} al carrito`} className="h-11 flex-1">
              <ShoppingCart className="h-4 w-4" />
              Agregar combo
            </Button>
            <button
              type="button"
              onClick={orderByWhatsApp}
              aria-label={`Pedir combo ${combo.name} por WhatsApp`}
              title="Pedir por WhatsApp"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-whatsapp/30 bg-whatsapp/10 text-whatsapp transition-colors hover:bg-whatsapp/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp/60"
            >
              <MessageCircle className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
