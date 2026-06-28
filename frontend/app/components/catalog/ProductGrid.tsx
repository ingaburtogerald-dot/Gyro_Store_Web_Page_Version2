// Grid de productos del catálogo. Aplica el filtro de categoría (servidor) y la
// búsqueda por texto (cliente). Muestra skeletons mientras carga y un estado vacío.
import { useMemo } from "react";
import { PackageSearch } from "lucide-react";
import { ProductCardMobile } from "./ProductCardMobile";
import { ProductCardSkeleton } from "./ProductCardSkeleton";
import { useGetCatalogQuery, useGetConfigQuery } from "~/store/api/catalogApi";
import { useAppSelector } from "~/store/hooks";

export function ProductGrid() {
  const category = useAppSelector((s) => s.ui.activeCategory);
  const search = useAppSelector((s) => s.ui.search).trim().toLowerCase();
  const priceMin = useAppSelector((s) => s.ui.priceMin);
  const priceMax = useAppSelector((s) => s.ui.priceMax);
  const sort = useAppSelector((s) => s.ui.sort);
  const onlyOnSale = useAppSelector((s) => s.ui.onlyOnSale);
  const onlyInStock = useAppSelector((s) => s.ui.onlyInStock);

  const { data: config } = useGetConfigQuery();
  const { data: products, isLoading, isError } = useGetCatalogQuery(
    category ? { category } : undefined,
  );

  // Filtros en cliente (búsqueda + filtros avanzados del bottom sheet) y orden.
  const filtered = useMemo(() => {
    if (!products) return [];
    const result = products.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search)) return false;
      if (priceMin != null && p.price < priceMin) return false;
      if (priceMax != null && p.price > priceMax) return false;
      if (onlyInStock && (p.stock ?? 0) <= 0) return false;
      if (onlyOnSale && !((p.compareAtPrice ?? 0) > p.price)) return false;
      return true;
    });
    if (sort === "price-asc") result.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") result.sort((a, b) => b.price - a.price);
    return result;
  }, [products, search, priceMin, priceMax, onlyInStock, onlyOnSale, sort]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 pb-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return <EmptyState text="No se pudo cargar el catálogo. Intenta de nuevo." />;
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        text={
          search || category
            ? "No hay productos que coincidan con tu búsqueda."
            : "Aún no hay productos publicados."
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 pb-8 sm:grid-cols-3 lg:grid-cols-4">
      {filtered.map((p) => (
        <ProductCardMobile key={p.id} product={p} categories={config?.categories ?? []} />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border py-16 text-center text-muted">
      <PackageSearch className="h-8 w-8" />
      <p className="max-w-xs text-sm">{text}</p>
    </div>
  );
}
