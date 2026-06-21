// Grid de productos del catálogo. Aplica el filtro de categoría (servidor) y la
// búsqueda por texto (cliente). Muestra skeletons mientras carga y un estado vacío.
import { useMemo } from "react";
import { PackageSearch } from "lucide-react";
import { ProductCard } from "./ProductCard";
import { useGetCatalogQuery, useGetConfigQuery } from "~/store/api/catalogApi";
import { useAppSelector } from "~/store/hooks";

export function ProductGrid() {
  const category = useAppSelector((s) => s.ui.activeCategory);
  const search = useAppSelector((s) => s.ui.search).trim().toLowerCase();

  const { data: config } = useGetConfigQuery();
  const { data: products, isLoading, isError } = useGetCatalogQuery(
    category ? { category } : undefined,
  );

  const filtered = useMemo(() => {
    if (!products) return [];
    if (!search) return products;
    return products.filter((p) => p.name.toLowerCase().includes(search));
  }, [products, search]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 pb-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductSkeleton key={i} />
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
        <ProductCard key={p.id} product={p} categories={config?.categories ?? []} />
      ))}
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="animate-pulse rounded-card border border-border bg-surface p-3">
      <div className="aspect-square rounded-xl bg-surface-2" />
      <div className="mt-3 h-4 w-3/4 rounded bg-surface-2" />
      <div className="mt-2 h-4 w-1/3 rounded bg-surface-2" />
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
