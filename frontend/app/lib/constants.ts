// Constantes compartidas del frontend. Las constantes de negocio que pueden
// cambiar (categorías, descuentos, WhatsApp) llegan desde GET /api/config;
// aquí solo viven las que son estructurales o de respaldo.

// Tipo de cambio fijo USD → Córdobas (respaldo; la fuente real es /api/config).
export const EXCHANGE_RATE = 37;

export const CURRENCY = "C$";

export const WHATSAPP_NUMBER = "50585944758";

// Roles del sistema
export const ROLES = {
  GLOBAL_ADMIN: "global_admin",
  ADMIN: "admin",
  SELLER: "seller",
  CASHIER: "cashier",
  LOGISTICS_ADMIN: "logistics_admin",
  LOGISTICS_CUSTOMER: "logistics_customer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  global_admin: "Administrador Global",
  admin: "Administrador",
  seller: "Vendedor",
  cashier: "Cajero",
  logistics_admin: "Admin. Logistics",
  logistics_customer: "Cliente Logistics",
};

// Color del badge por rol (clases Tailwind)
export const ROLE_BADGE: Record<Role, string> = {
  global_admin: "bg-accent/20 text-accent-2",
  admin: "bg-accent/15 text-accent-2",
  seller: "bg-whatsapp/15 text-whatsapp",
  cashier: "bg-amber-500/15 text-amber-300",
  logistics_admin: "bg-sky-500/15 text-sky-300",
  logistics_customer: "bg-slate-500/15 text-slate-300",
};

// Roles que habilitan el Centro de Administración
export const ADMIN_ROLES: Role[] = ["global_admin", "admin"];

// Ruta de aterrizaje del panel según los roles (compartida por login y header).
export function roleLandingPath(roles: Role[]): string {
  if (roles.some((r) => ADMIN_ROLES.includes(r))) return "/admin";
  if (roles.includes("seller")) return "/admin/ventas";
  if (roles.includes("cashier")) return "/admin/facturacion";
  if (roles.includes("logistics_admin") || roles.includes("logistics_customer")) return "/admin/logistica";
  return "/";
}

// Estados de órdenes/ventas
export const ORDER_STATUS = {
  PENDING: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  PAID: "paid",
} as const;

// Estados de paquetes de logística
export const SHIPMENT_STATUS = {
  REGISTERED: "compra_registrada",
  CHINA: "recibido_china",
  NICARAGUA: "recibido_nicaragua",
} as const;
