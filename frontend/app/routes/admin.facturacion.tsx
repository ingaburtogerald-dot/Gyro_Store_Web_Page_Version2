// Portal de Facturación: tickets POS 80mm que reservan stock FIFO al crearse.
import { RequireRole } from "~/components/admin/RequireRole";
import { InvoicingPanel } from "~/components/admin/invoices/InvoicingPanel";

export default function Facturacion() {
  return (
    <RequireRole allowed={["admin", "cashier"]}>
      <InvoicingPanel />
    </RequireRole>
  );
}
