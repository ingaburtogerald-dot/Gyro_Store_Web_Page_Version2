import { describe, it, expect } from "vitest";
import {
  allSameSeller,
  hasInsufficientStock,
  checkBulkApprove,
  canEditSelection,
} from "../salesValidators";
import { makeSale } from "./saleFixture";

describe("allSameSeller", () => {
  it("es true para lista vacía", () => {
    expect(allSameSeller([])).toBe(true);
  });

  it("es true cuando todas son del mismo vendedor", () => {
    const sales = [makeSale({ sellerEmail: "ana@x.com" }), makeSale({ sellerEmail: "ana@x.com" })];
    expect(allSameSeller(sales)).toBe(true);
  });

  it("es false cuando hay vendedores distintos", () => {
    const sales = [makeSale({ sellerEmail: "ana@x.com" }), makeSale({ sellerEmail: "beto@x.com" })];
    expect(allSameSeller(sales)).toBe(false);
  });
});

describe("hasInsufficientStock", () => {
  it("detecta una venta con error de stock", () => {
    const sales = [makeSale(), makeSale({ insufficientStockError: "Sin stock" })];
    expect(hasInsufficientStock(sales)).toBe(true);
  });

  it("es false cuando todas tienen stock", () => {
    expect(hasInsufficientStock([makeSale(), makeSale()])).toBe(false);
  });
});

describe("checkBulkApprove", () => {
  it("rechaza una selección vacía", () => {
    expect(checkBulkApprove([])).toEqual({ ok: false, reason: "empty" });
  });

  it("rechaza vendedores mezclados", () => {
    const sales = [makeSale({ sellerEmail: "ana@x.com" }), makeSale({ sellerEmail: "beto@x.com" })];
    expect(checkBulkApprove(sales)).toEqual({ ok: false, reason: "mixed-seller" });
  });

  it("prioriza 'mixed-seller' sobre el stock insuficiente", () => {
    const sales = [
      makeSale({ sellerEmail: "ana@x.com" }),
      makeSale({ sellerEmail: "beto@x.com", insufficientStockError: "Sin stock" }),
    ];
    expect(checkBulkApprove(sales)).toEqual({ ok: false, reason: "mixed-seller" });
  });

  it("rechaza stock insuficiente (mismo vendedor)", () => {
    const sales = [
      makeSale({ sellerEmail: "ana@x.com" }),
      makeSale({ sellerEmail: "ana@x.com", insufficientStockError: "Sin stock" }),
    ];
    expect(checkBulkApprove(sales)).toEqual({ ok: false, reason: "insufficient-stock" });
  });

  it("aprueba cuando es mismo vendedor y hay stock", () => {
    const sales = [makeSale({ sellerEmail: "ana@x.com" }), makeSale({ sellerEmail: "ana@x.com" })];
    expect(checkBulkApprove(sales)).toEqual({ ok: true });
  });
});

describe("canEditSelection", () => {
  it("solo permite editar con exactamente una venta seleccionada", () => {
    expect(canEditSelection([makeSale()])).toBe(true);
    expect(canEditSelection([])).toBe(false);
    expect(canEditSelection([makeSale(), makeSale()])).toBe(false);
  });
});
