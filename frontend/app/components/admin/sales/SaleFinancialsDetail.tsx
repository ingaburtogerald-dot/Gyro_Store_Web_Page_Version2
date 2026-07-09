// Desglose financiero detallado por ítem de una venta (solo admin).
// Lógica: Primero muestra el cálculo POR UNIDAD de cada producto, luego los TOTALES
// (unitario × cantidad). Replica exactamente la lógica del Excel del usuario.
import { useState } from "react";
import { Modal } from "~/components/ui/Modal";
import { formatCordobas } from "~/lib/utils";
import type { Sale, SaleItem } from "~/store/api/salesApi";

// Labels legibles para las categorías de costos fijos del backend.
const CF_LABELS: Record<string, string> = {
  prestamos: "Préstamos",
  garantias: "Garantías",
  publicidad: "Publicidad",
  servicios: "Servicios",
  insumos: "Insumos",
};

export function SaleFinancialsDetail({
  sale,
  onClose,
}: {
  sale: Sale | null;
  onClose: () => void;
}) {
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  if (!sale) return null;

  const items = sale.items || [];
  const date = sale.createdAt
    ? new Date(sale.createdAt).toLocaleDateString("es-NI", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  // Obtener las claves de costos fijos presentes (del primer ítem con desglose unitario).
  const cfKeys = items
    .map((it) => it.unitCostosFijosDesglose || it.costosFijosDesglose)
    .find((d) => d != null);
  const cfCategoryKeys = cfKeys ? Object.keys(cfKeys) : [];

  // Totales globales de la venta (sumando los totales de cada línea).
  const totals = items.reduce(
    (acc, it) => {
      const qty = it.quantity || 1;
      acc.saleTotal += (it.salePrice || 0) * qty;
      acc.costReal += it.costReal ?? 0;
      acc.utilidadBruta += it.utilidadBruta ?? 0;
      acc.costosFijos += it.costosFijos ?? 0;
      acc.utilidadNeta += it.utilidadNeta ?? 0;
      acc.comisionVendedor += it.comisionVendedor ?? 0;
      acc.gananciaTienda += it.gananciaTienda ?? 0;
      acc.inversionRecuperada += it.inversionRecuperada ?? it.costReal ?? 0;
      acc.qty += qty;
      if (it.costosFijosDesglose) {
        for (const [k, v] of Object.entries(it.costosFijosDesglose)) {
          acc.cfDesglose[k] = (acc.cfDesglose[k] || 0) + (v || 0);
        }
      }
      return acc;
    },
    {
      saleTotal: 0, costReal: 0, utilidadBruta: 0, costosFijos: 0,
      utilidadNeta: 0, comisionVendedor: 0, gananciaTienda: 0, inversionRecuperada: 0,
      qty: 0, cfDesglose: {} as Record<string, number>,
    },
  );

  return (
    <Modal open={!!sale} onClose={onClose} title="Desglose Financiero" maxWidth="max-w-6xl">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-text">{sale.sellerName}</span>
            <span className="text-muted">{date}</span>
          </div>
          <span className="text-lg font-bold text-text">
            Importe Total: {formatCordobas(sale.saleTotal)}
          </span>
        </div>

        {/* ─── Cada producto: cálculo por unidad y total ─── */}
        <div className="space-y-4">
          {items.map((it, i) => (
            <ItemBreakdown
              key={i}
              item={it}
              index={i}
              cfCategoryKeys={cfCategoryKeys}
              expanded={expandedItem === i}
              onToggle={() => setExpandedItem(expandedItem === i ? null : i)}
            />
          ))}
        </div>

        {/* ─── Resumen global de la venta ─── */}
        {items.length > 1 && (
          <div className="rounded-card border-2 border-accent/30 bg-surface p-4 space-y-3">
            <h3 className="text-sm font-bold text-accent-2 uppercase tracking-wide">
              Resumen Global de la Venta ({totals.qty} unidades)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <Metric label="Importe Total" value={formatCordobas(totals.saleTotal)} className="font-bold text-text" />
              <Metric label="Costo Real Total" value={formatCordobas(totals.costReal)} className="text-muted" />
              <Metric label="Utilidad Bruta Total" value={formatCordobas(totals.utilidadBruta)} />
              {cfCategoryKeys.map((k) => (
                <Metric
                  key={k}
                  label={`${CF_LABELS[k] || k} Total`}
                  value={totals.cfDesglose[k] > 0 ? `-${formatCordobas(totals.cfDesglose[k])}` : "—"}
                  className="text-danger"
                />
              ))}
              <Metric
                label="Costos Fijos Total"
                value={totals.costosFijos > 0 ? `-${formatCordobas(totals.costosFijos)}` : "—"}
                className="text-danger"
              />
              <Metric label="Utilidad Neta Total" value={formatCordobas(totals.utilidadNeta)} />
              <Metric
                label="Comisión Vendedor Total"
                value={formatCordobas(totals.comisionVendedor)}
                className="font-semibold text-accent-2"
              />
              <Metric
                label="Ganancia Tienda Total"
                value={formatCordobas(totals.gananciaTienda)}
                className="font-bold text-whatsapp"
              />
              <Metric
                label="Inversión Recuperada Total"
                value={formatCordobas(totals.inversionRecuperada)}
                className="text-accent-2"
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Desglose de un ítem: primero por unidad, luego totales ──
function ItemBreakdown({
  item,
  index,
  cfCategoryKeys,
  expanded,
  onToggle,
}: {
  item: SaleItem;
  index: number;
  cfCategoryKeys: string[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const qty = item.quantity || 1;
  const lineTotal = (item.salePrice || 0) * qty;

  // Valores por unidad (calculados primero).
  const unitCost = item.unitCostReal ?? (item.costReal ? item.costReal / qty : 0);
  const unitUB = item.unitUtilidadBruta ?? (item.utilidadBruta ? item.utilidadBruta / qty : 0);
  const unitCF = item.unitCostosFijos ?? (item.costosFijos ? item.costosFijos / qty : 0);
  const unitUN = item.unitUtilidadNeta ?? (item.utilidadNeta ? item.utilidadNeta / qty : 0);
  const unitCom = item.unitComisionVendedor ?? (item.comisionVendedor ? item.comisionVendedor / qty : 0);
  const unitGan = item.unitGananciaTienda ?? (item.gananciaTienda ? item.gananciaTienda / qty : 0);
  const unitInv = item.unitInversionRecuperada ?? unitCost;

  // Desglose de CF por unidad.
  const unitCFDesglose = item.unitCostosFijosDesglose;

  // Totales.
  const totalCost = item.costReal ?? 0;
  const totalUB = item.utilidadBruta ?? 0;
  const totalCF = item.costosFijos ?? 0;
  const totalUN = item.utilidadNeta ?? 0;
  const totalCom = item.comisionVendedor ?? 0;
  const totalGan = item.gananciaTienda ?? 0;
  const totalInv = item.inversionRecuperada ?? totalCost;

  return (
    <div className="rounded-card border border-border bg-surface shadow-premium overflow-hidden">
      {/* Header del producto — clic para expandir */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text truncate">{item.name}</span>
            {item.code && (
              <span className="shrink-0 rounded-pill bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-muted">
                {item.code}
              </span>
            )}
          </div>
          <span className="text-xs text-muted">
            {qty} × {formatCordobas(item.salePrice || 0)} = {formatCordobas(lineTotal)}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="block text-[10px] text-muted uppercase">Ganancia</span>
            <span className="font-mono text-sm font-bold text-whatsapp">
              {formatCordobas(totalGan)}
            </span>
          </div>
          <svg
            className={`h-4 w-4 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Desglose expandido */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4 animate-in slide-in-from-top-1">
          {/* ── PASO 1: Cálculo POR UNIDAD ── */}
          <div>
            <h4 className="text-xs font-bold text-accent-2 uppercase tracking-wide mb-2">
              Paso 1 — Cálculo por Unidad
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <Metric label="Precio Venta" value={formatCordobas(item.salePrice || 0)} className="font-semibold text-text" />
              <Metric label="Costo Real" value={formatCordobas(unitCost)} className="text-muted" />
              <Metric
                label={`Utilidad Bruta (${formatCordobas(item.salePrice || 0)} − ${formatCordobas(unitCost)})`}
                value={formatCordobas(unitUB)}
              />
              {cfCategoryKeys.map((k) => (
                <Metric
                  key={k}
                  label={CF_LABELS[k] || k}
                  value={unitCFDesglose?.[k] ? `-${formatCordobas(unitCFDesglose[k])}` : "—"}
                  className="text-danger"
                />
              ))}
              <Metric
                label={`Costos Fijos (${item.costosFijosPct ?? 0}%)`}
                value={unitCF > 0 ? `-${formatCordobas(unitCF)}` : "—"}
                className="text-danger"
              />
              <Metric
                label="Utilidad Neta (UB − CF)"
                value={formatCordobas(unitUN)}
                className="font-semibold text-text"
              />
              <Metric
                label={`Comisión Vendedor (${item.comisionPercent ?? 0}% de UN)`}
                value={formatCordobas(unitCom)}
                className="text-accent-2"
              />
              <Metric
                label="Ganancia Tienda (UN − Comisión)"
                value={formatCordobas(unitGan)}
                className="font-bold text-whatsapp"
              />
            </div>
          </div>

          {/* ── PASO 2: Multiplicar × cantidad ── */}
          {qty > 1 && (
            <div>
              <h4 className="text-xs font-bold text-accent-2 uppercase tracking-wide mb-2">
                Paso 2 — Total × {qty} unidades
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <Metric label="Importe Total" value={formatCordobas(lineTotal)} className="font-bold text-text" />
                <Metric label="Costo Real Total" value={formatCordobas(totalCost)} className="text-muted" />
                <Metric label="Utilidad Bruta Total" value={formatCordobas(totalUB)} />
                {cfCategoryKeys.map((k) => (
                  <Metric
                    key={k}
                    label={`${CF_LABELS[k] || k} Total`}
                    value={item.costosFijosDesglose?.[k] ? `-${formatCordobas(item.costosFijosDesglose[k])}` : "—"}
                    className="text-danger"
                  />
                ))}
                <Metric
                  label="Costos Fijos Total"
                  value={totalCF > 0 ? `-${formatCordobas(totalCF)}` : "—"}
                  className="text-danger"
                />
                <Metric label="Utilidad Neta Total" value={formatCordobas(totalUN)} />
                <Metric
                  label="Comisión Vendedor Total"
                  value={formatCordobas(totalCom)}
                  className="font-semibold text-accent-2"
                />
                <Metric
                  label="Ganancia Tienda Total"
                  value={formatCordobas(totalGan)}
                  className="font-bold text-whatsapp"
                />
                <Metric
                  label="Inversión Recuperada"
                  value={formatCordobas(totalInv)}
                  className="text-accent-2"
                />
              </div>
            </div>
          )}

          {/* Si qty === 1, solo mostrar inversión recuperada */}
          {qty === 1 && (
            <div className="flex items-center gap-4 pt-1">
              <Metric
                label="Inversión Recuperada"
                value={formatCordobas(totalInv)}
                className="text-accent-2"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <span className="block text-[10px] uppercase text-muted leading-tight">{label}</span>
      <span className={`font-mono text-xs ${className ?? "text-text"}`}>{value}</span>
    </div>
  );
}
