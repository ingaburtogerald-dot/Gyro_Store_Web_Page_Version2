// Layout del Centro de Administración. Envuelve todas las rutas /admin.* con el
// gate de roles y el shell (sidebar + header). Las sub-rutas se renderizan en <Outlet>.
import { Outlet } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { RequireRole } from "~/components/admin/RequireRole";
import type { Role } from "~/lib/constants";

export const meta: MetaFunction = () => [{ title: "Centro de Administración · Gyro Store" }];

// Cualquier rol del staff puede entrar al admin; cada sub-ruta valida lo suyo.
const STAFF_ROLES: Role[] = [
  "admin",
  "seller",
  "cashier",
  "logistics_admin",
  "logistics_customer",
];

export default function AdminLayout() {
  return (
    <RequireRole allowed={STAFF_ROLES}>
      <Outlet />
    </RequireRole>
  );
}
