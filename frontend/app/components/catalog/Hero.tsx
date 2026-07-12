import { motion, useReducedMotion } from "framer-motion";
import { Truck, ShieldCheck, Wallet, Sparkles, MessageCircle, ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/Button";

// Señales de confianza bajo el titular (estáticas).
const TRUST = [
  { icon: Truck, label: "Envío en Managua" },
  { icon: ShieldCheck, label: "Garantía real" },
  { icon: Wallet, label: "Pago contra entrega" },
];

export function Hero({ productCount = 0 }: { productCount?: number }) {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden px-4 pb-10 pt-6 text-center sm:pb-16 sm:pt-10">
      {/* Ambiente: halo cyan sereno + una línea de horizonte muy tenue detrás. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-2 h-[46vh] w-[46vh] -translate-x-1/2 rounded-full bg-accent/10 blur-[130px]" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl">
        {/* Announcement Bar (Lead Gen WhatsApp) */}
        <motion.a
          href="https://wa.me/50585944758?text=Hola,%20es%20mi%20primera%20vez%20en%20Gyro%20Store%20y%20quiero%20mi%20descuento%20VIP"
          target="_blank"
          rel="noopener noreferrer"
          initial={reduce ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mb-8 flex w-fit max-w-full items-center gap-2 rounded-full border border-whatsapp/20 bg-whatsapp/10 px-4 py-1.5 text-[11px] font-medium text-[#25D366] backdrop-blur-md transition-colors hover:bg-whatsapp/20 sm:text-xs"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span className="truncate">🎁 ¿Es tu primera vez? Únete a nuestro VIP y recibe C$100 de descuento</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </motion.a>

        {/* Eyebrow: pill de vidrio con el posicionamiento de la tienda. */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 inline-flex items-center gap-2 rounded-pill border border-border bg-surface-2 px-3.5 py-1.5 text-[12px] font-semibold tracking-wide text-accent-2 sm:mb-8"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Tienda de tecnología · Managua, Nicaragua
        </motion.div>

        {/* Emblema protagonista: anillo cónico girando lento + glow contenido + flotar. */}
        <div className="relative mx-auto mb-6 h-24 w-24 sm:mb-9 sm:h-40 sm:w-40">
          <div className="absolute -inset-3 rounded-full bg-accent/15 blur-2xl" aria-hidden />
          {!reduce && (
            <motion.div
              aria-hidden
              className="absolute -inset-[3px] rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, color-mix(in srgb, var(--color-accent) 70%, transparent) 90deg, transparent 200deg)",
                maskImage: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
                WebkitMaskImage: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
          )}
          <motion.img
            src="/gyro-emblem.png"
            alt="Gyro — mascota de Gyro Store"
            fetchPriority="high"
            loading="eager"
            decoding="async"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={
              reduce ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, y: [0, -9, 0] }
            }
            transition={{
              opacity: { duration: 0.6 },
              scale: { duration: 0.6 },
              y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
            }}
            className="relative h-full w-full rounded-full object-cover ring-1 ring-white/10"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Titular editorial: display Bricolage, tracking apretado, palabra en acento. */}
          <h1 className="font-heading text-[clamp(2.1rem,6.4vw,3.85rem)] font-extrabold leading-[0.98] tracking-[-0.035em] text-balance text-text">
            Accesorios tecnológicos con{" "}
            <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
              calidad de sobra
            </span>{" "}
            en Managua
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-base leading-relaxed text-muted sm:text-lg">
            Audífonos, adaptadores y accesorios que suenan por encima de su precio.{" "}
            <span className="font-semibold text-text">Equípate con Gyro.</span>
          </p>

          {/* Franja de confianza — pills de vidrio finas bajo el titular. */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
            {TRUST.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted"
              >
                <Icon className="h-3.5 w-3.5 text-accent-2" /> {label}
              </span>
            ))}
          </div>

          {/* CTA Principal */}
          <div className="mt-8 flex justify-center">
            <Button
              size="lg"
              onClick={() => window.scrollTo({ top: window.innerHeight * 0.75, behavior: "smooth" })}
              className="group gap-2 px-8 py-3.5 text-[15px] font-bold"
            >
              Ver Ofertas de Hoy
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </div>



        </motion.div>
      </div>
    </section>
  );
}
