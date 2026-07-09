// Sección "Nuestras Marcas": fila de badges circulares (logo real o monograma
// como fallback), con scroll horizontal en móvil. Piel midnight del storefront.
//
// ⚠️ DATOS: el catálogo aún no tiene un campo de marcas ni logos. La lista de
// abajo es un PLACEHOLDER editable — reemplaza `STORE_BRANDS` con tus marcas
// reales y (opcional) la ruta a cada logo en /public. Si `logo` está vacío, se
// muestra un monograma con las iniciales. Si la lista queda vacía, la sección
// no se renderiza.
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "~/lib/utils";

export interface Brand {
  name: string;
  /** Ruta a un logo en /public (p. ej. "/brands/kz.png"). Opcional. */
  logo?: string;
  /** Filtra/enlaza al buscar por marca (opcional; hoy solo decorativo). */
  href?: string;
}

// TODO: reemplazar con las marcas reales de Gyro Store (+ logos en /public/brands).
export const STORE_BRANDS: Brand[] = [
  { name: "KZ" },
  { name: "TRN" },
  { name: "CCA" },
  { name: "Baseus" },
  { name: "UGREEN" },
  { name: "Redragon" },
];

// Paleta categórica tokenizada para los monogramas (variedad sin colores crudos).
const TONES = [
  "bg-accent/12 text-accent-2",
  "bg-tone-indigo/15 text-tone-indigo",
  "bg-tone-purple/15 text-tone-purple",
  "bg-warning/15 text-warning",
  "bg-info/15 text-info",
  "bg-tone-rose/15 text-tone-rose",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function BrandStrip({ brands = STORE_BRANDS }: { brands?: Brand[] }) {
  const reduce = useReducedMotion();
  if (!brands.length) return null;

  return (
    <section aria-label="Nuestras marcas" className="pt-8">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-xl font-bold tracking-tight text-text sm:text-2xl">
          Nuestras Marcas
        </h2>
      </div>

      <ul
        className={cn(
          "flex snap-x gap-3 overflow-x-auto pb-2 sm:gap-5",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {brands.map((brand, i) => (
          <motion.li
            key={brand.name}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: (i % 8) * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="flex shrink-0 snap-start flex-col items-center gap-2"
          >
            <div
              className={cn(
                "ease-expo grid h-20 w-20 place-items-center overflow-hidden rounded-full border border-border",
                "bg-white/[0.04] backdrop-blur-md transition duration-300 sm:h-24 sm:w-24",
                "hover:-translate-y-1 hover:border-accent/40 hover:shadow-accent-soft",
              )}
            >
              {brand.logo ? (
                <img
                  src={brand.logo}
                  alt={brand.name}
                  loading="lazy"
                  className="h-full w-full object-contain p-3"
                />
              ) : (
                <span
                  className={cn(
                    "grid h-full w-full place-items-center font-heading text-lg font-extrabold tracking-tight sm:text-xl",
                    TONES[i % TONES.length],
                  )}
                >
                  {initials(brand.name)}
                </span>
              )}
            </div>
            <span className="max-w-[6rem] truncate text-center text-xs font-medium text-muted">
              {brand.name}
            </span>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
