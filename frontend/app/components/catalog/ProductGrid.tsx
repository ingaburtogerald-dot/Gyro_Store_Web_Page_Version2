// Grid de productos del catálogo. Los productos llegan por props desde el loader
// SSR de la ruta (_index). El filtrado (categoría, búsqueda, precio, oferta, stock)
// y el orden se hacen en cliente sobre esa lista, usando el estado de UI de Redux.
import { useMemo } from "react";
import { PackageSearch } from "lucide-react";
import { ProductCard } from "./ProductCard";
import type { CatalogProduct, Category } from "~/store/api/catalogApi";
import { useAppSelector } from "~/store/hooks";
import { cn } from "~/lib/utils";

export function ProductGrid({ products, categories }: { products: CatalogProduct[]; categories: Category[] }) {
  const category = useAppSelector((s) => s.ui.activeCategory);
  const search = useAppSelector((s) => s.ui.search).trim().toLowerCase();
  const priceMin = useAppSelector((s) => s.ui.priceMin);
  const priceMax = useAppSelector((s) => s.ui.priceMax);
  const sort = useAppSelector((s) => s.ui.sort);
  const onlyOnSale = useAppSelector((s) => s.ui.onlyOnSale);
  const onlyInStock = useAppSelector((s) => s.ui.onlyInStock);

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

  // Bento asimétrico: ciertos productos se vuelven tiles ANCHOS (2 columnas,
  // disposición horizontal editorial). Con `grid-auto-flow: dense` el resto se
  // acomoda sin huecos. Es determinista → sobrevive al filtrado sin verse aleatorio.
  //  · El primero abre como pieza destacada.
  //  · Las ofertas se llevan un tile ancho (se ganan la prominencia).
  //  · Un ritmo posicional añade variedad cuando no hay ofertas.
  const isWide = (p: CatalogProduct, i: number) => {
    const deal = p.isPromo || (p.compareAtPrice ?? 0) > p.price;
    return i === 0 || deal || i % 9 === 7;
  };

  return (
    <div className="grid grid-cols-2 gap-4 pb-12 [grid-auto-flow:dense] sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
      {filtered.map((p, i) => {
        const wide = isWide(p, i);
        return (
          <div key={p.id} className={cn(wide && "col-span-2")}>
            <ProductCard
              product={p}
              categories={categories}
              layout={wide ? "list" : "grid"}
              index={i}
            />
          </div>
        );
      })}
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
