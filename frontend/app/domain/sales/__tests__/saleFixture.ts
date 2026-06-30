// Factory de fixtures para tests de dominio. NO es un archivo de test (no termina en
// .test/.spec) → vitest lo ignora como suite y solo lo importa como helper.
import type { Sale, SaleItem } from "~/store/api/salesApi";

export function makeItem(overrides: Partial<SaleItem> = {}): SaleItem {
  return {
    productId: "p1",
    code: "C-001",
    name: "Producto",
    variantName: "Estándar",
    quantity: 1,
    salePrice: 100,
    lineTotal: 100,
    ...overrides,
  };
}

export function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "s1",
    type: "seller_report",
    sellerEmail: "ana@gyro.com",
    sellerName: "Ana",
    items: [],
    saleTotal: 0,
    status: "approved",
    createdAt: null,
    ...overrides,
  };
}
