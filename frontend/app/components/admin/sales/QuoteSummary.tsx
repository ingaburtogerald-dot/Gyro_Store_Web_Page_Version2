// Desglose financiero del cotizador en vivo (los 6 pasos del cálculo).
import { Loader2 } from "lucide-react";
import type { QuoteResult } from "~/store/api/salesApi";
import { formatCordobas } from "~/lib/utils";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin } from "~/store/slices/authSlice";

export function QuoteSummary({ result, loading, errorMsg }: { result: QuoteResult | null; loading: boolean; errorMsg?: string }) {
  const isAdmin = useAppSelector(selectIsAdmin);

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Cotización</h3>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
      </div>

      {errorMsg ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs font-medium text-red-400">
          {errorMsg}
        </div>
      ) : !result ? (
        <p className="py-6 text-center text-sm text-muted">
          Selecciona productos y precio de venta para ver la estimación.
        </p>
      ) : isAdmin ? (
        <dl className="space-y-2 text-sm">
          <Row label="Importe total" value={formatCordobas(result.saleTotal)} />
          <Row label="Costo real del producto" value={formatCordobas(result.costReal)} muted />
          <Row label="Utilidad bruta" value={formatCordobas(result.utilidadBruta)} />
          <Row label={`Costos fijos (${result.costosFijosPct}%)`} value={`-${formatCordobas(result.costosFijos)}`} muted />
          <Row label="Utilidad neta" value={formatCordobas(result.utilidadNeta)} />
          <div className="my-2 border-t border-border" />
          <Row label="💰 Tu comisión estimada" value={`${formatCordobas(result.comisionVendedor)} (${result.comisionPercent || 0}%)`} accent />
          <Row label="Ganancia tienda" value={formatCordobas(result.gananciaTienda)} muted />
        </dl>
      ) : (
        <dl className="space-y-3 text-sm">
          <Row label="Importe total" value={formatCordobas(result.saleTotal)} />
          <div className="my-2 border-t border-border" />
          <Row label="💰 Tu comisión esperada" value={formatCordobas(result.comisionVendedor)} accent />
        </dl>
      )}
    </div>
  );
}

function Row({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? "text-muted font-normal" : "font-medium"}>{label}</dt>
      <dd className={`font-semibold ${accent ? "text-lg font-bold text-whatsapp" : "text-text"}`}>{value}</dd>
    </div>
  );
}

