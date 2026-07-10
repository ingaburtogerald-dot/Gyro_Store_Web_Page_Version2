// Hero del catálogo — dirección editorial premium (dark).
// Composición centrada pero con jerarquía real: eyebrow de vidrio, emblema (mascota
// Gyro) con anillo cónico y glow contenido, titular display (Bricolage Grotesque)
// con una palabra en acento, y señales de confianza como pills de vidrio.
// Un solo gesto de movimiento (el emblema flota). Responsive: compacto en móvil
// para que la primera fila de productos asome sobre el pliegue.
import { motion, useReducedMotion } from "framer-motion";
import { Truck, ShieldCheck, Wallet, Sparkles } from "lucide-react";

// Señales de confianza bajo el titular (estáticas).
const TRUST = [
  { icon: Truck, label: "Envío en Managua" },
  { icon: ShieldCheck, label: "Garantía real" },
  { icon: Wallet, label: "Pago contra entrega" },
];

export function Hero({ productCount = 0 }: { productCount?: number }) {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden px-4 pb-10 pt-10 text-center sm:pb-16 sm:pt-16">
      {/* Ambiente: halo cyan sereno + una línea de horizonte muy tenue detrás. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-2 h-[46vh] w-[46vh] -translate-x-1/2 rounded-full bg-accent/10 blur-[130px]" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl">
        {/* Eyebrow: pill de vidrio con el posicionamiento de la tienda. */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 inline-flex items-center gap-2 rounded-pill pill-glass px-3.5 py-1.5 text-[12px] font-semibold tracking-wide text-accent-2 sm:mb-8"
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
                className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface/60 px-3 py-1.5 text-xs font-medium text-muted backdrop-blur-sm"
              >
                <Icon className="h-3.5 w-3.5 text-accent-2" /> {label}
              </span>
            ))}
          </div>

          {productCount > 0 && (
            <p className="mt-5 text-xs tabular-nums text-muted">
              <span className="font-semibold text-text">{productCount}</span> productos disponibles
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
