// Etiquetas y tono de estado de venta (reutilizado en vistas de vendedor y admin).
// El tono mapea al StatusBadge canónico del sistema de diseño.
import type { SaleStatus } from "~/store/api/salesApi";
import type { BadgeStatus } from "~/components/ui/StatusBadge";

export const SALE_STATUS_META: Record<SaleStatus, { label: string; status: BadgeStatus }> = {
  pending_approval: { label: "Pendiente", status: "pending" },
  approved: { label: "Aprobada", status: "success" },
  rejected: { label: "Rechazada", status: "error" },
  paid: { label: "Pagada", status: "whatsapp" },
};
