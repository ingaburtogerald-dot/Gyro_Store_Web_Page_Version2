// Sección "Nuestras Marcas" — dirección editorial: wordmarks tipográficos en fila,
// sin contenedores circulares ni glow. El nombre va en tinta muted y se enciende al
// hover; si hay un logo real en /public, se muestra en escala de grises → color al hover.
//
// ⚠️ DATOS: el catálogo aún no tiene un campo de marcas. `STORE_BRANDS` es un
// PLACEHOLDER editable — reemplázalo con tus marcas reales (+ logos opcionales en
// /public/brands). Si la lista queda vacía, la sección no se renderiza.
import { motion, useReducedMotion } from "framer-motion";

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

export function BrandStrip({ brands = STORE_BRANDS }: { brands?: Brand[] }) {
  const reduce = useReducedMotion();
  if (!brands.length) return null;

  return (
    <section aria-label="Nuestras marcas" className="border-t border-white/5 pt-10">
      {/* Etiqueta editorial fina (una, deliberada) en vez de un título card-y. */}
      <p className="mb-6 text-xs font-medium uppercase tracking-[0.22em] text-muted">
        Nuestras marcas
      </p>

      <ul className="flex flex-wrap items-center gap-x-8 gap-y-4 sm:gap-x-14">
        {brands.map((brand, i) => (
          <motion.li
            key={brand.name}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: (i % 8) * 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            {brand.logo ? (
              <img
                src={brand.logo}
                alt={brand.name}
                loading="lazy"
                className="ease-expo h-7 w-auto opacity-55 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0 sm:h-8"
              />
            ) : (
              <span className="ease-expo font-heading text-2xl font-bold tracking-tight text-muted transition-colors duration-300 hover:text-text sm:text-[1.75rem]">
                {brand.name}
              </span>
            )}
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
