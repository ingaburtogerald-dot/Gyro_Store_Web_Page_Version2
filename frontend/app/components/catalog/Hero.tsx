// Hero del catálogo — dirección "Obsidian Atelier".
// Editorial y confiado: un solo gesto de movimiento (el emblema flota), fondo
// ambiental sereno (un halo, no aurora doble), wordmark display en tinta sólida
// (sin gradient-text) y buscador refinado. La marca es la estrella; nada compite.
import { motion, useReducedMotion } from "framer-motion";
import { Search, Truck, ShieldCheck, Wallet } from "lucide-react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { setSearch } from "~/store/slices/uiSlice";

// Señales de confianza bajo el buscador (estáticas).
const TRUST = [
  { icon: Truck, label: "Envío en Managua" },
  { icon: ShieldCheck, label: "Garantía" },
  { icon: Wallet, label: "Pago contra entrega" },
];

export function Hero({ productCount = 0 }: { productCount?: number }) {
  const dispatch = useAppDispatch();
  const search = useAppSelector((s) => s.ui.search);
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-14 text-center sm:pt-20">
      {/* Ambiente: un único halo radial sereno detrás del contenido. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[52vh] w-[52vh] -translate-x-1/2 rounded-full bg-accent/10 blur-[130px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl">
        {/* Emblema protagonista: glow estático detrás + un solo gesto (flotar). */}
        <div className="relative mx-auto mb-8 h-40 w-40 sm:h-48 sm:w-48">
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
          {/* Wordmark display: Sora sólido, ajustado y equilibrado (adiós gradient-text). */}
          <h1 className="font-heading text-[clamp(2.5rem,8vw,4.5rem)] font-bold leading-none tracking-[-0.03em] text-balance text-text">
            Gyro Store
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-base text-muted">
            Audio y gaming de élite en Managua —{" "}
            <span className="font-semibold text-text">equípate con Gyro</span>.
          </p>

          <div className="ease-expo mx-auto mt-8 flex max-w-md items-center gap-2 rounded-pill border border-border bg-surface/70 px-4 backdrop-blur-md transition duration-300 focus-within:border-accent focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.12)]">
            <Search className="h-4 w-4 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => dispatch(setSearch(e.target.value))}
              placeholder="Buscar productos…"
              aria-label="Buscar productos"
              className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-muted"
            />
          </div>

          {/* Franja de confianza */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted">
            {TRUST.map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <Icon className="h-4 w-4 text-accent-2" /> {label}
              </span>
            ))}
          </div>

          <p className="mt-5 text-xs tabular-nums text-muted">{productCount} productos disponibles</p>
        </motion.div>
      </div>
    </section>
  );
}
