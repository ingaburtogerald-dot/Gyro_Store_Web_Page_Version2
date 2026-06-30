// Portal de Ventas. Shell unificado: admins y vendedores ven el mismo diseño;
// AdminSales adapta secciones y contenido al rol (el vendedor solo ve lo suyo).
import { RequireRole } from "~/components/admin/RequireRole";
import { AdminSales } from "~/components/admin/sales/AdminSales";

export default function Ventas() {
  return (
    <RequireRole allowed={["admin", "seller"]}>
      <AdminSales />
    </RequireRole>
  );
}
