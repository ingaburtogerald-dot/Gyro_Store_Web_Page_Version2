// Desglose financiero del cotizador en vivo (los pasos del cálculo).
// Cuando qty > 1 muestra: Paso 1 (cálculo por unidad) → Paso 2 (total × qty).
// Cuando hay múltiples productos, muestra cada uno individualmente y luego el total.
import { Loader2, Receipt, Wallet, TrendingUp, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { QuoteResult, SaleItem } from "~/store/api/salesApi";
import { CountUp } from "~/components/ui/CountUp";
import { formatCordobas, cn } from "~/lib/utils";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin } from "~/store/slices/authSlice";

// Labels de costos fijos.
const CF_LABELS: Record<string, string> = {
  publicidad: "Publicidad",
  servicios: "Servicios",
  utiles: "Útiles",
  garantias: "Garantías",
};

// Colores compartidos entre los segmentos de la barra y los puntos del desglose.
const SEG = {
  costo: "bg-muted/60",
  fijos: "bg-warning/70",
  comision: "bg-whatsapp",
  ganancia: "bg-accent",
} as const;

export function QuoteSummary({ result, loading, errorMsg }: { result: QuoteResult | null; loading: boolean; errorMsg?: string }) {
  const isAdmin = useAppSelector(selectIsAdmin);

  return (
    <div className="rounded-card border border-border bg-surface shadow-premium p-4">
      <div className="mb-3 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-accent-2" />
        <h3 className="font-semibold">Resumen</h3>
        {loading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-accent" />}
      </div>

      {errorMsg ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs font-medium text-danger">
          {errorMsg}
        </div>
      ) : !result ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Wallet className="h-8 w-8 text-muted/40" />
          <p className="text-sm text-muted">Agrega productos y precio de venta para ver la estimación.</p>
        </div>
      ) : (
        <>
          {/* Ticket: importe total (animado) + barra de proporción integrada */}
          <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 p-4">
            <span className="text-xs text-muted/70">Importe total</span>
            <CountUp
              value={result.saleTotal}
              format={formatCordobas}
              className="nums block font-heading text-3xl font-bold text-accent-2"
            />
            {isAdmin && result.saleTotal > 0 && (() => {
              const total = result.saleTotal;
              const segments = [
                { key: "costo", label: "Costo real", value: result.costReal, cls: SEG.costo },
                { key: "fijos", label: "Costos fijos", value: result.costosFijos, cls: SEG.fijos },
                { key: "comision", label: "Comisión vendedor", value: result.comisionVendedor, cls: SEG.comision },
                { key: "ganancia", label: "Ganancia tienda", value: result.gananciaTienda, cls: SEG.ganancia },
              ];
              return (
                <div className="mt-3 flex h-2 overflow-hidden rounded-pill bg-surface-2">
                  {segments.map((s) => (
                    <div
                      key={s.key}
                      style={{ width: `${Math.max(0, (s.value / total) * 100)}%` }}
                      title={`${s.label}: ${formatCordobas(s.value)} (${Math.round((s.value / total) * 100)}%)`}
                      className={cn(s.cls, "transition-[width] duration-500 ease-out")}
                    />
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Desglose detallado (solo admin) */}
          {isAdmin && (
            <>
              {/* ── Desglose POR ÍTEM (cuando hay linesFinancials) ── */}
              {result.linesFinancials && result.linesFinancials.length > 0 ? (
                <div className="space-y-3">
                  {result.linesFinancials.map((item, i) => (
                    <ItemFinancialBreakdown key={i} item={item} />
                  ))}

                  {/* Totales globales cuando hay más de 1 producto */}
                  {result.linesFinancials.length > 1 && (
                    <div className="rounded-lg border-2 border-accent/20 bg-accent/5 p-3 space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-accent-2">Totales de la Venta</span>
                      <dl className="nums divide-y divide-border/60 text-sm">
                        <Row dot={SEG.costo} label="Costo real total" value={formatCordobas(result.costReal)} muted />
                        <Row label="Utilidad bruta total" value={formatCordobas(result.utilidadBruta)} sub />
                        <Row dot={SEG.fijos} label={`Costos fijos total`} value={`−${formatCordobas(result.costosFijos)}`} muted />
                        <Row label="Utilidad neta total" value={formatCordobas(result.utilidadNeta)} sub />
                        <Row dot={SEG.comision} label="Comisión vendedor total" value={formatCordobas(result.comisionVendedor)} />
                        <Row dot={SEG.ganancia} label="Ganancia tienda total" value={formatCordobas(result.gananciaTienda)} strong />
                        <Row label="Inversión recuperada total" value={formatCordobas(result.inversionRecuperada ?? result.costReal)} muted />
                      </dl>
                    </div>
                  )}
                </div>
              ) : (
                /* Fallback si no hay linesFinancials (respuesta sin desglose) */
                <dl className="nums divide-y divide-border/60 text-sm">
                  <Row dot={SEG.costo} label="Costo real del producto" value={formatCordobas(result.costReal)} muted />
                  <Row label="Utilidad bruta" value={formatCordobas(result.utilidadBruta)} sub />
                  <Row dot={SEG.fijos} label={`Costos fijos (${result.costosFijosPct}%)`} value={`−${formatCordobas(result.costosFijos)}`} muted />
                  <Row label="Utilidad neta" value={formatCordobas(result.utilidadNeta)} sub />
                  <Row
                    dot={SEG.comision}
                    label={`Comisión vendedor${result.comisionPercent ? ` (${result.comisionPercent}%)` : ""}`}
                    value={formatCordobas(result.comisionVendedor)}
                  />
                  <Row dot={SEG.ganancia} label="Ganancia tienda" value={formatCordobas(result.gananciaTienda)} strong />
                </dl>
              )}
            </>
          )}

          {/* Comisión destacada: para el vendedor es SU dato principal */}
          {!isAdmin && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-whatsapp/30 bg-whatsapp/10 p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-whatsapp" />
                <span className="text-sm font-medium text-text">Tu comisión esperada</span>
              </div>
              <span className="nums text-xl font-bold text-whatsapp">{formatCordobas(result.comisionVendedor)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Desglose financiero de un ítem individual ──
// Paso 1: Cálculo por unidad. Paso 2: × cantidad (solo si qty > 1).
function ItemFinancialBreakdown({ item }: { item: SaleItem }) {
  const [expanded, setExpanded] = useState(true);
  const qty = item.quantity || 1;

  // Valores por unidad.
  const unitCost = item.unitCostReal ?? (item.costReal ? item.costReal / qty : 0);
  const unitUB = item.unitUtilidadBruta ?? (item.utilidadBruta ? item.utilidadBruta / qty : 0);
  const unitCF = item.unitCostosFijos ?? (item.costosFijos ? item.costosFijos / qty : 0);
  const unitUN = item.unitUtilidadNeta ?? (item.utilidadNeta ? item.utilidadNeta / qty : 0);
  const unitCom = item.unitComisionVendedor ?? (item.comisionVendedor ? item.comisionVendedor / qty : 0);
  const unitGan = item.unitGananciaTienda ?? (item.gananciaTienda ? item.gananciaTienda / qty : 0);
  const cfPct = item.costosFijosPct ?? 0;
  const comPct = item.comisionPercent ?? 0;

  // Desglose CF por unidad.
  const unitCFDesglose = item.unitCostosFijosDesglose;
  const cfCategoryKeys = unitCFDesglose ? Object.keys(unitCFDesglose) : [];

  return (
    <div className="rounded-lg border border-border bg-surface-2 overflow-hidden">
      {/* Header del producto */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-hover transition-colors"
      >
        <div className="min-w-0">
          <span className="text-xs font-semibold text-text truncate block">{item.name}</span>
          <span className="nums text-[11px] text-muted">
            {qty} × {formatCordobas(item.salePrice || 0)}
          </span>
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          {/* ── PASO 1: Cálculo por unidad ── */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent-2">
              {qty > 1 ? "Paso 1 — Por Unidad" : "Cálculo Unitario"}
            </span>
            <dl className="nums divide-y divide-border/40 text-xs mt-1">
              <Row dot={SEG.costo} label="Costo real" value={formatCordobas(unitCost)} muted small />
              <Row label={`Utilidad bruta (${formatCordobas(item.salePrice || 0)} − ${formatCordobas(unitCost)})`} value={formatCordobas(unitUB)} sub small />

              {/* Desglose de costos fijos por categoría */}
              {cfCategoryKeys.map((k) => (
                <Row
                  key={k}
                  label={CF_LABELS[k] || k}
                  value={unitCFDesglose![k] > 0 ? `−${formatCordobas(unitCFDesglose![k])}` : "—"}
                  muted
                  small
                />
              ))}
              <Row dot={SEG.fijos} label={`Costos fijos agregados`} value={unitCF > 0 ? `−${formatCordobas(unitCF)}` : "—"} muted small />
              <Row label="Utilidad neta (UB − CF)" value={formatCordobas(unitUN)} sub small />
              <Row dot={SEG.comision} label={`Comisión vendedor (${comPct}%)`} value={formatCordobas(unitCom)} small />
              <Row dot={SEG.ganancia} label="Ganancia tienda" value={formatCordobas(unitGan)} strong small />
            </dl>
          </div>

          {/* ── PASO 2: Total × cantidad (solo si qty > 1) ── */}
          {qty > 1 && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent-2">
                Paso 2 — Total × {qty} unidades
              </span>
              <dl className="nums divide-y divide-border/40 text-xs mt-1">
                <Row label="Importe" value={formatCordobas((item.salePrice || 0) * qty)} small />
                <Row dot={SEG.costo} label="Costo real total" value={formatCordobas(item.costReal ?? 0)} muted small />
                <Row label="Utilidad bruta total" value={formatCordobas(item.utilidadBruta ?? 0)} sub small />
                <Row dot={SEG.fijos} label="Costos fijos total" value={item.costosFijos ? `−${formatCordobas(item.costosFijos)}` : "—"} muted small />
                <Row label="Utilidad neta total" value={formatCordobas(item.utilidadNeta ?? 0)} sub small />
                <Row dot={SEG.comision} label="Comisión vendedor total" value={formatCordobas(item.comisionVendedor ?? 0)} small />
                <Row dot={SEG.ganancia} label="Ganancia tienda total" value={formatCordobas(item.gananciaTienda ?? 0)} strong small />
                <Row label="Inversión recuperada" value={formatCordobas(item.inversionRecuperada ?? item.costReal ?? 0)} muted small />
              </dl>
            </div>
          )}

          {qty === 1 && (
            <Row label="Inversión recuperada" value={formatCordobas(item.inversionRecuperada ?? unitCost)} muted small />
          )}
        </div>
      )}
    </div>
  );
}

function Row({ dot, label, value, muted, sub, strong, small }: {
  dot?: string;
  label: string;
  value: string;
  muted?: boolean;
  sub?: boolean;
  strong?: boolean;
  small?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between", sub ? `py-0.5 pl-4 ${small ? "text-[11px]" : "text-xs"}` : small ? "py-0.5 text-[11px]" : "py-1.5")}>
      <dt className={cn("flex items-center gap-1.5", strong ? "font-semibold text-text" : muted || sub ? "text-muted" : "font-medium")}>
        {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />}
        {label}
      </dt>
      <dd className={cn("font-semibold", strong ? `${small ? "text-xs" : "text-base"} text-accent-2` : muted || sub ? "text-muted" : "text-text")}>
        {value}
      </dd>
    </div>
  );
}
