export interface CartItem {
  catalogId: string;
  variantId?: string; // id del producto físico (para recalcular precio en el servidor)
  name: string;
  variantName: string;
  price: number; // precio unitario en C$ (solo para mostrar; el servidor recalcula)
  image: string;
  quantity: number;
  // ── Líneas de combo ──
  // Si `comboId` está presente, esta línea es un paquete (no un producto suelto):
  // `price` es el precio del combo y `comboProducts` lista su contenido para el UI.
  // El servidor recalcula el precio del combo desde Firestore en el checkout.
  comboId?: string;
  comboProducts?: { name: string }[];
}
