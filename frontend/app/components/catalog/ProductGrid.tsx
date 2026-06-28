// Grid de productos del catálogo. Los productos llegan por props desde el loader
// SSR de la ruta (_index). El filtrado (categoría, búsqueda, precio, oferta, stock)
// y el orden se hacen en cliente sobre esa lista, usando el estado de UI de Redux.
import { useMemo } from "react";
import { PackageSearch } from "lucide-react";
import { ProductCardMobile } from "./ProductCardMobile";
import { useGetConfigQuery, type CatalogProduct } from "~/store/api/catalogApi";
import { useAppSelector } from "~/store/hooks";

export function ProductGrid({ products }: { products: CatalogProduct[] }) {
  const category = useAppSelector((s) => s.ui.activeCategory);
  const search = useAppSelector((s) => s.ui.search).trim().toLowerCase();
  const priceMin = useAppSelector((s) => s.ui.priceMin);
  const priceMax = useAppSelector((s) => s.ui.priceMax);
  const sort = useAppSelector((s) => s.ui.sort);
  const onlyOnSale = useAppSelector((s) => s.ui.onlyOnSale);
  const onlyInStock = useAppSelector((s) => s.ui.onlyInStock);

  const { data: config } = useGetConfigQuery();

  // Filtros en cliente (categoría + búsqueda + filtros avanzados) y orden.
  const filtered = useMemo(() => {
    const result = products.filter((p) => {
      if (category && p.category !== category) return false;
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
  }, [products, category, search, priceMin, priceMax, onlyInStock, onlyOnSale, sort]);

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
