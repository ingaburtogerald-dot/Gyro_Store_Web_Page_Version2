// Hero del catálogo: personaje protagonista (Gyro) flotando con glow pulsante,
// destellos y aurora animada; wordmark, lema y buscador.
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { setSearch } from "~/store/slices/uiSlice";

// Posición y retraso de cada destello alrededor del personaje.
const SPARKLES = [
  { top: "12%", left: "20%", size: 14, delay: "0s" },
  { top: "22%", left: "78%", size: 10, delay: "0.6s" },
  { top: "62%", left: "14%", size: 12, delay: "1.2s" },
  { top: "70%", left: "82%", size: 16, delay: "0.3s" },
  { top: "40%", left: "88%", size: 9, delay: "1.6s" },
];

export function Hero({ productCount = 0 }: { productCount?: number }) {
  const dispatch = useAppDispatch();
  const search = useAppSelector((s) => s.ui.search);

  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-12 text-center sm:pt-16">
      {/* Aurora de fondo */}
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="animate-aurora absolute left-1/4 top-0 h-[40vh] w-[40vh] -translate-x-1/2 rounded-full bg-accent blur-[120px]" />
        <div className="animate-aurora absolute right-1/4 top-10 h-[35vh] w-[35vh] translate-x-1/2 rounded-full bg-accent-2 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl">
        {/* Personaje protagonista */}
        <div className="relative mx-auto mb-6 h-44 w-44 sm:h-56 sm:w-56">
          {/* Destellos */}
          {SPARKLES.map((s, i) => (
            <span
              key={i}
              className="animate-twinkle pointer-events-none absolute text-accent-2"
              style={{ top: s.top, left: s.left, animationDelay: s.delay }}
              aria-hidden
            >
              <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" />
              </svg>
            </span>
          ))}

          <motion.img
            src="/gyro-emblem.png"
            alt="Gyro — mascota de Gyro Store"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1, y: [0, -12, 0] }}
            transition={{
              opacity: { duration: 0.5 },
              scale: { duration: 0.5 },
              y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
            }}
            className="animate-glow h-full w-full rounded-full object-cover"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <h1 className="text-4xl font-extrabold sm:text-5xl">
            <span className="bg-gradient-accent bg-clip-text text-transparent">Gyro Store</span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-muted">
            Audio y gaming de élite en Managua —{" "}
            <span className="font-semibold text-text">equípate con Gyro</span>.
          </p>

          <div className="mx-auto mt-7 flex max-w-md items-center gap-2 rounded-pill border border-border bg-surface px-4 focus-within:border-accent">
            <Search className="h-4 w-4 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => dispatch(setSearch(e.target.value))}
              placeholder="Buscar productos…"
              aria-label="Buscar productos"
              className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted"
            />
          </div>

          <p className="mt-4 text-xs text-muted">{productCount} productos disponibles</p>
        </motion.div>
      </div>
    </section>
  );
}
