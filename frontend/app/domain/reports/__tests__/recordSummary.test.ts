import { describe, it, expect } from "vitest";
import { toCordobas, summarizeRecords } from "../recordSummary";
import type { LossRecord } from "~/store/api/reportsApi";

const rec = (o: Partial<LossRecord>): LossRecord => ({
  id: "r", date: "2026-06-01", amount: 0, currency: "C$", ...o,
});

describe("toCordobas", () => {
  it("deja C$ tal cual", () => {
    expect(toCordobas({ amount: 500, currency: "C$" }, 37)).toBe(500);
  });
  it("convierte USD con el tipo de cambio", () => {
    expect(toCordobas({ amount: 10, currency: "USD" }, 37)).toBe(370);
  });
});

describe("summarizeRecords", () => {
  it("separa pérdidas y gastos y suma el total en C$", () => {
    const records = [
      rec({ kind: "inventory_loss", amount: 600, currency: "C$" }),
      rec({ kind: "expense", amount: 500, currency: "C$" }),
      rec({ kind: "expense", amount: 10, currency: "USD" }), // 370 C$
    ];
    const s = summarizeRecords(records, 37);
    expect(s.perdidas).toBe(600);
    expect(s.gastos).toBe(870);
    expect(s.total).toBe(1470);
    expect(s.perdidasCount).toBe(1);
    expect(s.gastosCount).toBe(2);
    expect(s.count).toBe(3);
  });

  it("trata kind ausente como pérdida (retrocompat)", () => {
    const s = summarizeRecords([rec({ amount: 100, currency: "C$" })], 37);
    expect(s.perdidas).toBe(100);
    expect(s.gastos).toBe(0);
  });

  it("devuelve ceros para lista vacía", () => {
    expect(summarizeRecords([], 37)).toEqual({ perdidas: 0, gastos: 0, total: 0, perdidasCount: 0, gastosCount: 0, count: 0 });
  });
});
