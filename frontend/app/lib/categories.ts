// Árbol de categorías del storefront. FUENTE ÚNICA DE VERDAD compartida por el
// loader de la home (SSR) y el rail unificado (cliente), para que ambos hablen el
// mismo idioma. El `id` de cada categoría DEBE ser el valor real de `product.category`
// que devuelve la API; así el chip activo, las subcategorías y el filtro de la grilla
// coinciden (antes ids inventados no casaban con productos → filtros vacíos).
import type { CatalogProduct, Category } from "~/types/catalog";

// Subcategorías = productos cuya `category` coincide con el id (o nombre) de la
// categoría. Se ocultan las categorías sin productos: nada que mostrar ni filtrar.
export function buildCategoryTree(
  products: CatalogProduct[],
  baseCategories: { id: string; name: string; icon?: string }[]
): Category[] {
  return baseCategories.map((cat) => {
    const catProducts = products.filter((p) => p.category === cat.id || p.category === cat.name);
    return {
      ...cat,
      subcategories: catProducts.length > 0 ? catProducts.map((p) => ({ id: p.id, name: p.name })) : undefined,
    };
  }).filter((cat) => cat.subcategories) as Category[];
}
