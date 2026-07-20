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

  return (
    <motion.article {...motionProps} className="group">
      <Link
        to={`/combo/${combo.id}`}
        prefetch="intent"
        aria-label={combo.name}
        className="block focus-visible:outline-none"
      >
        {/* Stage de imagen: idéntico al ShowcaseCard (artículos populares) */}
        <div className="ease-expo product-stage relative aspect-square overflow-hidden rounded-2xl transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_20px_48px_-16px_rgba(0,0,0,0.5)]">
          <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[9px] sm:px-2.5 sm:text-[11px] font-bold text-bg shadow-sm">
              <Sparkles className="h-3 w-3" /> Combo
            </span>
            {onSale && (
              <span className="rounded-md bg-accent px-2 py-0.5 text-[9px] sm:px-2.5 sm:text-[11px] font-bold tabular-nums text-bg shadow-sm">
                Ahorrás {formatCordobas(combo.savings)}
              </span>
            )}
          </div>

          {image ? (
            <img
              src={image}
              alt={combo.name}
              loading={index < 4 ? "eager" : "lazy"}
              decoding="async"
              className="ease-expo h-full w-full object-cover transition duration-[600ms] will-change-transform group-hover:scale-[1.06]"
            />
          ) : combo.products.length > 0 ? (
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
        </div>

        {/* Textos: idénticos al ShowcaseCard */}
        <h3 className="mt-3 text-[13px] font-bold leading-snug tracking-tight text-text transition-colors group-hover:text-accent-2 sm:text-xl sm:mt-4">
          {combo.name}
        </h3>
        
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-[13px] font-extrabold tabular-nums text-accent-2 sm:text-lg">
            {formatCordobas(combo.price)}
          </span>
          {onSale && (
            <span className="text-[11px] text-muted line-through tabular-nums sm:text-sm">
              {formatCordobas(combo.normalTotal)}
            </span>
          )}
        </div>
      </Link>
    </motion.article>
  );
}
