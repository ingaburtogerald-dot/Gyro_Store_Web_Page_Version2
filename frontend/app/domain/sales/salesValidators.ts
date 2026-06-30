// ─────────────────────────────────────────────────────────────────────────────
// Capa de Dominio — Validaciones PURAS de reglas de negocio de ventas.
//
// Extrae las reglas que hoy viven dentro de PendingSales (aprobación masiva):
//   • No se puede aprobar+pagar ventas de vendedores distintos en un mismo lote.
//   • No se aprueba una venta con stock insuficiente.
//
// Devuelven datos (no lanzan, no muestran toasts): la capa de aplicación decide
// qué hacer con el resultado. Esto las hace triviales de testear.
// ─────────────────────────────────────────────────────────────────────────────
import type { Sale } from "~/store/api/salesApi";

/** ¿Todas las ventas pertenecen al mismo vendedor? (requisito para pagar en lote). */
export function allSameSeller(sales: Sale[]): boolean {
  if (sales.length === 0) return true;
  const first = sales[0].sellerEmail;
  return sales.every((s) => s.sellerEmail === first);
}

/** ¿Alguna venta no tiene stock suficiente para aprobarse? */
export function hasInsufficientStock(sales: Sale[]): boolean {
  return sales.some((s) => Boolean(s.insufficientStockError));
}

export type BulkApproveResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "mixed-seller" | "insufficient-stock" };

/** Regla completa de "aprobar y pagar en lote". La UI mapea cada `reason` a su feedback. */
export function checkBulkApprove(sales: Sale[]): BulkApproveResult {
  if (sales.length === 0) return { ok: false, reason: "empty" };
  if (!allSameSeller(sales)) return { ok: false, reason: "mixed-seller" };
  if (hasInsufficientStock(sales)) return { ok: false, reason: "insufficient-stock" };
  return { ok: true };
}

/** Una venta es editable individualmente solo si hay exactamente una seleccionada. */
export function canEditSelection(sales: Sale[]): boolean {
  return sales.length === 1;
}
