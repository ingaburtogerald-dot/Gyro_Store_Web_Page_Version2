// Portal Gyro Logistics. Admins/logistics_admin gestionan todos los paquetes;
// los clientes (logistics_customer) registran y siguen los suyos.
import { RequireRole } from "~/components/admin/RequireRole";
import { AdminLogistics } from "~/components/admin/logistics/AdminLogistics";
import { CustomerLogistics } from "~/components/admin/logistics/CustomerLogistics";
import { useAppSelector } from "~/store/hooks";
import { selectRoles } from "~/store/slices/authSlice";

export default function Logistica() {
  const roles = useAppSelector(selectRoles);
  const isLogisticsAdmin =
    roles.includes("global_admin") || roles.includes("admin") || roles.includes("logistics_admin");

  return (
    <RequireRole allowed={["admin", "logistics_admin", "logistics_customer"]}>
      {isLogisticsAdmin ? <AdminLogistics /> : <CustomerLogistics />}
    </RequireRole>
  );
}
