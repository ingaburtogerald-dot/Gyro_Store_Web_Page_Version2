// Utilidades del CRM de seguimientos: semáforo por fecha y link de WhatsApp.
import type { Followup } from "~/store/api/followupsApi";

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
  overdue: { label: "Vencido", dot: "bg-red-500", text: "text-red-400" },
  today: { label: "Hoy", dot: "bg-amber-400", text: "text-amber-300" },
  upcoming: { label: "Próximo", dot: "bg-sky-400", text: "text-sky-300" },
  closed: { label: "—", dot: "bg-muted/40", text: "text-muted" },
};

export const TYPE_META: Record<Followup["type"], { label: string; cls: string }> = {
  callback: { label: "📞 Llamar", cls: "bg-indigo-500/15 text-indigo-300" },
  restock: { label: "📦 Avisar stock", cls: "bg-emerald-500/15 text-emerald-300" },
  other: { label: "📝 Otro", cls: "bg-slate-500/15 text-slate-300" },
};

export const STATUS_META: Record<Followup["status"], { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-amber-500/15 text-amber-300" },
  done: { label: "Hecho", cls: "bg-whatsapp/15 text-whatsapp" },
  lost: { label: "Perdido", cls: "bg-rose-500/15 text-rose-300" },
};

// Link de WhatsApp; antepone 505 (Nicaragua) a números locales de 8 dígitos.
export function waLink(phone: string, text: string): string {
  let digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 8) digits = `505${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
