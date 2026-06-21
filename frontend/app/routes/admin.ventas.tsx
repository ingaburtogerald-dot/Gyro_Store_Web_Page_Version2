// Portal de Ventas. Admins ven la gestión completa; los vendedores, su propia vista.
import { RequireRole } from "~/components/admin/RequireRole";
import { AdminSales } from "~/components/admin/sales/AdminSales";
import { SellerSales } from "~/components/admin/sales/SellerSales";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin } from "~/store/slices/authSlice";

export default function Ventas() {
  const isAdmin = useAppSelector(selectIsAdmin);

  return (
    <RequireRole allowed={["admin", "seller"]}>
      {isAdmin ? <AdminSales /> : <SellerSales />}
    </RequireRole>
  );
}
