// Hero del catálogo — emblema (mascota Gyro) protagonista, centrado.
// Un solo gesto de movimiento (el emblema flota), halo ambiental sereno detrás,
// titular display en tinta sólida (sin gradient-text) y señales de confianza.
// Responsive: paddings/emblema compactos en móvil para que la primera fila de
// productos siga asomando sobre el pliegue.
import { motion, useReducedMotion } from "framer-motion";
import { Truck, ShieldCheck, Wallet } from "lucide-react";

// Señales de confianza bajo el titular (estáticas).
const TRUST = [
  { icon: Truck, label: "Envío en Managua" },
  { icon: ShieldCheck, label: "Garantía" },
  { icon: Wallet, label: "Pago contra entrega" },
];

export function Hero({ productCount = 0 }: { productCount?: number }) {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden px-4 pb-8 pt-8 text-center sm:pb-16 sm:pt-16">
      {/* Ambiente: un único halo radial sereno detrás del contenido. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[52vh] w-[52vh] -translate-x-1/2 rounded-full bg-accent/10 blur-[130px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl">
        {/* Emblema protagonista: glow estático detrás + un solo gesto (flotar). */}
        <div className="relative mx-auto mb-4 h-24 w-24 sm:mb-8 sm:h-48 sm:w-48">
          <div className="absolute inset-2 rounded-full bg-accent/20 blur-2xl" aria-hidden />
          <motion.img
            src="/gyro-emblem.png"
            alt="Gyro — mascota de Gyro Store"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={
              reduce
                ? { opacity: 1, scale: 1 }
                : { opacity: 1, scale: 1, y: [0, -10, 0] }
            }
            transition={{
              opacity: { duration: 0.6 },
              scale: { duration: 0.6 },
              y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
            }}
            className="relative h-full w-full rounded-full object-cover"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Titular editorial: peso extrabold, tracking ajustado, sin gradient-text. */}
          <h1 className="font-heading text-[clamp(2rem,6vw,3.5rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-balance text-text">
            Accesorios tecnológicos de la mejor calidad en Managua
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-pretty text-base text-muted sm:mt-5">
            Audífonos, adaptadores y accesorios que suenan por encima de su precio.{" "}
            <span className="font-semibold text-text">Equípate con Gyro.</span>
          </p>

          {/* Franja de confianza — fila fina bajo el titular. */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted sm:mt-7 sm:gap-x-6">
            {TRUST.map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <Icon className="h-4 w-4 text-accent-2" /> {label}
              </span>
            ))}
          </div>

          <p className="mt-4 text-xs tabular-nums text-muted sm:mt-5">{productCount} productos disponibles</p>
        </motion.div>
      </div>
    </section>
  );
}
