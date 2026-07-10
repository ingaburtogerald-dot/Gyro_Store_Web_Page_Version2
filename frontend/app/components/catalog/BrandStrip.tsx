// Sección "Nuestras Marcas" — marquee horizontal infinito con píldoras de vidrio.
// El contenido se duplica en el DOM y se anima -50% para un loop perfecto; se pausa
// al pasar el mouse y respeta prefers-reduced-motion (cae a una fila estática con
// wrap). Máscara de desvanecido en ambos bordes para un acabado premium.
//
// ⚠️ DATOS: el catálogo aún no tiene un campo de marcas. `STORE_BRANDS` es un
// PLACEHOLDER editable — reemplázalo con tus marcas reales (+ logos opcionales en
// /public/brands). Si la lista queda vacía, la sección no se renderiza.
import { useReducedMotion } from "framer-motion";

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

function BrandPill({ brand, ariaHidden }: { brand: Brand; ariaHidden?: boolean }) {
  return (
    <li className="shrink-0" aria-hidden={ariaHidden}>
      <div className="pill-glass ease-expo group/pill flex h-12 items-center gap-2 rounded-pill px-6 transition-colors duration-300 hover:border-accent/40">
        {brand.logo ? (
          <img
            src={brand.logo}
            alt={brand.name}
            loading="lazy"
            className="ease-expo h-6 w-auto opacity-70 grayscale transition duration-300 group-hover/pill:opacity-100 group-hover/pill:grayscale-0"
          />
        ) : (
          <span className="ease-expo font-heading text-lg font-bold tracking-tight text-muted transition-colors duration-300 group-hover/pill:text-text">
            {brand.name}
          </span>
        )}
      </div>
    </li>
  );
}

export function BrandStrip({ brands = STORE_BRANDS }: { brands?: Brand[] }) {
  const reduce = useReducedMotion();
  if (!brands.length) return null;

  // Ritmo del loop proporcional a la cantidad de marcas (más marcas → más lento).
  const duration = `${Math.max(24, brands.length * 6)}s`;

  return (
    <section aria-label="Nuestras marcas" className="border-t border-white/5 pt-10">
      {/* Etiqueta editorial fina (una, deliberada) en vez de un título card-y. */}
      <p className="mb-6 text-xs font-medium uppercase tracking-[0.22em] text-muted">
        Nuestras marcas
      </p>

      {reduce ? (
        // Sin movimiento: fila estática con wrap (accesible).
        <ul className="flex flex-wrap items-center gap-3">
          {brands.map((brand) => (
            <BrandPill key={brand.name} brand={brand} />
          ))}
        </ul>
      ) : (
        <div className="group/marquee marquee-mask relative overflow-hidden">
          {/* Duplicamos la lista (aria-hidden en la copia) para el loop continuo. */}
          <ul
            className="animate-marquee flex w-max items-center gap-3"
            style={{ ["--marquee-duration" as string]: duration }}
          >
            {brands.map((brand) => (
              <BrandPill key={brand.name} brand={brand} />
            ))}
            {/* Copia visual para el loop; oculta a lectores de pantalla. */}
            {brands.map((brand) => (
              <BrandPill key={`dup-${brand.name}`} brand={brand} ariaHidden />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
