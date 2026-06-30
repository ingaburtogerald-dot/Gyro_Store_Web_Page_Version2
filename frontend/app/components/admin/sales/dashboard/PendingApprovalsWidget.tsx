// Alerta de acciones pendientes: ventas por aprobar. Se auto-fetchea (independiente
// del filtro de fecha, porque las aprobaciones son urgentes sin importar el período)
// y enlaza al tab operativo real (Ventas → Pendientes) en vez de duplicar el flujo.
import { useMemo } from "react";
import { useSearchParams } from "@remix-run/react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { useGetSalesPaginatedQuery } from "~/store/api/salesApi";
import { formatCordobas } from "~/lib/utils";
import { useSalesDashboard } from "./useSalesDashboard";
import { WidgetShell, SkeletonLine } from "./WidgetShell";

export function PendingApprovalsWidget() {
  const { filters } = useSalesDashboard();
  const [, setSearchParams] = useSearchParams();

  const { data, isLoading } = useGetSalesPaginatedQuery({
    page: 1,
    limit: 200,
    status: "pending_approval",
    sellerEmail: filters.seller,
    date: "all",
  });

  const { count, monto } = useMemo(() => {
    const list = data?.data ?? [];
    return { count: list.length, monto: list.reduce((acc, s) => acc + (s.saleTotal || 0), 0) };
  }, [data]);

  function goToApprovals() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("section", "ventas");
        next.set("sub", "pending");
        return next;
      },
      { replace: false },
    );
  }

  const hasPending = count > 0;

  return (
    <WidgetShell
      title="Acciones pendientes"
      icon={hasPending ? AlertTriangle : CheckCircle2}
      tone={hasPending ? "amber" : "emerald"}
    >
      {isLoading && !data ? (
        <div className="space-y-3">
          <SkeletonLine className="h-10 w-24" />
          <SkeletonLine className="w-2/3" />
          <SkeletonLine className="h-9 w-full" />
        </div>
      ) : hasPending ? (
        <div className="flex h-full flex-col">
          <div className="flex items-baseline gap-2">
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="nums font-heading text-4xl font-bold text-amber-400"
            >
              {count}
            </motion.span>
            <span className="text-sm text-muted">{count === 1 ? "venta por aprobar" : "ventas por aprobar"}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Monto en revisión: <span className="nums font-semibold text-text">{formatCordobas(monto)}</span>
          </p>
          <button
            onClick={goToApprovals}
            className="group mt-auto flex items-center justify-center gap-1.5 rounded-xl bg-amber-400/10 px-3 py-2.5 text-sm font-semibold text-amber-400 transition-colors hover:bg-amber-400/20"
          >
            Revisar aprobaciones
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      ) : (
        <div className="flex h-full min-h-32 flex-col items-center justify-center text-center">
          <CheckCircle2 className="mb-2 h-8 w-8 text-accent-2" />
          <p className="text-sm font-medium text-text">Todo al día</p>
          <p className="text-xs text-muted">No hay ventas pendientes de aprobación.</p>
        </div>
      )}
    </WidgetShell>
  );
}
