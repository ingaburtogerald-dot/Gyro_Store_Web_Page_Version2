// Carrito de compras del catálogo público. Persiste en localStorage para
// sobrevivir refrescos. El checkout final se hace por WhatsApp (Fase 2).
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CartItem } from "~/types/cart";

interface CartState {
  items: CartItem[];
  isOpen: boolean;
}

const STORAGE_KEY = "gyro_cart";

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function persist(items: CartItem[]) {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

const initialState: CartState = { items: [], isOpen: false };

export function lineKey(i: Pick<CartItem, "catalogId" | "variantName" | "comboId">) {
  // Un combo es su propia línea atómica (no se fusiona con productos sueltos).
  if (i.comboId) return `combo::${i.comboId}`;
  return `${i.catalogId}::${i.variantName}`;
}

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    hydrate(state) {
      state.items = loadCart();
    },
    addItem(state, action: PayloadAction<CartItem>) {
      const existing = state.items.find((i) => lineKey(i) === lineKey(action.payload));
      if (existing) {
        existing.quantity += action.payload.quantity;
        // Refrescar metadatos por si el catálogo cambió
        existing.price = action.payload.price;
        existing.image = action.payload.image;
        existing.name = action.payload.name;
        if (action.payload.comboProducts) existing.comboProducts = action.payload.comboProducts;
      } else {
        state.items.push(action.payload);
      }
      persist(state.items);
    },
    setQuantity(state, action: PayloadAction<{ key: string; quantity: number }>) {
      const item = state.items.find((i) => lineKey(i) === action.payload.key);
      if (item) item.quantity = Math.max(1, action.payload.quantity);
      persist(state.items);
    },
    updateItem(state, action: PayloadAction<{ oldKey: string; newItem: CartItem }>) {
      const { oldKey, newItem } = action.payload;
      const index = state.items.findIndex(i => lineKey(i) === oldKey);
      if (index !== -1) {
        const newKey = lineKey(newItem);
        if (newKey !== oldKey) {
          const existingIndex = state.items.findIndex(i => lineKey(i) === newKey);
          if (existingIndex !== -1) {
            // Se fusionan cantidades si la variante nueva ya existía
            state.items[existingIndex].quantity += newItem.quantity;
            state.items.splice(index, 1);
          } else {
            state.items[index] = newItem;
          }
        } else {
          state.items[index] = newItem;
        }
        persist(state.items);
      }
    },
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => lineKey(i) !== action.payload);
      persist(state.items);
    },
    clearCart(state) {
      state.items = [];
      persist(state.items);
    },
    openCart(state) {
      state.isOpen = true;
    },
    closeCart(state) {
      state.isOpen = false;
    },
  },
});

export const { hydrate, addItem, setQuantity, updateItem, removeItem, clearCart, openCart, closeCart } =
  cartSlice.actions;
export default cartSlice.reducer;

// Selectores
export const selectCartItems = (s: { cart: CartState }) => s.cart.items;
export const selectCartCount = (s: { cart: CartState }) =>
  s.cart.items.reduce((n, i) => n + i.quantity, 0);
export const selectCartTotal = (s: { cart: CartState }) =>
  s.cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
export const selectCartOpen = (s: { cart: CartState }) => s.cart.isOpen;
