// Container de Ventas Pendientes — reemplazo del God component PendingSales (640 líneas).
// SOLO orquesta: hook de acciones + columnas declarativas + tabla + dispatcher de modales.
// Cero lógica de negocio, cero try/catch, cero useMemo de columnas. Drop-in: recibe las
// mismas props que recibía PendingSales (la lista y los KPIs viven en AdminSales).
import { Plus } from "lucide-react";
import { DataTable } from "~/components/ui/DataTable";
import { AdminSaleCard } from "./AdminSaleCard";
import { pendingSalesColumns } from "./pendingSalesColumns";
import { SaleBulkActionBar } from "./SaleBulkActionBar";
import { SaleModals } from "~/components/shared/sales/SaleModals";
import { useAdminSaleActions } from "~/hooks/sales/useAdminSaleActions";
import type { Sale } from "~/store/api/salesApi";

interface Props {
  sales: Sale[];
  isLoading: boolean;
  onRegisterSale?: () => void;
}

export function PendingSalesContainer({ sales, isLoading, onRegisterSale }: Props) {
  const actions = useAdminSaleActions(sales);

  return (
    <div className="relative space-y-4 rounded-card border border-border bg-surface shadow-premium p-4">
      <div className="sticky top-0 z-30 flex flex-col items-start justify-between gap-4 bg-surface pb-2 lg:flex-row">
        <div>
          <h2 className="text-lg font-bold text-text">Ventas Pendientes de Aprobación</h2>
          <p className="text-xs text-muted">
            Revisa las transacciones reportadas y audita sus utilidades. Selecciona una fila para editarla o eliminarla.
          </p>
        </div>
        {onRegisterSale && (
          <button
            onClick={onRegisterSale}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-gradient-accent px-4 py-2 text-sm font-bold text-white shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)] transition-all hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            <span>Registrar Venta</span>
          </button>
        )}
      </div>

      {actions.selectedSales.length > 0 && (
        <SaleBulkActionBar
          sales={actions.selectedSales}
          paying={actions.loading.paying}
          onEdit={() => actions.beginEdit(actions.selectedSales[0])}
          onReject={() => actions.beginReject(actions.selectedSales)}
          onDelete={() => actions.beginDelete(actions.selectedSales)}
          onApprove={() => actions.beginBulkApprove(actions.selectedSales)}
          onCancel={actions.clearSelection}
        />
      )}

      <DataTable
        columns={pendingSalesColumns}
        data={sales}
        isLoading={isLoading}
        hideSearch
        emptyText="No hay ventas pendientes de aprobación. 🎉"
        onRowClick={(row) => actions.toggle(row.id)}
        selectedRowIds={actions.selected}
        onSelectAll={actions.selectAll}
        allSelected={actions.isAllSelected}
        initialSorting={[{ id: "createdAt", desc: false }]}
        mobileCard={(s) => <AdminSaleCard sale={s} />}
      />

      <SaleModals actions={actions} />
    </div>
  );
}
