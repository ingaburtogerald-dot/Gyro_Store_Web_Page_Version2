// Historial de interacciones de un contacto + compositor para registrar una nueva.
// Reemplaza el "campo nota único" del CRM legacy por un log real con autor y fecha.
import { useState } from "react";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { cn } from "~/lib/utils";
import { DatePicker } from "~/components/ui/DatePicker";
import { useGetActivitiesQuery, useAddActivityMutation, type ActivityType } from "~/store/api/contactsApi";
import { ACTIVITY_META, fmtWhen, fmtDate, isoFromYmd } from "./crmMeta";

const COMPOSE_TYPES: ActivityType[] = ["call", "whatsapp", "note", "restock", "meeting"];

export function ActivityTimeline({ contactId }: { contactId: string }) {
  const { data: activities = [], isLoading } = useGetActivitiesQuery(contactId);
  const [addActivity, { isLoading: saving }] = useAddActivityMutation();

  const [type, setType] = useState<ActivityType>("call");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState(""); // "YYYY-MM-DD" para programar un recordatorio

  async function submit() {
    if (!body.trim() && !dueDate) {
      toast.error("Escribe qué pasó o programa una fecha.");
      return;
    }
    try {
      await addActivity({
        contactId,
        body: {
          type,
          body: body.trim(),
          dueAt: isoFromYmd(dueDate),
        },
      }).unwrap();
      setBody("");
      setDueDate("");
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo registrar la actividad.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-border bg-surface-2/40 p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {COMPOSE_TYPES.map((t) => {
            const m = ACTIVITY_META[t];
            const Icon = m.icon;
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-pill px-2 py-1 text-xs font-medium transition-colors",
                  type === t ? "bg-gradient-accent text-white" : "border border-border text-muted hover:text-text",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {m.label}
              </button>
            );
          })}
        </div>

        <textarea
          className="input"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="¿Qué pasó en esta interacción? (ej. no contestó, pidió que le hable el viernes…)"
        />

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Clock className="h-3.5 w-3.5" /> Recordar el
          </span>
          <div className="w-[160px]">
            <DatePicker value={dueDate} onChange={setDueDate} placeholder="Sin recordatorio" />
          </div>
          <button
            onClick={submit}
            disabled={saving}
            className="ml-auto rounded-pill bg-gradient-accent px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Registrar"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-4 text-center text-sm text-muted">Cargando historial…</p>
      ) : activities.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">Aún no hay interacciones registradas.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-border pl-4">
          {activities.map((a) => {
            const m = ACTIVITY_META[a.type] ?? ACTIVITY_META.note;
            const Icon = m.icon;
            return (
              <li key={a.id} className="relative">
                <span className="absolute -left-[22px] flex h-4 w-4 items-center justify-center rounded-full bg-surface ring-1 ring-border">
                  <Icon className="h-2.5 w-2.5 text-muted" />
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text">{m.label}</span>
                  {a.dueAt && !a.done && (
                    <span className="rounded-pill bg-amber-500/15 px-1.5 text-[10px] font-medium text-amber-300">
                      programado {fmtDate(a.dueAt)}
                    </span>
                  )}
                </div>
                {a.body && <p className="mt-0.5 text-sm text-text/90">{a.body}</p>}
                <p className="mt-0.5 text-[11px] text-muted">
                  {a.authorName} · {a.createdAt ? fmtWhen(a.createdAt) : "ahora"}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
