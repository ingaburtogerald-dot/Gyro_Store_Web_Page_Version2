// API del catálogo y configuración pública (no requiere auth).
// En esta fase solo expone la config de negocio; los endpoints de productos
// del catálogo se agregan en la Fase 2.
import { baseApi } from "./baseApi";

export interface Category {
  id: string;
  name: string;
  icon: string;
}

// Escalón de descuento por cantidad (compra de más de 1 unidad).
export interface VolumeDiscount {
  minQty: number;
  maxQty: number | null;
  discountPercent: number;
}

export interface BusinessConfig {
  storeName: string;
  storeAddress: string;
  whatsapp: string;
  currency: string;
  exchangeRate: number;
  wholesaleDiscounts: VolumeDiscount[];
  categories: Category[];
  socialLinks: { instagram: string; facebook: string; tiktok: string };
}

export interface SpecRow {
  label: string;
  value: string;
}

// Ítem del catálogo tal como llega del backend (precio y stock ya enriquecidos).
export interface CatalogProduct {
  id: string;
  name: string;
  description?: string;
  category: string;
  images: string[];
  price: number;
  stock: number;
  isPromo?: boolean;
  badges?: string[];
  compareAtPrice?: number;
  published?: boolean;
  order?: number;
}

// ── Plantillas (molde de características reutilizable por categoría) ──
export interface TemplateAxis {
  key: string;
  label: string;
  options: string[];
  isColor?: boolean;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description?: string;
  axes: TemplateAxis[];
  specs: SpecRow[];
}

// Disponibilidad por opción: { [ejeKey]: { [opción]: on/off } }
export type Availability = Record<string, Record<string, boolean>>;

export interface CatalogVariant {
  id: string;
  name: string;
  variantName: string;
  axisValues?: string[];
  price: number;
  stock: number;
  specs?: string[];
}

export interface CatalogDetail extends CatalogProduct {
  variants: CatalogVariant[];
  axisLabels: string[];
  imagesByColor: Record<string, string[]>;
  badges: string[];
  tiktokUrl?: string;
  compareAtPrice?: number;
  specs: SpecRow[];
  // Modo plantilla
  templateId?: string;
  basePrice?: number;
  availability?: Availability;
}

export const catalogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getConfig: build.query<BusinessConfig, void>({
      query: () => "/config",
      providesTags: ["Config"],
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
  }),
});

export interface TemplateInput {
  name: string;
  category: string;
  description?: string;
  axes: TemplateAxis[];
  specs: SpecRow[];
}

export interface CatalogItemInput {
  name: string;
  description: string;
  category: string;
  imagesByColor?: Record<string, string[]>;
  tiktokUrl?: string;
  compareAtPrice?: number;
  specs?: SpecRow[];
  published?: boolean;
  isPromo: boolean;
  // Modo plantilla
  templateId?: string;
  basePrice?: number;
  availability?: Availability;
}

export const {
  useGetConfigQuery,
  useGetCatalogQuery,
  useGetCatalogItemQuery,
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
} = catalogApi;
