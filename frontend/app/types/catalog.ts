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

// Recursos de imagen del sitio, editables desde Configuración → Recursos de imágenes.
// Cada campo vacío → el front usa el archivo por defecto del repo. El backend guarda
// cada uno en R2 y borra el anterior al reemplazar (server/routes/config.js).
export interface Branding {
  /** Logo estático del header (imagen). Vacío → /logo-estatico.jpg del repo. */
  logoStaticUrl?: string;
  /** Logo animado del header (GIF/video). Vacío → /logo-animado.gif del repo. */
  logoAnimatedUrl?: string;
  /** Favicon (ícono de pestaña). Vacío → /logo-favicon.png. (Pendiente de cablear al SSR.) */
  faviconUrl?: string;
  /** Logo del ticket POS impreso. Vacío → /logo-ticket.png. */
  ticketLogoUrl?: string;
  /** Imagen Open Graph al compartir. Vacío → /logo.jpg. (Pendiente de cablear al SSR.) */
  ogImageUrl?: string;
  /** Foto "Quiénes somos" (fundador). Vacío → /images/founder.jpg. */
  founderUrl?: string;
  /** Imagen del panel de marca del login en ESCRITORIO (columna derecha, vertical). Vacío → gradiente de acento. */
  loginBrandUrl?: string;
  /** Imagen del panel de marca del login en MÓVIL (banda superior, panorámica). Vacío → gradiente de acento. */
  loginBrandMobileUrl?: string;
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

export interface PublicCombo {
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

// Mapeo 1-a-1: cada combinación de variante → UN SKU canónico del inventario
// (que agrupa lotes) + un precio override opcional. El stock lo suma el backend
// por `sku`; el catálogo nunca vuelve a ver "tandas".
export interface VariantMapping {
  sku?: string;
  skus?: string[];
  price?: number;
}
export type VariantMappings = Record<string, VariantMapping>;

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
  colorAxisIndex?: number;
  imagesByColor: Record<string, string[]>;
  badges: string[];
  tiktokUrl?: string;
  compareAtPrice?: number;
  specs: SpecRow[];
  // Modo plantilla
  templateId?: string;
  basePrice?: number;
  variantMappings?: VariantMappings;
  templateAxes?: TemplateAxis[];
  // Opciones que ESTE producto ofrece por eje (poda estructural, no stock).
  // Si un eje no aparece, se asumen todas sus opciones. { conector: ["Tipo C"], color: ["Negro","Azul"] }
  axisOptions?: Record<string, string[]>;
}
// ── Combos ──
// Producto de un combo, ya resuelto por el backend (nombre/imagen/precio actuales).
export interface ComboProduct {
  id: string;
  name: string;
  description?: string;
  image: string;
  price: number;
}

export interface Combo {
  id: string;
  /** Nombre del combo; si no se definió, el backend lo arma como "A + B". */
  name: string;
  /** Foto propia del combo (opcional). Vacío ⇒ la card arma el split de las
   *  fotos de los 2 productos. */
  image: string;
  productIds: string[];
  /** Precio del paquete (con el descuento ya incorporado). */
  price: number;
  active: boolean;
  products: ComboProduct[];
  /** Suma de los precios normales de los productos. */
  normalTotal: number;
  /** normalTotal − price (nunca negativo). */
  savings: number;
  /** true si algún producto referenciado ya no existe en el catálogo. */
  broken: boolean;
}

export interface ComboInput {
  name?: string;
  productIds: string[];
  price: number;
  active?: boolean;
  /** Vacío/omitido ⇒ sin foto propia. */
  image?: string;
}

export interface TemplateInput {
  name: string;
  category: string;
  description?: string;
  axes: TemplateAxis[];
  specs: SpecRow[];
}

// SKU canónico del inventario con su stock ya sumado (todos los lotes que lo comparten).
export interface InventorySku {
  sku: string;
  name: string;
  stock: number;
  price?: number;
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
  variantMappings?: VariantMappings;
  // Opciones que ESTE producto ofrece por eje (poda estructural, no stock).
  // Si un eje no aparece, se asumen todas sus opciones. { conector: ["Tipo C"], color: ["Negro","Azul"] }
  axisOptions?: Record<string, string[]>;
}