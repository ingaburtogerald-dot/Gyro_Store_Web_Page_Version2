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
  axesSummary?: string;
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
