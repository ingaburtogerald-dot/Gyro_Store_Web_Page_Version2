// Campana de notificaciones del header.
//  - Para todos: seguimientos vencidos / de hoy (CRM).
//  - Para vendedores: avisos de sus ventas aprobadas / pagadas / rechazadas, AGRUPADOS
//    por tipo (ej. "Te pagaron 23 ventas"). Se derivan de sus datos (sin colección nueva)
//    y se marcan como "vistos" en localStorage al abrir la campana.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@remix-run/react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCircle2, Banknote, XCircle, Package, PackageCheck } from "lucide-react";
import { useGetFollowupsQuery } from "~/store/api/followupsApi";
import { useGetSalesQuery, useGetSalesPaginatedQuery } from "~/store/api/salesApi";
import { useGetShipmentsQuery } from "~/store/api/logisticsApi";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin, selectRoles } from "~/store/slices/authSlice";
import { dueState, isDue, DUE_META } from "~/components/admin/followups/followupUtils";
import { formatCordobas, cn } from "~/lib/utils";

const SALE_META: Record<
  string,
  { dot: string; text: string; Icon: typeof CheckCircle2; one: string; many: (n: number) => string }
> = {
  paid: {
    dot: "bg-whatsapp",
    text: "text-whatsapp",
    Icon: Banknote,
    one: "Te pagaron tu comisión",
    many: (n) => `Te pagaron ${n} ventas`,
  },
  approved: {
    dot: "bg-accent",
    text: "text-accent-2",
    Icon: CheckCircle2,
    one: "Tu venta fue aprobada",
    many: (n) => `${n} ventas aprobadas`,
  },
  rejected: {
    dot: "bg-red-500",
    text: "text-red-400",
    Icon: XCircle,
    one: "Tu venta fue rechazada",
    many: (n) => `${n} ventas rechazadas`,
  },
};
const SALE_ORDER = ["paid", "approved", "rejected"] as const;
const SEEN_KEY = "seenSaleNotifs";

export function NotificationsBell() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const roles = useAppSelector(selectRoles);
  const isLogisticsAdmin = roles.some((r) => r === "global_admin" || r === "admin" || r === "logistics_admin");
  const { data: followups = [] } = useGetFollowupsQuery();
  const { data: sales = [] } = useGetSalesQuery(undefined, { skip: isAdmin });
  const { data: shipments = [] } = useGetShipmentsQuery(undefined, { skip: !isLogisticsAdmin });
  const { data: pendingSales } = useGetSalesPaginatedQuery(
    { page: 1, limit: 1, status: "pending_approval", sellerEmail: "all", date: "all" },
    { skip: !isAdmin, pollingInterval: 15000 }
  );
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [isHydrated, setIsHydrated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      setSeen(new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")));
    } catch {
      /* ignorar */
    }
    setIsHydrated(true);
  }, []);

  const due = useMemo(
    () => followups.filter(isDue).sort((a, b) => a.followUpDate.localeCompare(b.followUpDate)),
    [followups],
  );

  // Agrupa los avisos de ventas por estado.
  const { groups, saleIds } = useMemo(() => {
    const map: Record<string, { status: string; count: number; comision: number; ids: string[] }> = {};
    for (const s of sales) {
      if (s.status !== "approved" && s.status !== "paid" && s.status !== "rejected") continue;
      (map[s.status] ||= { status: s.status, count: 0, comision: 0, ids: [] });
      map[s.status].count += 1;
      map[s.status].comision += s.comisionVendedor || 0;
      map[s.status].ids.push(`${s.id}:${s.status}`);
    }
    const groups = SALE_ORDER.filter((st) => map[st]).map((st) => map[st]);
    return { groups, saleIds: groups.flatMap((g) => g.ids) };
  }, [sales]);

  // Avisos de logística para admins: paquetes nuevos y entregas por validar.
  const logistics = useMemo(() => {
    if (!isLogisticsAdmin) return [];
    return shipments
      .filter((s) => s.status === "compra_registrada" || s.status === "entregado_china")
      .map((s) => ({ id: s.id, status: s.status, customerName: s.customerName, trackingNumber: s.trackingNumber, notifId: `ship:${s.id}:${s.status}` }));
  }, [shipments, isLogisticsAdmin]);

  const allIds = useMemo(() => [...saleIds, ...logistics.map((l) => l.notifId)], [saleIds, logistics]);

  const unseenCount = allIds.filter((id) => !seen.has(id)).length;
  const pendingSalesCount = isAdmin ? (pendingSales?.total ?? 0) : 0;
  const badge = due.length + unseenCount + pendingSalesCount;

  function handleToggle() {
    setOpen((o) => {
      const next = !o;
      if (next && isHydrated && allIds.length > 0) {
        setSeen(new Set(allIds));
        try {
          localStorage.setItem(SEEN_KEY, JSON.stringify(allIds));
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

  const empty = due.length === 0 && groups.length === 0 && logistics.length === 0 && pendingSalesCount === 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-pill border border-border text-muted transition-colors hover:bg-surface-2 hover:text-text"
        title="Notificaciones"
        aria-label="Notificaciones"
      >
        <Bell className="h-[18px] w-[18px]" />
        {badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {badge}
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
            className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-card border border-border bg-surface shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-sm font-bold">Notificaciones</span>
              <span className="text-xs text-muted">{badge}</span>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              {empty ? (
                <p className="px-4 py-6 text-center text-sm text-muted">Todo al día 🎉</p>
              ) : (
                <>
                  {pendingSalesCount > 0 && (
                    <>
                      <p className="bg-surface-2/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        Administración
                      </p>
                      <button
                        onClick={() => {
                          setOpen(false);
                          navigate("/admin/ventas");
                        }}
                        className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                          <CheckCircle2 className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-amber-500">
                            Ventas por aprobar
                          </span>
                          <span className="block text-xs text-muted">
                            Tienes {pendingSalesCount} {pendingSalesCount === 1 ? "venta" : "ventas"} pendiente{pendingSalesCount === 1 ? "" : "s"}
                          </span>
                        </span>
                      </button>
                    </>
                  )}

                  {logistics.length > 0 && (
                    <>
                      <p className="bg-surface-2/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        Gyro Logistics
                      </p>
                      {logistics.map((l) => {
                        const pending = l.status === "entregado_china";
                        const Icon = pending ? PackageCheck : Package;
                        return (
                          <button
                            key={l.notifId}
                            onClick={() => {
                              setOpen(false);
                              navigate("/admin/logistica");
                            }}
                            className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                          >
                            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2", pending ? "text-amber-400" : "text-accent-2")}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={cn("block font-semibold", pending ? "text-amber-400" : "text-accent-2")}>
                                {pending ? "Entrega en China por validar" : "Nuevo paquete registrado"}
                              </span>
                              <span className="block truncate text-xs text-muted">
                                {l.customerName} · {l.trackingNumber}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </>
                  )}

                  {groups.length > 0 && (
                    <>
                      <p className="bg-surface-2/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        Tus ventas
                      </p>
                      {groups.map((g) => {
                        const m = SALE_META[g.status];
                        const Icon = m.Icon;
                        return (
                          <button
                            key={g.status}
                            onClick={() => {
                              setOpen(false);
                              navigate("/admin/ventas");
                            }}
                            className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                          >
                            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2", m.text)}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className={cn("font-semibold", m.text)}>
                                  {g.count === 1 ? m.one : m.many(g.count)}
                                </span>
                                {g.status !== "rejected" && g.comision > 0 && (
                                  <span className="shrink-0 text-[11px] font-medium text-whatsapp">
                                    {formatCordobas(g.comision)}
                                  </span>
                                )}
                              </span>
                              <span className="block text-xs text-muted">Toca para ver tus ventas</span>
                            </span>
                          </button>
                        );
                      })}
                    </>
                  )}

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
