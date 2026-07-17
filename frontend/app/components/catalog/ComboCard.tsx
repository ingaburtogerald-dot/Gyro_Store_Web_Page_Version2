// Card de combo para el storefront (sección "Combos"). Muestra los 2 productos
// del paquete, el precio con ahorro, enlaza a /combo/:id y permite agregar al
// carrito de un clic. Comparte el look "card-premium" con ProductCard.
import { Link } from "@remix-run/react";
import { motion, useReducedMotion } from "framer-motion";
import { ShoppingCart, ImageOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Combo } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { comboToCartItem } from "~/lib/combo";
import { formatCordobas, cn } from "~/lib/utils";

export function ComboCard({ combo, index = 0 }: { combo: Combo; index?: number }) {
  const dispatch = useAppDispatch();
  const reduce = useReducedMotion();

  function addToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    dispatch(addItem(comboToCartItem(combo)));
    dispatch(openCart());
    toast.success("Combo agregado al carrito");
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
        {/* Escenario: las 2 fotos con el "+" al centro */}
        <div className="relative flex items-center gap-2 rounded-none bg-surface-2/40 p-3">
          <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-none bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent ring-1 ring-accent/30 backdrop-blur-md">
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
                  <div className="grid h-full place-items-center text-muted">
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

          <button
            type="button"
            onClick={addToCart}
            aria-label={`Agregar combo ${combo.name} al carrito`}
            className={cn(
              "ease-expo flex h-11 w-full items-center justify-center gap-2 rounded-none text-sm font-bold transition duration-300 active:translate-y-px active:scale-[0.98]",
              "bg-accent text-bg hover:bg-accent-hover",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            )}
          >
            <ShoppingCart className="h-4 w-4" />
            Agregar combo
          </button>
        </div>
      </div>
    </motion.article>
  );
}
