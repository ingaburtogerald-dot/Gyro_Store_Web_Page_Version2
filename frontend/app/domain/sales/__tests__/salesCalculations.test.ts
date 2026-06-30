import { describe, it, expect } from "vitest";
import {
  resolveSaleFinancials,
  sumKpiTotals,
  sumComision,
  computePayout,
  totalQuantity,
} from "../salesCalculations";
import { makeSale, makeItem } from "./saleFixture";

describe("resolveSaleFinancials", () => {
  it("prefiere los campos por línea sobre los totales", () => {
    const sale = makeSale({ saleTotal: 1000, costReal: 600, totalCostReal: 999 });
    expect(resolveSaleFinancials(sale).costReal).toBe(600);
  });

  it("cae a los campos totales cuando los de línea faltan", () => {
    const sale = makeSale({ saleTotal: 1000, totalCostReal: 700 });
    expect(resolveSaleFinancials(sale).costReal).toBe(700);
  });

  it("calcula inversión recuperada = venta − costo real", () => {
    const sale = makeSale({ saleTotal: 1000, costReal: 600 });
    expect(resolveSaleFinancials(sale).inversionRecuperada).toBe(400);
  });

  it("usa 0 cuando no hay datos de costo (no NaN)", () => {
    const sale = makeSale({ saleTotal: 500 });
    const f = resolveSaleFinancials(sale);
    expect(f.costReal).toBe(0);
    expect(f.inversionRecuperada).toBe(500);
    expect(f.comisionVendedor).toBe(0);
    expect(f.gananciaTienda).toBe(0);
  });
});

describe("sumKpiTotals", () => {
  it("suma ventas, inversión, comisiones y ganancia sobre la lista", () => {
    const sales = [
      makeSale({ saleTotal: 1000, costReal: 600, comisionVendedor: 100, gananciaTienda: 200 }),
      makeSale({ saleTotal: 500, totalCostReal: 300, comisionVendedor: 50, gananciaTienda: 80 }),
    ];
    expect(sumKpiTotals(sales)).toEqual({
      totalVendido: 1500,
      inversion: 900,
      comisiones: 150,
      ganancia: 280,
    });
  });

  it("devuelve ceros para una lista vacía", () => {
    expect(sumKpiTotals([])).toEqual({ totalVendido: 0, inversion: 0, comisiones: 0, ganancia: 0 });
  });
});

describe("sumComision", () => {
  it("suma la comisión del vendedor de un grupo", () => {
    const sales = [makeSale({ comisionVendedor: 33.33 }), makeSale({ comisionVendedor: 66.67 })];
    expect(sumComision(sales)).toBeCloseTo(100, 5);
  });
});

describe("computePayout", () => {
  it("suma comisión + saldo a favor", () => {
    const sales = [makeSale({ comisionVendedor: 150 })];
    expect(computePayout(sales, 50)).toEqual({ totalComision: 150, saldo: 50, totalAPagar: 200 });
  });

  it("descuenta el saldo en contra", () => {
    const sales = [makeSale({ comisionVendedor: 150 })];
    expect(computePayout(sales, -50).totalAPagar).toBe(100);
  });

  it("nunca devuelve un pago negativo (saldo en contra mayor que la comisión)", () => {
    const sales = [makeSale({ comisionVendedor: 100 })];
    expect(computePayout(sales, -150).totalAPagar).toBe(0);
  });

  it("redondea a 2 decimales", () => {
    const sales = [makeSale({ comisionVendedor: 33.333 })];
    expect(computePayout(sales, 0).totalAPagar).toBe(33.33);
  });
});

describe("totalQuantity", () => {
  it("suma las cantidades de todas las líneas", () => {
    const sale = makeSale({ items: [makeItem({ quantity: 2 }), makeItem({ quantity: 3 })] });
    expect(totalQuantity(sale)).toBe(5);
  });

  it("es 0 cuando no hay líneas", () => {
    expect(totalQuantity(makeSale())).toBe(0);
  });
});
