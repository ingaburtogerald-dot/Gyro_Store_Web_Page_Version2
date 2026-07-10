// Estado de UI transversal: drawers, modales, búsqueda y categoría activa del catálogo.
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// Orden de la grilla del catálogo (filtros avanzados / bottom sheet móvil).
export type CatalogSort = "relevant" | "price-asc" | "price-desc";

export interface UiState {
  search: string;
  activeCategory: string | null; // id de categoría o null = todas
  // ── Filtros avanzados del catálogo (bottom sheet móvil) ──
  priceMin: number | null;
  priceMax: number | null;
  sort: CatalogSort;
  onlyOnSale: boolean;
  onlyInStock: boolean;
  filterSheetOpen: boolean;
  sidebarOpen: boolean; // sidebar del admin en móvil (overlay)
  sidebarCollapsed: boolean; // sidebar del admin en escritorio (oculto/visible)
  activeModal: string | null;
  publicSidebarOpen: boolean; // sidebar de Amazon (público)
}

const initialState: UiState = {
  search: "",
  activeCategory: null,
  priceMin: null,
  priceMax: null,
  sort: "relevant",
  onlyOnSale: false,
  onlyInStock: false,
  filterSheetOpen: false,
  sidebarOpen: false,
  sidebarCollapsed: false,
  activeModal: null,
  publicSidebarOpen: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
    setCategory(state, action: PayloadAction<string | null>) {
      state.activeCategory = action.payload;
    },
    setPriceMin(state, action: PayloadAction<number | null>) {
      state.priceMin = action.payload;
    },
    setPriceMax(state, action: PayloadAction<number | null>) {
      state.priceMax = action.payload;
    },
    setSort(state, action: PayloadAction<CatalogSort>) {
      state.sort = action.payload;
    },
    setOnlyOnSale(state, action: PayloadAction<boolean>) {
      state.onlyOnSale = action.payload;
    },
    setOnlyInStock(state, action: PayloadAction<boolean>) {
      state.onlyInStock = action.payload;
    },
    openFilterSheet(state) {
      state.filterSheetOpen = true;
    },
    closeFilterSheet(state) {
      state.filterSheetOpen = false;
    },
    resetFilters(state) {
      state.priceMin = null;
      state.priceMax = null;
      state.sort = "relevant";
      state.onlyOnSale = false;
      state.onlyInStock = false;
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebar(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    toggleSidebarCollapsed(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
    },
    openModal(state, action: PayloadAction<string>) {
      state.activeModal = action.payload;
    },
    closeModal(state) {
      state.activeModal = null;
    },
    openPublicSidebar(state) {
      state.publicSidebarOpen = true;
    },
    closePublicSidebar(state) {
      state.publicSidebarOpen = false;
    },
  },
});

export const {
  setSearch,
  setCategory,
  setPriceMin,
  setPriceMax,
  setSort,
  setOnlyOnSale,
  setOnlyInStock,
  openFilterSheet,
  closeFilterSheet,
  resetFilters,
  toggleSidebar,
  setSidebar,
  toggleSidebarCollapsed,
  setSidebarCollapsed,
  openModal,
  closeModal,
  openPublicSidebar,
  closePublicSidebar,
} = uiSlice.actions;
export default uiSlice.reducer;

// Cantidad de filtros avanzados activos (para el badge del FAB de filtros).
export const selectActiveFilterCount = (s: { ui: UiState }) => {
  let n = 0;
  if (s.ui.priceMin != null) n++;
  if (s.ui.priceMax != null) n++;
  if (s.ui.sort !== "relevant") n++;
  if (s.ui.onlyOnSale) n++;
  if (s.ui.onlyInStock) n++;
  return n;
};
