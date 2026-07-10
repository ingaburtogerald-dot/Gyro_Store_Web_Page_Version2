// Hook compartido de filtrado + orden del catálogo.
//
// Antes esta lógica vivía SOLO dentro de ProductGrid. Al introducir la barra de
// herramientas (CatalogToolbar) necesitábamos el MISMO resultado filtrado en dos
// lugares (la barra muestra el conteo, la grilla renderiza). Extraerlo aquí evita
// duplicar reglas y garantiza que el conteo de la toolbar y la grilla nunca se
// desincronicen. Los filtros se leen del uiSlice (Redux) → única fuente de verdad.
import { useMemo } from "react";
import type { CatalogProduct } from "~/store/api/catalogApi";
import { useAppSelector } from "~/store/hooks";

export const isDeal = (p: CatalogProduct) =>
  Boolean(p.isPromo) || (p.compareAtPrice ?? 0) > p.price;

export interface CatalogFilterResult {
  /** Productos tras aplicar categoría + búsqueda + precio + toggles + orden. */
  filtered: CatalogProduct[];
  /** true cuando no hay ningún filtro/búsqueda activos (vista home segmentada). */
  isDefault: boolean;
}

export function useCatalogFilter(products: CatalogProduct[]): CatalogFilterResult {
  const category = useAppSelector((s) => s.ui.activeCategory);
  const search = useAppSelector((s) => s.ui.search).trim().toLowerCase();
  const priceMin = useAppSelector((s) => s.ui.priceMin);
  const priceMax = useAppSelector((s) => s.ui.priceMax);
  const sort = useAppSelector((s) => s.ui.sort);
  const onlyOnSale = useAppSelector((s) => s.ui.onlyOnSale);
  const onlyInStock = useAppSelector((s) => s.ui.onlyInStock);

  const isDefault =
    !category && !search && priceMin == null && priceMax == null && !onlyInStock && !onlyOnSale;

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

  return { filtered, isDefault };
}
