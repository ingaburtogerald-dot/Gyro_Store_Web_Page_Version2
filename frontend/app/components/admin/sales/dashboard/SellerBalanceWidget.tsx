// Widget del Bento para vendedores: "Mi resumen" — su dinero, sin datos confidenciales.
// Encabezado = comisión ESTIMADA de ventas aún en revisión (no aprobadas); abajo, la
// comisión ya por cobrar (aprobadas) y el saldo a favor/contra de ventas con ajustes.
import { Wallet } from "lucide-react";
import { useGetMyBalanceQuery } from "~/store/api/salesApi";
import { formatCordobas, cn } from "~/lib/utils";
import { WidgetShell, SkeletonLine } from "./WidgetShell";

export function SellerBalanceWidget() {
  const { data, isLoading } = useGetMyBalanceQuery();

  const comisionPendiente = data?.comisionPendiente ?? 0;
  const ventasPendientes = data?.ventasPendientes ?? 0;
  const comisionPorCobrar = data?.comisionPorCobrar ?? 0;
  const saldo = data?.saldo ?? 0;

  return (
    <WidgetShell title="Mi resumen" icon={Wallet} tone="emerald">
      {isLoading && !data ? (
        <div className="space-y-3">
          <SkeletonLine className="h-10 w-32" />
          <SkeletonLine className="w-2/3" />
          <SkeletonLine className="h-12 w-full" />
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <span className="text-xs text-muted">Comisiones pendientes</span>
          <p className="nums font-heading text-4xl font-bold text-whatsapp">
            {formatCordobas(comisionPendiente)}
          </p>
          <p className="mt-1 text-xs text-muted">
            estimadas de {ventasPendientes} venta{ventasPendientes === 1 ? "" : "s"} en revisión
          </p>

          <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
            <div className="rounded-xl border border-border bg-surface-2/40 p-3">
              <span className="block text-xs text-muted">Comisión por cobrar</span>
              <p className="nums font-semibold text-text">{formatCordobas(comisionPorCobrar)}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-2/40 p-3">
              <span className="block text-xs text-muted">
                {saldo > 0 ? "Saldo a favor" : saldo < 0 ? "Saldo en contra" : "Saldo"}
              </span>
              <p
                className={cn(
                  "nums font-semibold",
                  saldo > 0 ? "text-emerald-400" : saldo < 0 ? "text-red-400" : "text-text",
                )}
              >
                {formatCordobas(Math.abs(saldo))}
              </p>
            </div>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
