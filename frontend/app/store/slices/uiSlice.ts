// Estado de UI transversal: drawers, modales, búsqueda y categoría activa del catálogo.
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface UiState {
  search: string;
  activeCategory: string | null; // id de categoría o null = todas
  sidebarOpen: boolean; // sidebar del admin en móvil (overlay)
  sidebarCollapsed: boolean; // sidebar del admin en escritorio (oculto/visible)
  activeModal: string | null;
}

const initialState: UiState = {
  search: "",
  activeCategory: null,
  sidebarOpen: false,
  sidebarCollapsed: false,
  activeModal: null,
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
  },
});

export const {
  setSearch,
  setCategory,
  toggleSidebar,
  setSidebar,
  toggleSidebarCollapsed,
  setSidebarCollapsed,
  openModal,
  closeModal,
} = uiSlice.actions;
export default uiSlice.reducer;
