// Metadatos y helpers del CRM v2 (embudo + actividades). Autocontenido: no depende
// del módulo legacy `followups`, para que este pueda retirarse sin tocar el CRM.
import { Phone, MessageCircle, StickyNote, Package, Users, type LucideIcon } from "lucide-react";
import type { CrmStage, ActivityType, Contact } from "~/store/api/contactsApi";

// Link de WhatsApp: normaliza a 8 dígitos → antepone el código de Nicaragua (505).
export function waLink(phone: string, text: string): string {
  let digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 8) digits = `505${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export const STAGE_ORDER: CrmStage[] = ["new", "contacted", "negotiating", "won", "lost"];

export const STAGE_META: Record<CrmStage, { label: string; accent: string; dot: string; ring: string }> = {
  new:         { label: "Nuevo",      accent: "text-sky-300",     dot: "bg-sky-400",     ring: "border-sky-500/40" },
  contacted:   { label: "Contactado", accent: "text-indigo-300",  dot: "bg-indigo-400",  ring: "border-indigo-500/40" },
  negotiating: { label: "Negociando", accent: "text-amber-300",   dot: "bg-amber-400",   ring: "border-amber-500/40" },
  won:         { label: "Ganado",     accent: "text-emerald-300", dot: "bg-emerald-400", ring: "border-emerald-500/40" },
  lost:        { label: "Perdido",    accent: "text-rose-300",    dot: "bg-rose-400",    ring: "border-rose-500/40" },
};

export const ACTIVITY_META: Record<ActivityType, { label: string; icon: LucideIcon }> = {
  call:     { label: "Llamada",  icon: Phone },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  note:     { label: "Nota",     icon: StickyNote },
  restock:  { label: "Stock",    icon: Package },
  meeting:  { label: "Reunión",  icon: Users },
};

export type DueState = "overdue" | "today" | "upcoming" | "none" | "closed";

// Semáforo basado en la próxima tarea (con hora, no solo día).
export function dueState(c: Contact): DueState {
  if (c.stage === "won" || c.stage === "lost") return "closed";
  if (!c.nextActivityAt) return "none";
  const due = new Date(c.nextActivityAt);
  const now = new Date();
  if (due.getTime() < now.getTime()) return "overdue";
  const sameDay =
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate();
  return sameDay ? "today" : "upcoming";
}

export const DUE_META: Record<DueState, { label: string; dot: string; text: string }> = {
  overdue:  { label: "Vencido", dot: "bg-red-500",   text: "text-red-400" },
  today:    { label: "Hoy",     dot: "bg-amber-400", text: "text-amber-300" },
  upcoming: { label: "Próximo", dot: "bg-sky-400",   text: "text-sky-300" },
  none:     { label: "Sin tarea", dot: "bg-muted/40", text: "text-muted" },
  closed:   { label: "—",       dot: "bg-muted/40",  text: "text-muted" },
};

// ¿La próxima tarea del contacto está vencida o es para hoy? (para campana/badge)
export function isDue(c: Contact): boolean {
  const s = dueState(c);
  return s === "overdue" || s === "today";
}

// Formatea una fecha ISO a algo corto y legible (con hora si la tiene).
export function fmtWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return d.toLocaleDateString("es-NI", {
    day: "2-digit",
    month: "short",
    ...(hasTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
