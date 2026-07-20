export interface Category {
  id: string;
  name: string;
  icon?: string;
  subcategories?: { id: string; name: string }[];
}

export interface VolumeDiscount {
  minQty: number;
  maxQty: number | null;
  discountPercent: number;
}

export type DiscountTier = VolumeDiscount;

export interface Branding {
  /** Logo estático del header (imagen). Vacío → /logo-estatico.jpg del repo. */
  logoStaticUrl?: string;
  /** Logo animado del header (GIF). Vacío → /logo-animado.gif del repo. */
  logoAnimatedUrl?: string;
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
  reviewLinks?: { google: string; facebook: string };
  branding?: Branding;
}

export interface SpecRow {
  label: string;
  value: string;
}

// ── Landing editable (modo edición inline) ──
// Una diapositiva del Hero. `mediaType` decide si se renderiza <video> o <img>.
// `actionType` "modal" abre "Quiénes Somos"; "link" navega a `actionTarget`.
// `locked` (solo el slide #1 / marca) impide mover o eliminar, pero sí editar.
export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  buttonText: string;
  actionType: "modal" | "link";
  actionTarget: string;
  locked?: boolean;
}

export interface LandingConfig {
  // Ids de categoría en el orden/visibilidad elegidos por el admin. Vacío = todas
  // las categorías en su orden natural (los nombres salen del catálogo, no de aquí).
  headerCategories: string[];
  heroSlides: HeroSlide[];
}

export interface CatalogProduct {
  id: string;
  name: string;
  description?: string;
  category: string;
  images: string[];
  price: number;
  stock: number;
  isPromo?: boolean;
  compareAtPrice?: number;
  volumeDiscounts?: VolumeDiscount[];
  specs?: SpecRow[];
  hasVariants?: boolean;
  variants?: any[];
  templateId?: string;
  published?: boolean;
  variantCount?: number;
  // Opciones no-color ofrecidas por el producto (pills de variante en la card).
  // El backend (buildAxesSummary) lo devuelve como arreglo; ver server/routes/catalog.js.
  axesSummary?: string[];
  badges?: string[];
}

export interface Combo {
  id: string;
  name: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  image?: string;
  isPromo?: boolean;
  products: {
    productId: string;
    productName: string;
    quantity: number;
    priceAllocation: number;
  }[];
  published: boolean;
}
