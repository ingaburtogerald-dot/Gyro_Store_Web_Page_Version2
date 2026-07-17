// Árbol de categorías del storefront. FUENTE ÚNICA DE VERDAD compartida por el
// loader de la home (SSR) y el rail unificado (cliente), para que ambos hablen el
// mismo idioma. El `id` de cada categoría DEBE ser el valor real de `product.category`
// que devuelve la API; así el chip activo, las subcategorías y el filtro de la grilla
// coinciden (antes ids inventados no casaban con productos → filtros vacíos).
import type { CatalogProduct, Category } from "~/store/api/catalogApi";

// Valores reales actuales en la API: audifonos-kz, adaptador-bt, accesorios-pc, …
export const BASE_CATEGORIES: { id: string; name: string }[] = [
  { id: "audifonos-kz", name: "Audífonos In Ear" },
  { id: "accesorios-kz", name: "Accesorios para audífonos KZ" },
  { id: "adaptador-bt", name: "Adaptador Bluetooth para audífonos KZ" },
  { id: "accesorios-pc", name: "Accesorios Para computadores" },
  { id: "accesorios-moto", name: "Accesorios Para moto" },
  { id: "accesorios-gaming", name: "Accesorios para gaming variados" },
];

// Subcategorías = productos cuya `category` coincide con el id (o nombre) de la
// categoría. Se ocultan las categorías sin productos: nada que mostrar ni filtrar.
export function buildCategoryTree(products: CatalogProduct[]): Category[] {
  return BASE_CATEGORIES.map((cat) => {
    const catProducts = products.filter((p) => p.category === cat.id || p.category === cat.name);
    return {
      ...cat,
      subcategories: catProducts.length > 0 ? catProducts.map((p) => ({ id: p.id, name: p.name })) : undefined,
    };
  }).filter((cat) => cat.subcategories) as Category[];
}
