// Grid de productos del catálogo. Los productos llegan por props desde el loader
// SSR de la ruta (_index). El filtrado (categoría, búsqueda, precio, oferta, stock)
// y el orden se hacen en cliente sobre esa lista, usando el estado de UI de Redux.
//
// Vista por DEFECTO (sin filtros ni búsqueda): se segmenta en secciones estilo
// tienda — "SuperOfertas" (ofertas reales) y luego el catálogo completo. Al buscar
// o filtrar, colapsa a una única grilla de resultados (sin encabezados de sección).
import { PackageSearch, Flame, LayoutGrid } from "lucide-react";
import { ProductCard } from "~/components/product/ProductCard";
import type { CatalogProduct, Category } from "~/store/api/catalogApi";
import { useCatalogFilter, isDeal } from "~/lib/useCatalogFilter";
import { useSearchTelemetry } from "~/hooks/useSearchTelemetry";
import { logResultClick } from "~/lib/searchTelemetry";
import { useAppSelector } from "~/store/hooks";
import { cn } from "~/lib/utils";

// Regla determinista de tiles ANCHOS para romper la grilla uniforme (ver Bento):
//  · El primero abre como pieza destacada (editorial horizontal).
//  · Las ofertas se ganan un tile ancho.
// Es determinista → sobrevive al filtrado sin verse aleatorio, y solo activa la
// asimetría cuando hay suficientes ítems para que no quede un tile ancho solitario.
const catalogWide =
  (total: number) =>
  (p: CatalogProduct, i: number): boolean => {
    if (total < 4) return false;
    if (i === 0) return true;
    if (isDeal(p)) return true;
    return i > 0 && i % 5 === 0;
  };

export function ProductGrid({ products, categories }: { products: CatalogProduct[]; categories: Category[] }) {
  // Filtrado + orden compartidos con la toolbar (una sola fuente de verdad).
  const { filtered, isDefault } = useCatalogFilter(products);

  // Telemetría: registra la búsqueda activa (con debounce) junto con cuántos
  // resultados arrojó — así el dashboard sabe qué se busca y qué NO tiene resultados.
  useSearchTelemetry(filtered.length);

  // Búsqueda activa → para atribuir el clic en un resultado (CTR).
  const search = useAppSelector((s) => s.ui.search).trim();

  // ── Vista segmentada (home por defecto): SuperOfertas + Catálogo ──
  if (isDefault) {
    const deals = filtered.filter(isDeal);
    const rest = filtered.filter((p) => !isDeal(p));
    if (filtered.length === 0) return <EmptyState text="Aún no hay productos publicados." />;

    return (
      <div className="space-y-10 pb-12">
        {deals.length > 0 && (
          <section>
            <SectionHeader
              icon={<Flame className="h-4 w-4" />}
              title="SuperOfertas"
              subtitle="Precios rebajados por tiempo limitado"
              count={deals.length}
              tone="deal"
            />
            {/* Las ofertas van como tarjetas verticales uniformes (fila destacada). */}
            <Bento products={deals} categories={categories} wideFn={() => false} />
          </section>
        )}

        <section>
          <SectionHeader
            icon={<LayoutGrid className="h-4 w-4" />}
            title="Todo el catálogo"
            subtitle="Explora todos nuestros productos"
            count={rest.length}
          />
          <Bento products={rest} categories={categories} wideFn={catalogWide(rest.length)} />
        </section>
      </div>
    );
  }

  // ── Vista de resultados (búsqueda / filtros): grilla plana ──
  if (filtered.length === 0) {
    return <EmptyState text="No hay productos que coincidan con tu búsqueda." />;
  }
  return (
    <div className="pb-12">
      <Bento
        products={filtered}
        categories={categories}
        wideFn={catalogWide(filtered.length)}
        onProductClick={search ? (id) => logResultClick(search, id) : undefined}
      />
    </div>
  );
}

// Bento asimétrico: ciertos productos se vuelven tiles ANCHOS (2 columnas,
// disposición horizontal editorial). Con `grid-auto-flow: dense` el resto se
// acomoda sin huecos. Es determinista → sobrevive al filtrado sin verse aleatorio.
//  · El primero abre como pieza destacada.
//  · Las ofertas se llevan un tile ancho (se ganan la prominencia).
//  · Un ritmo posicional añade variedad cuando no hay ofertas.
// `wideFn` permite desactivar los tiles anchos (p. ej. la fila de SuperOfertas,
// donde todas serían anchas y saturarían).
function Bento({
  products,
  categories,
  wideFn,
  onProductClick,
}: {
  products: CatalogProduct[];
  categories: Category[];
  wideFn?: (p: CatalogProduct, i: number) => boolean;
  /** Se dispara al hacer clic en una tarjeta (usado para atribuir CTR de búsqueda). */
  onProductClick?: (id: string) => void;
}) {
  const isWide = wideFn ?? (() => false);
  return (
    <div className="grid grid-cols-2 gap-4 [grid-auto-flow:dense] sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p, i) => {
        const wide = isWide(p, i);
        return (
          <div
            key={p.id}
            className={cn(wide && "col-span-2")}
            onClick={onProductClick ? () => onProductClick(p.id) : undefined}
          >
            <ProductCard product={p} categories={categories} layout={wide ? "list" : "grid"} index={i} />
          </div>
        );
      })}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  count,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  count?: number;
  tone?: "neutral" | "deal";
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
          tone === "deal" ? "bg-warning/15 text-warning" : "bg-accent/12 text-accent-2",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h2 className="font-heading text-xl font-bold tracking-tight text-text sm:text-2xl">{title}</h2>
          {count != null && (
            <span className="text-sm font-medium tabular-nums text-muted">{count}</span>
          )}
        </div>
        {subtitle && <p className="text-sm font-light text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="card-premium flex flex-col items-center gap-4 rounded-card py-20 text-center">
      <span
        className="relative grid h-16 w-16 place-items-center rounded-2xl bg-accent/8 text-accent-2 ring-1 ring-inset ring-accent/15"
        aria-hidden
      >
        {/* Halo suave detrás del icono para darle profundidad. */}
        <span className="absolute inset-0 rounded-2xl bg-accent/10 blur-xl" />
        <PackageSearch className="relative h-7 w-7" />
      </span>
      <p className="max-w-xs text-balance text-sm text-muted">{text}</p>
    </div>
  );
}
