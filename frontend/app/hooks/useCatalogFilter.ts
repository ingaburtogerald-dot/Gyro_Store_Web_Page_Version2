// Hook compartido de filtrado + orden del catálogo.
//
// Antes esta lógica vivía SOLO dentro de ProductGrid. Al introducir la barra de
// herramientas (CatalogToolbar) necesitábamos el MISMO resultado filtrado en dos
// lugares (la barra muestra el conteo, la grilla renderiza). Extraerlo aquí evita
// duplicar reglas y garantiza que el conteo de la toolbar y la grilla nunca se
// desincronicen. Los filtros se leen del uiSlice (Redux) → única fuente de verdad.
//
// BÚSQUEDA DIFUSA: la coincidencia por texto usa Fuse.js (algoritmo Bitap) en vez
// de un `includes` exacto, para tolerar erratas ("audifno" → "audífono") y buscar
// por categoría. Peso alto al nombre, medio a la categoría. Todo en el cliente
// (costo $0): el índice se arma sobre el catálogo que ya se descargó.
import { useMemo } from "react";
import Fuse from "fuse.js";
import type { CatalogProduct } from "~/store/api/catalogApi";
import { useGetConfigQuery } from "~/store/api/catalogApi";
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
  const { data: config } = useGetConfigQuery();
  const baseCategories = config?.categories || [];

  const categoryNameById = useMemo(() => {
    return new Map(baseCategories.map((c) => [c.id, c.name]));
  }, [baseCategories]);

  const category = useAppSelector((s) => s.ui.activeCategory);
  const search = useAppSelector((s) => s.ui.search).trim();
  const priceMin = useAppSelector((s) => s.ui.priceMin);
  const priceMax = useAppSelector((s) => s.ui.priceMax);
  const sort = useAppSelector((s) => s.ui.sort);
  const onlyOnSale = useAppSelector((s) => s.ui.onlyOnSale);
  const onlyInStock = useAppSelector((s) => s.ui.onlyInStock);

  const isDefault =
    !category && !search && priceMin == null && priceMax == null && !onlyInStock && !onlyOnSale;

  // Índice de búsqueda difusa. Se reconstruye solo cuando cambia el catálogo
  // (products viene del cache de RTK Query, así que en la práctica se arma una vez).
  const fuse = useMemo(() => {
    const docs = products.map((p) => ({
      product: p,
      name: p.name,
      category: categoryNameById.get(p.category) ?? p.category,
    }));
    return new Fuse(docs, {
      keys: [
        { name: "name", weight: 0.7 },
        { name: "category", weight: 0.3 },
      ],
      threshold: 0.25, // más estricto que antes (0.35): menos falsos positivos, conserva algo de tolerancia a erratas
      ignoreLocation: true, // el término puede estar en cualquier parte del texto
      minMatchCharLength: 2,
      // useExtendedSearch: el tokenizer de Fuse ya separa la query por espacios y
      // exige que TODAS las palabras aparezcan (AND), cada una con coincidencia
      // difusa independiente — resuelve "zapatos rojos" sin perder tolerancia a
      // erratas por palabra (no hace falta prefijar con ' — eso forzaría substring
      // exacto y anularía la tolerancia a errores de tipeo).
      useExtendedSearch: true,
    });
  }, [products, categoryNameById]);

  const filtered = useMemo(() => {
    // 1. Conjunto base: con búsqueda → orden por relevancia difusa; sin búsqueda →
    //    el catálogo en su orden natural.
    const base = search ? fuse.search(search).map((r) => r.item.product) : products;

    // 2. Resto de filtros (categoría, precio, toggles) sobre ese conjunto.
    const result = base.filter((p) => {
      if (category && p.category !== category) return false;
      if (priceMin != null && p.price < priceMin) return false;
      if (priceMax != null && p.price > priceMax) return false;
      if (onlyInStock && (p.stock ?? 0) <= 0) return false;
      if (onlyOnSale && !((p.compareAtPrice ?? 0) > p.price)) return false;
      return true;
    });

    // 3. Orden por precio (si se eligió) → sobreescribe la relevancia difusa.
    if (sort === "price-asc") result.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") result.sort((a, b) => b.price - a.price);
    return result;
  }, [products, fuse, category, search, priceMin, priceMax, onlyInStock, onlyOnSale, sort]);

  return { filtered, isDefault };
}
