// Utilidades del CRM de seguimientos: semáforo por fecha y link de WhatsApp.
import type { Followup } from "~/store/api/followupsApi";
import type { BadgeStatus } from "~/components/ui/StatusBadge";

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type DueState = "overdue" | "today" | "upcoming" | "closed";

// Estado visual de un seguimiento según su fecha (solo aplica si está pendiente).
export function dueState(f: Followup): DueState {
  if (f.status !== "pending") return "closed";
  const today = todayYmd();
  if (f.followUpDate < today) return "overdue";
  if (f.followUpDate === today) return "today";
  return "upcoming";
}

// ¿Requiere atención hoy o antes? (vencido o de hoy, y pendiente)
export function isDue(f: Followup): boolean {
  return f.status === "pending" && f.followUpDate <= todayYmd();
}

export const DUE_META: Record<DueState, { label: string; dot: string; text: string }> = {
  overdue: { label: "Vencido", dot: "bg-danger", text: "text-danger" },
  today: { label: "Hoy", dot: "bg-warning", text: "text-warning" },
  upcoming: { label: "Próximo", dot: "bg-info", text: "text-info" },
  closed: { label: "—", dot: "bg-muted/40", text: "text-muted" },
};

export const TYPE_META: Record<Followup["type"], { label: string; cls: string }> = {
  callback: { label: "📞 Llamar", cls: "bg-tone-indigo/15 text-tone-indigo" },
  restock: { label: "📦 Avisar stock", cls: "bg-accent/15 text-accent-2" },
  other: { label: "📝 Otro", cls: "bg-muted/15 text-muted" },
};

// Tono del StatusBadge canónico por estado del seguimiento.
export const STATUS_META: Record<Followup["status"], { label: string; status: BadgeStatus }> = {
  pending: { label: "Pendiente", status: "pending" },
  done: { label: "Hecho", status: "whatsapp" },
  lost: { label: "Perdido", status: "error" },
};

// Link de WhatsApp; antepone 505 (Nicaragua) a números locales de 8 dígitos.
export function waLink(phone: string, text: string): string {
  let digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 8) digits = `505${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
