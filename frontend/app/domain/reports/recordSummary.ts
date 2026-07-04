// Dominio puro — consolidación de pérdidas y gastos para las cards de resumen.
// Convierte USD→C$ con el tipo de cambio para poder sumar en una sola moneda.
import type { LossRecord } from "~/store/api/reportsApi";

/** Monto del registro normalizado a córdobas. */
export function toCordobas(record: Pick<LossRecord, "amount" | "currency">, rate: number): number {
  return record.currency === "USD" ? record.amount * rate : record.amount;
}

export interface RecordsSummary {
  /** Σ costo real de pérdidas (C$). */
  perdidas: number;
  /** Σ gastos operativos (C$). */
  gastos: number;
  /** perdidas + gastos (C$). */
  total: number;
  perdidasCount: number;
  gastosCount: number;
  count: number;
}

const EMPTY: RecordsSummary = { perdidas: 0, gastos: 0, total: 0, perdidasCount: 0, gastosCount: 0, count: 0 };

/** Suma pérdidas y gastos por separado (y total) en C$. */
export function summarizeRecords(records: LossRecord[], rate: number): RecordsSummary {
  return records.reduce<RecordsSummary>((acc, r) => {
    const c = toCordobas(r, rate);
    if (r.kind === "expense") {
      acc.gastos += c;
      acc.gastosCount += 1;
    } else {
      acc.perdidas += c;
      acc.perdidasCount += 1;
    }
    acc.total += c;
    acc.count += 1;
    return acc;
  }, { ...EMPTY });
}
