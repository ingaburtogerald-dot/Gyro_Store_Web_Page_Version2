// Campana de notificaciones del header: muestra los seguimientos vencidos / de hoy
// (pendientes) del usuario. Al iniciar sesión los ve de un vistazo.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@remix-run/react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { useGetFollowupsQuery } from "~/store/api/followupsApi";
import { dueState, isDue, DUE_META } from "~/components/admin/followups/followupUtils";
import { cn } from "~/lib/utils";

export function NotificationsBell() {
  const { data: followups = [] } = useGetFollowupsQuery();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const due = useMemo(
    () => followups.filter(isDue).sort((a, b) => a.followUpDate.localeCompare(b.followUpDate)),
    [followups],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex items-center justify-center rounded-pill border border-border p-2 text-muted transition-colors hover:bg-surface-2 hover:text-text"
        title="Seguimientos pendientes"
        aria-label="Notificaciones"
      >
        <Bell className="h-4 w-4" />
        {due.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {due.length > 9 ? "9+" : due.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-card border border-border bg-surface shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-sm font-bold">Seguimientos por atender</span>
              <span className="text-xs text-muted">{due.length}</span>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {due.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">Todo al día 🎉</p>
              ) : (
                due.map((f) => {
                  const m = DUE_META[dueState(f)];
                  return (
                    <button
                      key={f.id}
                      onClick={() => { setOpen(false); navigate("/admin/seguimientos"); }}
                      className="flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                    >
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", m.dot)} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold text-text">{f.customerName}</span>
                          <span className={cn("shrink-0 text-[11px] font-medium", m.text)}>{m.label}</span>
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {f.product || f.note || "Seguimiento"} · {f.followUpDate}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <button
              onClick={() => { setOpen(false); navigate("/admin/seguimientos"); }}
              className="block w-full border-t border-border px-4 py-2.5 text-center text-sm font-semibold text-accent transition-colors hover:bg-surface-2"
            >
              Ver todos los seguimientos
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
