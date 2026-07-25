// API del catálogo y configuración pública (no requiere auth).
// En esta fase solo expone la config de negocio; los endpoints de productos
// del catálogo se agregan en la Fase 2.
import { baseApi } from "./baseApi";
import type { CatalogProduct, Category, VolumeDiscount, BusinessConfig, SpecRow, DiscountTier, PublicCombo, HeroSlide, LandingConfig, TemplateAxis, Template, VariantMapping, VariantMappings, CatalogVariant, CatalogDetail, ComboProduct, Combo, ComboInput, TemplateInput, InventorySku, CatalogItemInput } from "~/types/catalog";
export type { CatalogProduct, Category, VolumeDiscount, BusinessConfig, SpecRow, DiscountTier, PublicCombo, HeroSlide, LandingConfig, TemplateAxis, Template, VariantMapping, VariantMappings, CatalogVariant, CatalogDetail, ComboProduct, Combo, ComboInput, TemplateInput, InventorySku, CatalogItemInput };
// Lectura tolerante con datos viejos ({ skus:[...] } | { sku }) durante la migración.
export function variantSku(entry?: VariantMapping | { sku?: string; skus?: string[] }): string {
  if (!entry) return "";
  if (typeof entry.sku === "string" && entry.sku) return entry.sku;
  const legacy = (entry as { skus?: string[] }).skus;
  if (Array.isArray(legacy)) return legacy[0] ?? "";
  return "";
}

export function variantSkus(entry?: VariantMapping | { sku?: string; skus?: string[] }): string[] {
  if (!entry) return [];
  const legacy = (entry as { skus?: string[] }).skus;
  if (Array.isArray(legacy) && legacy.length > 0) return legacy;
  if (typeof entry.sku === "string" && entry.sku) return [entry.sku];
  return [];
}
export function variantPrice(entry?: VariantMapping): number | undefined {
  return typeof entry?.price === "number" && entry.price > 0 ? entry.price : undefined;
}


export const catalogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getConfig: build.query<BusinessConfig, void>({
      query: () => "/config",
      providesTags: ["Config"],
    }),
    updateCategories: build.mutation<{ ok: boolean; categories: Category[] }, Category[]>({
      query: (categories) => ({ url: "/config/categories", method: "PUT", body: { categories } }),
      invalidatesTags: ["Config"],
    }),

    // ── Landing editable (Hero + orden del header) ──
    getLandingConfig: build.query<LandingConfig, void>({
      query: () => "/config/landing_page",
      providesTags: ["Landing"],
    }),
    updateLandingConfig: build.mutation<LandingConfig & { ok: boolean }, LandingConfig>({
      query: (body) => ({ url: "/config/landing_page", method: "PUT", body }),
      invalidatesTags: ["Landing"],
    }),
    // Sube la media de un slide a R2. `body` = FormData con `file` y `slideId`.
    uploadHeroSlide: build.mutation<{ ok: boolean; url: string; mediaType: "image" | "video" }, FormData>({
      query: (body) => ({ url: "/config/hero-slide", method: "POST", body }),
    }),
    getCatalog: build.query<CatalogProduct[], { category?: string; promo?: boolean } | void>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args && args.category) params.set("category", args.category);
        if (args && args.promo) params.set("promo", "true");
        const qs = params.toString();
        return `/catalog${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Catalog"],
    }),
    getCatalogItem: build.query<CatalogDetail, string>({
      query: (id) => `/catalog/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Catalog", id }],
    }),

    // Telemetría real de búsqueda (30 días, cacheada 1h en el servidor): ids de
    // producto más vistos/clicados + términos más buscados. Alimenta el panel de
    // recomendaciones del buscador del header (SearchBar) con datos reales en vez
    // de placeholders.
    getPopularSearch: build.query<{ productIds: string[]; terms: string[] }, void>({
      query: () => "/search-events/popular",
    }),

    // ── Admin (modo edición) ──
    getAdminCatalog: build.query<CatalogProduct[], void>({
      query: () => "/catalog?all=true",
      providesTags: ["Catalog"],
    }),
    createCatalogItem: build.mutation<CatalogProduct, CatalogItemInput>({
      query: (body) => ({ url: "/catalog", method: "POST", body }),
      invalidatesTags: ["Catalog"],
    }),
    updateCatalogItem: build.mutation<CatalogProduct, { id: string; body: CatalogItemInput }>({
      query: ({ id, body }) => ({ url: `/catalog/${id}`, method: "PUT", body }),
      invalidatesTags: ["Catalog"],
    }),
    deleteCatalogItem: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/catalog/${id}`, method: "DELETE" }),
      invalidatesTags: ["Catalog"],
    }),
    togglePromo: build.mutation<{ ok: boolean }, { id: string; isPromo: boolean }>({
      query: ({ id, isPromo }) => ({ url: `/catalog/${id}/promo`, method: "PATCH", body: { isPromo } }),
      invalidatesTags: ["Catalog"],
    }),
    reorderCatalog: build.mutation<{ ok: boolean }, { items: { id: string; order: number }[] }>({
      query: (body) => ({ url: "/catalog/reorder", method: "PATCH", body }),
      invalidatesTags: ["Catalog"],
    }),
    uploadImages: build.mutation<{ urls: string[] }, FormData>({
      query: (body) => ({ url: "/catalog/upload", method: "POST", body }),
    }),

    // ── Plantillas ──
    getTemplates: build.query<Template[], { category?: string } | void>({
      query: (args) => {
        const qs = args && args.category ? `?category=${encodeURIComponent(args.category)}` : "";
        return `/templates${qs}`;
      },
      providesTags: ["Template"],
    }),
    getTemplate: build.query<Template, string>({
      query: (id) => `/templates/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Template", id }],
    }),
    createTemplate: build.mutation<Template, TemplateInput>({
      query: (body) => ({ url: "/templates", method: "POST", body }),
      invalidatesTags: ["Template"],
    }),
    updateTemplate: build.mutation<Template, { id: string; body: TemplateInput }>({
      query: ({ id, body }) => ({ url: `/templates/${id}`, method: "PUT", body }),
      invalidatesTags: ["Template"],
    }),
    deleteTemplate: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/templates/${id}`, method: "DELETE" }),
      invalidatesTags: ["Template"],
    }),

    // ── SKUs de inventario con stock agregado (para el autocomplete del editor) ──
    getInventorySkus: build.query<InventorySku[], void>({
      query: () => "/catalog/inventory-skus",
      providesTags: ["Product"],
    }),

    // ── Combos ("Comprados juntos frecuentemente") ──
    // Admin: todos los combos, incluidos inactivos y "rotos" (con producto borrado).
    getAdminCombos: build.query<Combo[], void>({
      query: () => "/combos/all",
      providesTags: ["Combo"],
    }),
    // Público: todos los combos activos (sección "Combos" del storefront).
    getCombos: build.query<Combo[], void>({
      query: () => "/combos",
      providesTags: ["Combo"],
    }),
    // Público: un combo por id (página de detalle /combo/:id).
    getCombo: build.query<Combo, string>({
      query: (id) => `/combos/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Combo", id }],
    }),
    // Público: combos activos que contienen un producto dado (detalle del producto).
    getCombosByProduct: build.query<Combo[], string>({
      query: (productId) => `/combos?productId=${encodeURIComponent(productId)}`,
      providesTags: (_r, _e, productId) => [{ type: "Combo", id: productId }],
    }),
    // Sube la foto propia (opcional) de un combo. `body` = FormData con `file`
    // y, si el combo ya existe, `comboId` (agrupa en catalog/combos/<id>/).
    uploadComboImage: build.mutation<{ ok: boolean; url: string }, FormData>({
      query: (body) => ({ url: "/combos/upload", method: "POST", body }),
    }),
    createCombo: build.mutation<Combo, ComboInput>({
      query: (body) => ({ url: "/combos", method: "POST", body }),
      invalidatesTags: ["Combo"],
    }),
    updateCombo: build.mutation<Combo, { id: string; body: ComboInput }>({
      query: ({ id, body }) => ({ url: `/combos/${id}`, method: "PUT", body }),
      invalidatesTags: ["Combo"],
    }),
    toggleComboActive: build.mutation<{ ok: boolean }, { id: string; active: boolean }>({
      query: ({ id, active }) => ({ url: `/combos/${id}/active`, method: "PATCH", body: { active } }),
      invalidatesTags: ["Combo"],
    }),
    deleteCombo: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/combos/${id}`, method: "DELETE" }),
      invalidatesTags: ["Combo"],
    }),
  }),
});


export const {
  useGetConfigQuery,
  useUpdateCategoriesMutation,
  useGetLandingConfigQuery,
  useUpdateLandingConfigMutation,
  useUploadHeroSlideMutation,
  useGetCatalogQuery,
  useGetCatalogItemQuery,
  useGetPopularSearchQuery,
  useGetAdminCatalogQuery,
  useCreateCatalogItemMutation,
  useUpdateCatalogItemMutation,
  useDeleteCatalogItemMutation,
  useTogglePromoMutation,
  useReorderCatalogMutation,
  useUploadImagesMutation,
  useGetTemplatesQuery,
  useGetTemplateQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
  useGetInventorySkusQuery,
  useGetAdminCombosQuery,
  useGetCombosQuery,
  useGetComboQuery,
  useGetCombosByProductQuery,
  useUploadComboImageMutation,
  useCreateComboMutation,
  useUpdateComboMutation,
  useToggleComboActiveMutation,
  useDeleteComboMutation,
} = catalogApi;
