// Card de combo para el storefront (sección "Combos"). Muestra los 2 productos
// del paquete, el precio con ahorro, enlaza a /combo/:id y permite agregar al
// carrito de un clic. Comparte el look "card-premium" con ProductCard.
import { Link } from "@remix-run/react";
import { motion, useReducedMotion } from "framer-motion";
import { ShoppingCart, ImageOff, Sparkles, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useGetConfigQuery, type Combo } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { comboToCartItem } from "~/lib/combo";
import { formatCordobas, cn, buildWhatsappUrl } from "~/lib/utils";

export function ComboCard({ combo, index = 0 }: { combo: Combo; index?: number }) {
  const dispatch = useAppDispatch();
  const { data: config } = useGetConfigQuery();
  const reduce = useReducedMotion();

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
    whileTap: reduce ? undefined : { scale: 0.985, y: 0 },
  };

  return (
    <motion.article
      {...motionProps}
      className={cn(
        "card-premium ease-expo group relative flex h-full flex-col overflow-hidden rounded-none p-3",
        "transition-[transform,border-color,box-shadow] duration-300 hover:border-white/25",
      )}
    >
      <Link to={`/combo/${combo.id}`} prefetch="intent" aria-label={combo.name} className="block">
        {/* Escenario: las 2 fotos con el "+" al centro. Hairline abajo: marca el
            "sello" entre el stage claro y el cuerpo oscuro (nombre/precio). */}
        <div className="product-stage relative flex items-center gap-2 rounded-none border-b border-black/5 p-3">
          {/* Sólido (no bg-accent/15 translúcido): sobre el stage claro, ese wash
              quedaba en ~2:1 de contraste — por debajo del mínimo AA (4.5:1). */}
          <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-none bg-accent px-2 py-0.5 text-[11px] font-bold text-bg">
            <Sparkles className="h-3 w-3" /> Combo
          </span>
          {combo.products.map((p, i) => (
            <div key={p.id} className="flex flex-1 items-center gap-2">
              {i > 0 && <span className="text-lg font-light text-muted">+</span>}
              <div className="aspect-square w-full overflow-hidden rounded-none">
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.name}
                    loading={index < 4 ? "eager" : "lazy"}
                    className="ease-expo h-full w-full object-contain p-3 transition duration-[600ms] group-hover:scale-[1.06]"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-black/20">
                    <ImageOff className="h-7 w-7" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 px-0.5 pt-3">
        <Link
          to={`/combo/${combo.id}`}
          prefetch="intent"
          className="ease-expo line-clamp-2 text-[0.95rem] font-bold leading-snug tracking-tight text-text transition-colors group-hover:text-accent-2"
        >
          {combo.name}
        </Link>

        <div className="mt-auto space-y-2.5 pt-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-heading text-lg font-extrabold tabular-nums leading-none text-accent">
              {formatCordobas(combo.price)}
            </span>
            {combo.savings > 0 && (
              <span className="text-xs font-light text-muted line-through tabular-nums">
                {formatCordobas(combo.normalTotal)}
              </span>
            )}
            {combo.savings > 0 && (
              <span className="rounded-none border border-whatsapp/20 bg-whatsapp/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-whatsapp">
                Ahorras {formatCordobas(combo.savings)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addToCart}
              aria-label={`Agregar combo ${combo.name} al carrito`}
              className={cn(
                "ease-expo flex h-11 flex-1 items-center justify-center gap-2 rounded-none text-sm font-bold transition duration-300 active:translate-y-px active:scale-[0.98]",
                "bg-accent text-bg hover:bg-accent-hover",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
              )}
            >
              <ShoppingCart className="h-4 w-4" />
              Agregar combo
            </button>
            <button
              type="button"
              onClick={orderByWhatsApp}
              aria-label={`Pedir combo ${combo.name} por WhatsApp`}
              title="Pedir por WhatsApp"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-none border border-whatsapp/30 bg-whatsapp/10 text-whatsapp transition-colors hover:bg-whatsapp/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp/60"
            >
              <MessageCircle className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
