// Convierte un combo en una línea de carrito. El combo es una línea ATÓMICA:
// `comboId` la identifica, `price` es el precio del paquete y `comboProducts`
// guarda su contenido para mostrarlo en el carrito. El servidor revalida el
// precio del combo desde Firestore al hacer checkout (nunca confía en el cliente).
import type { Combo } from "~/store/api/catalogApi";
import type { CartItem } from "~/types/cart";

export function comboToCartItem(combo: Combo): CartItem {
  return {
    // Sentinela no vacío (algún código asume catalogId truthy); el servidor usa comboId.
    catalogId: `combo:${combo.id}`,
    comboId: combo.id,
    name: combo.name,
    variantName: "Combo",
    price: combo.price,
    image: combo.products[0]?.image || "",
    quantity: 1,
    comboProducts: combo.products.map((p) => ({ name: p.name })),
  };
}
