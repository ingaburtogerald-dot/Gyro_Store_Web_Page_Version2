// API del catálogo y configuración pública (no requiere auth).
// En esta fase solo expone la config de negocio; los endpoints de productos
// del catálogo se agregan en la Fase 2.
import { baseApi } from "./baseApi";

export interface Category {
  id: string;
  name: string;
  /** Emoji o glifo opcional; muchas categorías no lo tienen (look editorial). */
  icon?: string;
  subcategories?: { id: string; name: string }[];
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
  // Opciones de variantes encendidas (sin colores) para las pills de la card,
  // p.ej. ["Tipo C", "Jack 3.5mm", "Con mic"]. Lo computa el backend en la lista.
  axesSummary?: string[];
  // Combinaciones encendidas (incluye ejes de color): >1 → el quick-add de la
  // card abre el selector de variante en vez de agregar "Estándar" a ciegas.
  variantCount?: number;
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

// Disponibilidad por opción: { [ejeKey]: { [opción]: { enabled: boolean, sku?: string } | boolean } }
export type Availability = Record<string, Record<string, { enabled: boolean; sku?: string } | boolean>>;

// Mapeo de combinaciones a SKUs de bodega. Una combinación puede apuntar a VARIOS
// códigos de bodega que son la misma variante en distintas tandas (ej: IN13 e IN98
// = "KZ EDX Pro X / Jack 3.5mm / Negro"); el stock del catálogo es la suma de todos.
// Formato nuevo: { skus: ["IN13","IN98"] }. Se mantiene compat con el viejo { sku: "IN13" }.
export type VariantMapping = { sku?: string; skus?: string[] };
export type VariantMappings = Record<string, VariantMapping>;

// Normaliza una entrada de mapeo a la lista de códigos (lee ambos formatos).
export function variantSkus(entry?: VariantMapping): string[] {
  if (!entry) return [];
  if (Array.isArray(entry.skus)) return entry.skus.filter(Boolean);
  if (entry.sku) return [entry.sku];
  return [];
}

export interface CatalogVariant {
  id: string;
  name: string;
  variantName: string;
  axisValues?: string[];
  price: number;
  sku?: string;
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
  variantMappings?: VariantMappings;
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

    // ── Productos de bodega (para combobox del admin) ──
    getWarehouseProducts: build.query<WarehouseProduct[], void>({
      query: () => "/catalog/warehouse-products",
      providesTags: ["Product"],
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

export interface WarehouseProduct {
  id: string;
  code: string;
  name: string;
  stock: number;
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
  variantMappings?: VariantMappings;
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
  useGetWarehouseProductsQuery,
} = catalogApi;
