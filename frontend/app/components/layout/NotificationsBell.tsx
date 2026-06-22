// Campana de notificaciones del header.
//  - Para todos: seguimientos vencidos / de hoy (CRM).
//  - Para vendedores: avisos de sus ventas aprobadas / pagadas / rechazadas.
// Los avisos de ventas se derivan de los datos del propio vendedor (sin colección
// nueva) y se marcan como "vistos" en localStorage al abrir la campana.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@remix-run/react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { useGetFollowupsQuery } from "~/store/api/followupsApi";
import { useGetSalesQuery } from "~/store/api/salesApi";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin } from "~/store/slices/authSlice";
import { dueState, isDue, DUE_META } from "~/components/admin/followups/followupUtils";
import { formatCordobas, cn } from "~/lib/utils";

const SALE_NOTIF_META: Record<string, { dot: string; text: string; msg: string }> = {
  approved: { dot: "bg-accent", text: "text-accent-2", msg: "Tu venta fue aprobada" },
  paid: { dot: "bg-whatsapp", text: "text-whatsapp", msg: "¡Te pagaron tu comisión!" },
  rejected: { dot: "bg-red-500", text: "text-red-400", msg: "Tu venta fue rechazada" },
};

const SEEN_KEY = "seenSaleNotifs";

export function NotificationsBell() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const { data: followups = [] } = useGetFollowupsQuery();
  const { data: sales = [] } = useGetSalesQuery(undefined, { skip: isAdmin });
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Cargar "vistos" tras montar (evita desajustes con el SSR).
  useEffect(() => {
    try {
      setSeen(new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")));
    } catch {
      /* ignorar */
    }
  }, []);

  const due = useMemo(
    () => followups.filter(isDue).sort((a, b) => a.followUpDate.localeCompare(b.followUpDate)),
    [followups],
  );

  // Avisos de ventas del vendedor (aprobadas / pagadas / rechazadas).
  const saleNotifs = useMemo(() => {
    return sales
      .filter((s) => s.status === "approved" || s.status === "paid" || s.status === "rejected")
      .map((s) => ({
        id: `${s.id}:${s.status}`,
        status: s.status,
        products: s.items?.map((i) => i.name).join(", ") || "Venta",
        comision: s.comisionVendedor || 0,
        ts: (s as any).paidAt || (s as any).approvedAt || s.createdAt || "",
      }))
      .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
  }, [sales]);

  const unseenSale = saleNotifs.filter((n) => !seen.has(n.id));
  const badge = due.length + unseenSale.length;

  // Al abrir, marca los avisos de venta actuales como vistos.
  function handleToggle() {
    setOpen((o) => {
      const next = !o;
      if (next && saleNotifs.length > 0) {
        const ids = saleNotifs.map((n) => n.id);
        setSeen(new Set(ids));
        try {
          localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
        } catch {
          /* ignorar */
        }
      }
      return next;
    });
  }

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const empty = due.length === 0 && saleNotifs.length === 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative inline-flex items-center justify-center rounded-pill border border-border p-2 text-muted transition-colors hover:bg-surface-2 hover:text-text"
        title="Notificaciones"
        aria-label="Notificaciones"
      >
        <Bell className="h-4 w-4" />
        {badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
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
              <span className="text-sm font-bold">Notificaciones</span>
              <span className="text-xs text-muted">{badge}</span>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {empty ? (
                <p className="px-4 py-6 text-center text-sm text-muted">Todo al día 🎉</p>
              ) : (
                <>
                  {/* Avisos de ventas (vendedor) */}
                  {saleNotifs.length > 0 && (
                    <>
                      <p className="bg-surface-2/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        Tus ventas
                      </p>
                      {saleNotifs.slice(0, 10).map((n) => {
                        const m = SALE_NOTIF_META[n.status];
                        return (
                          <button
                            key={n.id}
                            onClick={() => {
                              setOpen(false);
                              navigate("/admin/ventas");
                            }}
                            className="flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                          >
                            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", m.dot)} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className={cn("font-semibold", m.text)}>{m.msg}</span>
                                {n.status !== "rejected" && n.comision > 0 && (
                                  <span className="shrink-0 text-[11px] font-medium text-whatsapp">
                                    {formatCordobas(n.comision)}
                                  </span>
                                )}
                              </span>
                              <span className="block truncate text-xs text-muted">{n.products}</span>
                            </span>
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* Seguimientos por atender */}
                  {due.length > 0 && (
                    <>
                      <p className="bg-surface-2/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        Seguimientos por atender
                      </p>
                      {due.map((f) => {
                        const m = DUE_META[dueState(f)];
                        return (
                          <button
                            key={f.id}
                            onClick={() => {
                              setOpen(false);
                              navigate("/admin/seguimientos");
                            }}
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
                      })}
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
