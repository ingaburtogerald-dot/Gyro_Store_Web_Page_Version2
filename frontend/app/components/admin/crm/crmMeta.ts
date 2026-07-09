// Metadatos y helpers de Seguimientos. Autocontenido: no depende del módulo legacy
// `followups`, para que este pueda retirarse sin tocar Seguimientos.
import { Phone, MessageCircle, StickyNote, Package, Users, type LucideIcon } from "lucide-react";
import type { ContactSource, ContactTag, ActivityType, Contact } from "~/store/api/contactsApi";

// Link de WhatsApp: normaliza a 8 dígitos → antepone el código de Nicaragua (505).
export function waLink(phone: string, text: string): string {
  let digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 8) digits = `505${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// Origen: cómo llegó el cliente (uno solo). Orden = orden en el <select>.
export const SOURCE_ORDER: ContactSource[] = ["facebook_ads", "social_chat", "whatsapp", "marketplace", "other"];
export const SOURCE_META: Record<ContactSource, { label: string; emoji: string; cls: string }> = {
  facebook_ads: { label: "Publicidad de Facebook", emoji: "📢", cls: "bg-info/15 text-info" },
  social_chat:  { label: "Chat de redes sociales",  emoji: "💬", cls: "bg-badge/15 text-badge-2" },
  whatsapp:     { label: "WhatsApp",                emoji: "🟢", cls: "bg-whatsapp/15 text-whatsapp" },
  marketplace:  { label: "Marketplace",             emoji: "🛒", cls: "bg-warning/15 text-warning" },
  other:        { label: "Otro",                    emoji: "•",  cls: "bg-muted/15 text-muted" },
};
// Fallback tolerante para valores heredados de la migración (ej. "migrated_followup").
export const sourceMeta = (s: string) => SOURCE_META[s as ContactSource] ?? SOURCE_META.other;

// Etiquetas: segmentación del cliente (varias). Orden = orden en el selector.
export const TAG_ORDER: ContactTag[] = ["retail", "reseller", "wholesale", "vip"];
export const TAG_META: Record<ContactTag, { label: string; cls: string }> = {
  retail:    { label: "Cliente al detalle", cls: "bg-info/15 text-info" },
  reseller:  { label: "Revendedor",         cls: "bg-tone-indigo/15 text-tone-indigo" },
  wholesale: { label: "Mayorista",          cls: "bg-accent/15 text-accent-2" },
  vip:       { label: "Cliente VIP",        cls: "bg-warning/15 text-warning" },
};
export const tagMeta = (t: string) => TAG_META[t as ContactTag] ?? { label: t, cls: "bg-muted/15 text-muted" };

export const ACTIVITY_META: Record<ActivityType, { label: string; icon: LucideIcon }> = {
  call:     { label: "Llamada",  icon: Phone },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  note:     { label: "Nota",     icon: StickyNote },
  restock:  { label: "Stock",    icon: Package },
  meeting:  { label: "Reunión",  icon: Users },
};

// Urgencia = clasificación del contacto según su próximo recordatorio y su estado.
export type Urgency = "overdue" | "today" | "upcoming" | "none" | "closed";

// Los recordatorios son por DÍA (sin hora): la urgencia se compara por día calendario.
export function dueState(c: Contact): Urgency {
  if (c.status === "closed") return "closed";
  if (!c.nextActivityAt) return "none";
  const d = new Date(c.nextActivityAt);
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (dueDay < todayDay) return "overdue";
  if (dueDay === todayDay) return "today";
  return "upcoming";
}

export const DUE_META: Record<Urgency, { label: string; dot: string; text: string; ring: string }> = {
  overdue:  { label: "Vencido", dot: "bg-danger",    text: "text-danger",    ring: "border-danger/40" },
  today:    { label: "Hoy",     dot: "bg-warning",  text: "text-warning",  ring: "border-warning/40" },
  upcoming: { label: "Próximo", dot: "bg-info",    text: "text-info",    ring: "border-info/40" },
  none:     { label: "Sin tarea", dot: "bg-muted", text: "text-muted",     ring: "border-border" },
  closed:   { label: "Cerrado", dot: "bg-accent", text: "text-accent-2", ring: "border-accent/40" },
};

// ¿Tiene un recordatorio vencido o para hoy? (campana + badge del menú)
export function isDue(c: Contact): boolean {
  const s = dueState(c);
  return s === "overdue" || s === "today";
}

// Fecha corta SIN hora — para recordatorios (día calendario). Ej. "15 jul".
export function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-NI", { day: "2-digit", month: "short" });
}

// Fecha con hora — para marcas de tiempo de actividades (createdAt). Ej. "15 jul, 09:30".
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

// "YYYY-MM-DD" local ↔ ISO (fijado al mediodía local para no saltar de día por zona horaria).
export function ymdFromIso(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function isoFromYmd(ymd: string): string | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}
