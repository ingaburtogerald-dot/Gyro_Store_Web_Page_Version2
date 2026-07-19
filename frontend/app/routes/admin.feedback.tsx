// Feedback público (Centro de Administración). Bugs, ideas y pedidos de producto
// que dejan los visitantes desde el FAB del storefront (ver FeedbackModal). Se
// agrupan visualmente por tipo; cada tarjeta se puede marcar como resuelta.
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Bug, Lightbulb, Package, Phone, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { RequireRole } from "~/components/admin/RequireRole";
import { Skeleton } from "~/components/ui/Skeleton";
import { cn } from "~/lib/utils";
import {
  useGetFeedbackQuery,
  useUpdateFeedbackStatusMutation,
  type Feedback,
  type FeedbackType,
} from "~/store/api/feedbackApi";

const GROUPS: { type: FeedbackType; label: string; icon: typeof Bug; emoji: string }[] = [
  { type: "bug", label: "Bugs", icon: Bug, emoji: "🐛" },
  { type: "idea", label: "Ideas", icon: Lightbulb, emoji: "💡" },
  { type: "product", label: "Productos", icon: Package, emoji: "📦" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminFeedback() {
  const { data = [], isLoading } = useGetFeedbackQuery();
  const [updateStatus] = useUpdateFeedbackStatusMutation();

  const byType = useMemo(() => {
    const map = new Map<FeedbackType, Feedback[]>();
    for (const item of data) {
      const list = map.get(item.type) ?? [];
      list.push(item);
      map.set(item.type, list);
    }
    return map;
  }, [data]);

  const pendingCount = data.filter((f) => f.status === "new").length;

  async function toggleStatus(item: Feedback) {
    const next = item.status === "new" ? "resolved" : "new";
    try {
      await updateStatus({ id: item.id, status: next }).unwrap();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo actualizar el estado.");
    }
  }

  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Feedback</h1>
          <p className="text-muted">
            Bugs, ideas y pedidos de producto que dejan tus visitantes.
            {!isLoading && pendingCount > 0 && ` ${pendingCount} sin resolver.`}
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-card" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {GROUPS.map((g) => (
              <FeedbackGroup key={g.type} group={g} items={byType.get(g.type) ?? []} onToggle={toggleStatus} />
            ))}
          </div>
        )}
      </div>
    </RequireRole>
  );
}

function FeedbackGroup({
  group,
  items,
  onToggle,
}: {
  group: (typeof GROUPS)[number];
  items: Feedback[];
  onToggle: (item: Feedback) => void;
}) {
  return (
    <section className="card-premium flex flex-col rounded-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent-2" aria-hidden>
          <group.icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-bold tracking-tight text-text">
            {group.emoji} {group.label}
          </h2>
          <p className="text-sm font-light text-muted">{items.length} mensaje{items.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted">
          Nada por aquí todavía.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "rounded-xl border border-border/70 p-3.5 transition-opacity",
                item.status === "resolved" && "opacity-50",
              )}
            >
              <p className="text-sm leading-relaxed text-pretty text-text">{item.message}</p>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  {item.userPhone && (
                    <span className="flex items-center gap-1 truncate text-xs text-muted">
                      <Phone className="h-3 w-3 shrink-0" /> {item.userPhone}
                    </span>
                  )}
                  <span className="text-xs text-muted">{formatDate(item.createdAt)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onToggle(item)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    item.status === "resolved"
                      ? "bg-surface-2 text-muted hover:text-text"
                      : "bg-accent/12 text-accent-2 hover:bg-accent/20",
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {item.status === "resolved" ? "Resuelto" : "Marcar resuelto"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border py-16 text-center"
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/8 text-accent-2 ring-1 ring-inset ring-accent/15" aria-hidden>
        <Lightbulb className="h-5 w-5" />
      </span>
      <p className="max-w-xs text-balance text-sm text-muted">
        Aún no hay feedback registrado. Aparecerá aquí cuando alguien use el botón de la tienda.
      </p>
    </motion.div>
  );
}
