// Precio compartido de las páginas de detalle. Un solo tratamiento: acento + glow
// sutil (estático, sin parpadeo). El glow anterior del producto usaba
// `rgba(var(--color-accent),.4)` = CSS inválido (el token es hex) → no se veía;
// aquí se usa color-mix, que sí resuelve.
import { formatCordobas } from "~/lib/utils";
import { motion } from "framer-motion";
import { itemFade } from "~/lib/detailMotion";

const PRICE_GLOW = "0 0 18px color-mix(in srgb, var(--color-accent) 32%, transparent)";

export type PricePill = { text: string; tone: "save" | "sale" };

export function DetailPrice({
  price,
  compareAt,
  pill,
}: {
  price: number;
  compareAt?: number | null;
  pill?: PricePill | null;
}) {
  return (
    <motion.div variants={itemFade} className="mt-5 flex flex-wrap items-baseline gap-4">
      <p
        className="font-heading text-3xl sm:text-[clamp(2.5rem,6vw,3rem)] font-extrabold tabular-nums leading-none text-accent"
        style={{ textShadow: PRICE_GLOW }}
      >
        {formatCordobas(price)}
      </p>
      {compareAt ? (
        <span className="text-base sm:text-lg text-muted line-through">{formatCordobas(compareAt)}</span>
      ) : null}
      {pill ? (
        pill.tone === "save" ? (
          <span className="rounded-pill bg-whatsapp/12 px-2.5 py-1 text-[11px] sm:text-xs font-semibold tabular-nums tracking-wide text-whatsapp">
            {pill.text}
          </span>
        ) : (
          <span className="rounded-pill bg-bg/70 px-2.5 py-1 text-[11px] sm:text-xs font-semibold tracking-wide text-accent-2 ring-1 ring-white/10 backdrop-blur-md">
            {pill.text}
          </span>
        )
      ) : null}
    </motion.div>
  );
}
