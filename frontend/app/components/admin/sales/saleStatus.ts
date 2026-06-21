// Etiquetas y colores de estado de venta (reutilizado en vistas de vendedor y admin).
import type { SaleStatus } from "~/store/api/salesApi";

export const SALE_STATUS_META: Record<SaleStatus, { label: string; cls: string }> = {
  pending_approval: { label: "Pendiente", cls: "bg-amber-500/15 text-amber-300" },
  approved: { label: "Aprobada", cls: "bg-accent/15 text-accent-2" },
  rejected: { label: "Rechazada", cls: "bg-red-500/15 text-red-300" },
  paid: { label: "Pagada", cls: "bg-whatsapp/15 text-whatsapp" },
};
