// Desglose financiero del cotizador en vivo (los 6 pasos del cálculo).
import { Loader2, Receipt, Wallet, TrendingUp } from "lucide-react";
import type { QuoteResult } from "~/store/api/salesApi";
import { formatCordobas } from "~/lib/utils";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin } from "~/store/slices/authSlice";

export function QuoteSummary({ result, loading, errorMsg }: { result: QuoteResult | null; loading: boolean; errorMsg?: string }) {
  const isAdmin = useAppSelector(selectIsAdmin);

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-accent-2" />
        <h3 className="font-semibold">Resumen</h3>
        {loading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-accent" />}
      </div>

      {errorMsg ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs font-medium text-red-400">
          {errorMsg}
        </div>
      ) : !result ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Wallet className="h-8 w-8 text-muted/40" />
          <p className="text-sm text-muted">Agrega productos y precio de venta para ver la estimación.</p>
        </div>
      ) : (
        <>
          {/* Total "hero" */}
          <p className="text-xs text-muted">Importe total</p>
          <p className="mb-3 text-3xl font-bold text-text">{formatCordobas(result.saleTotal)}</p>

          {/* Barra de proporción costo / costos fijos / comisión / ganancia (solo admin) */}
          {isAdmin && result.saleTotal > 0 && (() => {
            const total = result.saleTotal;
            const pct = (n: number) => `${Math.max(0, (n / total) * 100)}%`;
            return (
              <>
                <div className="mb-1.5 flex h-2 overflow-hidden rounded-pill bg-surface-2">
                  <div style={{ width: pct(result.costReal) }} className="bg-slate-400/50" />
                  <div style={{ width: pct(result.costosFijos) }} className="bg-amber-500/70" />
                  <div style={{ width: pct(result.comisionVendedor) }} className="bg-whatsapp" />
                  <div style={{ width: pct(result.gananciaTienda) }} className="bg-accent" />
                </div>
                <div className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
                  <Legend color="bg-slate-400/50" label="Costo" />
                  <Legend color="bg-amber-500/70" label="C. fijos" />
                  <Legend color="bg-whatsapp" label="Comisión" />
                  <Legend color="bg-accent" label="Ganancia" />
                </div>
              </>
            );
          })()}

          {/* Desglose detallado (solo admin) */}
          {isAdmin && (
            <dl className="space-y-2 text-sm">
              <Row label="Costo real del producto" value={formatCordobas(result.costReal)} muted />
              <Row label="Utilidad bruta" value={formatCordobas(result.utilidadBruta)} />
              <Row label={`Costos fijos (${result.costosFijosPct}%)`} value={`-${formatCordobas(result.costosFijos)}`} muted />
              <Row label="Utilidad neta" value={formatCordobas(result.utilidadNeta)} />
              <Row label="Ganancia tienda" value={formatCordobas(result.gananciaTienda)} muted />
            </dl>
          )}

          {/* Comisión destacada (para todos) */}
          <div className="mt-3 flex items-center justify-between rounded-xl border border-whatsapp/30 bg-whatsapp/10 p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-whatsapp" />
              <span className="text-sm font-medium text-text">
                {isAdmin ? "Comisión estimada" : "Tu comisión esperada"}
                {isAdmin && result.comisionPercent ? ` (${result.comisionPercent}%)` : ""}
              </span>
            </div>
            <span className="text-xl font-bold text-whatsapp">{formatCordobas(result.comisionVendedor)}</span>
          </div>
        </>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? "font-normal text-muted" : "font-medium"}>{label}</dt>
      <dd className={`font-semibold ${muted ? "text-muted" : "text-text"}`}>{value}</dd>
    </div>
  );
}
