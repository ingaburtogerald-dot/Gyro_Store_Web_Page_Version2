import { ShoppingBag, BarChart3, Truck, Users, CreditCard, Settings, KanbanSquare, Boxes, ReceiptText, ClipboardList, Search, Lightbulb, Ticket } from "lucide-react";
import { useGetAgendaQuery } from "~/store/api/contactsApi";
import { useGetSalesPaginatedQuery, useGetPublicOrdersQuery } from "~/store/api/salesApi";
import { isDue } from "~/components/admin/crm/crmMeta";
import type { Role } from "~/lib/constants";
import type React from "react";

export interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Tienda",
    items: [
      { to: "/admin/catalogo", label: "Gestión de Catálogo", icon: Boxes, roles: ["admin"] },
      { to: "/admin/codigos-descuento", label: "Códigos de descuento", icon: Ticket, roles: ["admin"] },
      { to: "/admin/facturacion", label: "Facturación", icon: ReceiptText, roles: ["admin", "cashier"] },
    ],
  },
  {
    label: "Operación",
    items: [
      { to: "/admin/inventario", label: "Inventario", icon: ClipboardList, roles: ["admin"] },
      { to: "/admin/ventas", label: "Ventas", icon: ShoppingBag, roles: ["admin", "seller"] },
      { to: "/admin/crm", label: "CRM & Pedidos", icon: KanbanSquare, roles: ["admin", "seller"] },
      { to: "/admin/cuotas", label: "Cuotas", icon: CreditCard, roles: ["admin"] },
    ],
  },
  {
    label: "Análisis y sistema",
    items: [
      { to: "/admin/reportes", label: "Reportes", icon: BarChart3, roles: ["admin"] },
      { to: "/admin/busquedas", label: "Búsquedas", icon: Search, roles: ["admin"] },
      { to: "/admin/feedback", label: "Feedback", icon: Lightbulb, roles: ["admin"] },
      {
        to: "/admin/logistica",
        label: "Gyro Logistics",
        icon: Truck,
        roles: ["admin", "logistics_admin", "logistics_customer"],
      },
      { to: "/admin/usuarios", label: "Usuarios", icon: Users, roles: ["admin"] },
      { to: "/admin/configuracion", label: "Configuración", icon: Settings, roles: ["admin"] },
    ],
  },
];

export function roleLabel(roles: Role[]): string {
  if (roles.includes("global_admin") || roles.includes("admin")) return "Admin";
  if (roles.includes("seller")) return "Vendedor";
  if (roles.includes("cashier")) return "Cajero";
  if (roles.includes("logistics_admin")) return "Logística";
  if (roles.includes("logistics_customer")) return "Cliente Logistics";
  return "Usuario";
}

export function useNavBadges(roles: Role[]): Record<string, number> {
  const isAdmin = roles.includes("global_admin") || roles.includes("admin");
  const canCRM = isAdmin || roles.includes("seller");
  const { data: agenda = [] } = useGetAgendaQuery(undefined, { skip: !canCRM });
  const { data: pending } = useGetSalesPaginatedQuery(
    { page: 1, limit: 50, status: "pending_approval", sellerEmail: "all", date: "all" },
    { skip: !isAdmin, pollingInterval: 15000 },
  );
  const { data: publicOrders = [] } = useGetPublicOrdersQuery(undefined, { skip: !isAdmin, pollingInterval: 30000 });

  const crmCount = agenda.filter(isDue).length;
  const whatsappCount = isAdmin ? publicOrders.filter((o: any) => !o.contacted && !o.archived).length : 0;

  return {
    "/admin/ventas": isAdmin ? pending?.total ?? 0 : 0,
    "/admin/crm": crmCount + whatsappCount,
  };
}
