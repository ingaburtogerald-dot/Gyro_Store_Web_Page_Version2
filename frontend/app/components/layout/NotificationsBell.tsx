// Campana de notificaciones del header.
//  - Para todos: seguimientos vencidos / de hoy (CRM).
//  - Para vendedores: avisos de sus ventas aprobadas / pagadas / rechazadas, AGRUPADOS
//    por tipo (ej. "Te pagaron 23 ventas"). Se derivan de sus datos (sin colección nueva).
//  - Para admin: ventas por aprobar AGRUPADAS POR VENDEDOR (no un total genérico), con
//    una fila propia y separada para las ventas del propio admin.
//    Red: una sola query de pendientes (limit 50, poll 15s) → agrupada en cliente.
//  Se marcan como "vistos" en localStorage al abrir la campana.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@remix-run/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, CheckCircle2, Banknote, XCircle, Package, PackageCheck, MessageCircle } from "lucide-react";
import { useGetAgendaQuery } from "~/store/api/contactsApi";
import { useGetSalesQuery, useGetSalesPaginatedQuery, useGetPublicOrdersQuery } from "~/store/api/salesApi";
import { useGetShipmentsQuery } from "~/store/api/logisticsApi";
import { useGetUsersQuery } from "~/store/api/usersApi";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin, selectRoles, selectUser } from "~/store/slices/authSlice";
import { dueState, isDue, DUE_META, fmtDate } from "~/components/admin/crm/crmMeta";
import { formatCordobas, cn } from "~/lib/utils";

const SALE_META: Record<
  string,
  { text: string; Icon: typeof CheckCircle2; one: string; many: (n: number) => string }
> = {
  paid: { text: "text-whatsapp", Icon: Banknote, one: "Te pagaron tu comisión", many: (n) => `Te pagaron ${n} ventas` },
  approved: { text: "text-accent-2", Icon: CheckCircle2, one: "Tu venta fue aprobada", many: (n) => `${n} ventas aprobadas` },
  rejected: { text: "text-danger", Icon: XCircle, one: "Tu venta fue rechazada", many: (n) => `${n} ventas rechazadas` },
};
const SALE_ORDER = ["paid", "approved", "rejected"] as const;
const SEEN_KEY = "seenSaleNotifs";

// Paleta de avatares (tinte + texto brillante) para reconocer al vendedor de un vistazo.
const AVATAR_COLORS = [
  "bg-tone-indigo/15 text-tone-indigo",
  "bg-info/15 text-info",
  "bg-accent/15 text-accent-2",
  "bg-warning/15 text-warning",
  "bg-danger/15 text-danger",
  "bg-badge/15 text-badge-2",
  "bg-tone-purple/15 text-tone-purple",
];
function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}
function colorFor(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function NotificationsBell() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const roles = useAppSelector(selectRoles);
  const user = useAppSelector(selectUser);
  const myEmail = user?.email?.toLowerCase() ?? "";
  const myName = user?.name || "Tú";
  const isLogisticsAdmin = roles.some((r) => r === "global_admin" || r === "admin" || r === "logistics_admin");

  const { data: agenda = [] } = useGetAgendaQuery();
  const { data: sales = [] } = useGetSalesQuery(undefined, { skip: isAdmin });
  const { data: shipments = [] } = useGetShipmentsQuery(undefined, { skip: !isLogisticsAdmin });
  // Una sola query trae hasta 50 pendientes reales; el agrupamiento es en cliente.
  const { data: pendingData } = useGetSalesPaginatedQuery(
    { page: 1, limit: 50, status: "pending_approval", sellerEmail: "all", date: "all" },
    { skip: !isAdmin, pollingInterval: 15000 },
  );
  const { data: publicOrders = [] } = useGetPublicOrdersQuery(undefined, { skip: !isAdmin });
  const pendingWhatsApp = useMemo(() => publicOrders.filter(o => !o.contacted && !o.archived), [publicOrders]);
  // Fotos de los vendedores (mapa email→foto). La query ya la usa el admin, así
  // que RTK reutiliza la caché: cero red extra.
  const { data: users = [] } = useGetUsersQuery(undefined, { skip: !isAdmin });
  const photoByEmail = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) if (u.email && u.photoURL) m.set(u.email.toLowerCase(), u.photoURL);
    return m;
  }, [users]);

  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [isHydrated, setIsHydrated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  useEffect(() => {
    try {
      setSeen(new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")));
    } catch {
      /* ignorar */
    }
    setIsHydrated(true);
  }, []);

  const due = useMemo(
    () => agenda.filter(isDue).sort((a, b) => (a.nextActivityAt || "").localeCompare(b.nextActivityAt || "")),
    [agenda],
  );

  // ── Ventas por aprobar, AGRUPADAS por vendedor + fila propia del admin ──
  const { sellerGroups, mine, othersPending } = useMemo(() => {
    // Acumulamos la COMISIÓN estimada a pagar (comisionVendedor) — es lo que el
    // admin decide al aprobar — en vez del monto de venta.
    const map = new Map<string, { email: string; name: string; count: number; comision: number }>();
    let mineCount = 0;
    let mineComision = 0;
    for (const s of pendingData?.data ?? []) {
      const isMine = !!myEmail && s.sellerEmail?.toLowerCase() === myEmail;
      if (isMine) {
        mineCount += 1;
        mineComision += s.comisionVendedor || 0;
        continue;
      }
      const key = s.sellerEmail || s.sellerName;
      const g = map.get(key) ?? { email: s.sellerEmail, name: s.sellerName || s.sellerEmail, count: 0, comision: 0 };
      g.count += 1;
      g.comision += s.comisionVendedor || 0;
      map.set(key, g);
    }
    // Ordenado por comisión (mayor plata en juego primero), luego por cantidad.
    const sellerGroups = [...map.values()].sort((a, b) => b.comision - a.comision || b.count - a.count);
    return {
      sellerGroups,
      mine: { count: mineCount, comision: mineComision },
      othersPending: sellerGroups.reduce((sum, g) => sum + g.count, 0),
    };
  }, [pendingData, myEmail]);

  // Avisos de ventas del vendedor, agrupados por estado.
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

  // Avisos de logística para admins.
  const logistics = useMemo(() => {
    if (!isLogisticsAdmin) return [];
    return shipments
      .filter((s) => s.status === "compra_registrada" || s.status === "entregado_china")
      .map((s) => ({ id: s.id, status: s.status, customerName: s.customerName, trackingNumber: s.trackingNumber, notifId: `ship:${s.id}:${s.status}` }));
  }, [shipments, isLogisticsAdmin]);

  const allIds = useMemo(() => [...saleIds, ...logistics.map((l) => l.notifId)], [saleIds, logistics]);
  const unseenCount = allIds.filter((id) => !seen.has(id)).length;

  // El badge rojo cuenta solo lo ACCIONABLE: ventas de otros por aprobar (tus propias
  // no te las apruebas → no inflan la alarma) + avisos + seguimientos + pedidos whatsapp.
  const badge = due.length + unseenCount + (isAdmin ? othersPending + pendingWhatsApp.length : 0);
  const headerCount = badge + (isAdmin ? mine.count : 0);

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

  function goPending(sellerEmail?: string) {
    setOpen(false);
    const seller = sellerEmail ? `&seller=${encodeURIComponent(sellerEmail)}` : "";
    navigate(`/admin/ventas?section=ventas&sub=pending${seller}`);
  }

  const empty =
    due.length === 0 &&
    groups.length === 0 &&
    logistics.length === 0 &&
    othersPending === 0 &&
    pendingWhatsApp.length === 0 &&
    mine.count === 0;

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
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-bg">
            {badge}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
            transition={reduce ? { duration: 0.12 } : { type: "spring", stiffness: 500, damping: 32, mass: 0.7 }}
            className="absolute right-0 z-50 mt-2.5 w-[23rem] max-w-[calc(100vw-1.5rem)] origin-top-right overflow-hidden rounded-2xl border border-border/70 bg-surface p-1.5 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.03)]"
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between px-3 pb-1.5 pt-2">
              <span className="text-sm font-semibold text-text">Notificaciones</span>
              {headerCount > 0 && (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted">
                  {headerCount}
                </span>
              )}
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-0.5 pb-1">
              {empty ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent-2">
                    <CheckCircle2 className="h-6 w-6" strokeWidth={1.5} />
                  </span>
                  <p className="text-sm font-medium text-text">Todo al día</p>
                  <p className="text-xs text-muted">No hay nada que requiera tu atención.</p>
                </div>
              ) : (
                <>
                  {/* ── Ventas por aprobar (admin): por vendedor + propias ── */}
                  {isAdmin && (othersPending > 0 || mine.count > 0) && (
                    <>
                      <SectionLabel>Ventas por aprobar</SectionLabel>
                      {sellerGroups.map((g) => (
                        <NotifRow
                          key={g.email || g.name}
                          onClick={() => goPending(g.email)}
                          avatar={
                            <Avatar
                              label={initials(g.name)}
                              src={photoByEmail.get((g.email || "").toLowerCase())}
                              className={colorFor(g.email || g.name)}
                            />
                          }
                          title={g.name}
                          subtitle={`${g.count} ${g.count === 1 ? "venta espera" : "ventas esperan"} tu aprobación`}
                          right={<CommissionTag value={g.comision} />}
                        />
                      ))}
                      {mine.count > 0 && (
                        <NotifRow
                          onClick={() => goPending(myEmail)}
                          avatar={<Avatar label={initials(myName)} src={user?.photoURL} className="bg-accent/15 text-accent-2 ring-1 ring-accent/30" />}
                          title="Tus ventas"
                          titleClass="text-accent-2"
                          subtitle={`${mine.count} ${mine.count === 1 ? "venta propia" : "ventas propias"} en espera`}
                          right={<CommissionTag value={mine.comision} />}
                        />
                      )}
                    </>
                  )}

                  {/* ── Logística ── */}
                  {logistics.length > 0 && (
                    <>
                      <SectionLabel>Gyro Logistics</SectionLabel>
                      {logistics.map((l) => {
                        const pending = l.status === "entregado_china";
                        const Icon = pending ? PackageCheck : Package;
                        return (
                          <NotifRow
                            key={l.notifId}
                            onClick={() => { setOpen(false); navigate("/admin/logistica"); }}
                            avatar={
                              <Avatar
                                label={<Icon className="h-4 w-4" />}
                                className={cn("bg-surface-2", pending ? "text-warning" : "text-accent-2")}
                              />
                            }
                            title={pending ? "Entrega en China por validar" : "Nuevo paquete registrado"}
                            titleClass={pending ? "text-warning" : "text-accent-2"}
                            subtitle={`${l.customerName} · ${l.trackingNumber}`}
                          />
                        );
                      })}
                    </>
                  )}

                  {/* ── Pedidos por WhatsApp ── */}
                  {isAdmin && pendingWhatsApp.length > 0 && (
                    <>
                      <SectionLabel>Catálogo (WhatsApp)</SectionLabel>
                      <NotifRow
                        onClick={() => { setOpen(false); navigate("/admin/pedidos"); }}
                        avatar={
                          <Avatar
                            label={<MessageCircle className="h-4 w-4" />}
                            className="bg-warning/15 text-warning"
                          />
                        }
                        title={`${pendingWhatsApp.length} ${pendingWhatsApp.length === 1 ? "pedido" : "pedidos"} por WhatsApp`}
                        titleClass="text-warning"
                        subtitle="Esperando seguimiento o contacto"
                      />
                    </>
                  )}

                  {/* ── Ventas del vendedor ── */}
                  {groups.length > 0 && (
                    <>
                      <SectionLabel>Tus ventas</SectionLabel>
                      {groups.map((g) => {
                        const m = SALE_META[g.status];
                        const Icon = m.Icon;
                        return (
                          <NotifRow
                            key={g.status}
                            onClick={() => { setOpen(false); navigate("/admin/ventas"); }}
                            avatar={<Avatar label={<Icon className="h-4 w-4" />} className={cn("bg-surface-2", m.text)} />}
                            title={g.count === 1 ? m.one : m.many(g.count)}
                            titleClass={m.text}
                            subtitle="Toca para ver tus ventas"
                            right={
                              g.status !== "rejected" && g.comision > 0 ? (
                                <Money value={g.comision} className="text-whatsapp" />
                              ) : undefined
                            }
                          />
                        );
                      })}
                    </>
                  )}

                  {/* ── Seguimientos (CRM) ── */}
                  {due.length > 0 && (
                    <>
                      <SectionLabel>Seguimientos por atender</SectionLabel>
                      {due.map((c) => {
                        const m = DUE_META[dueState(c)];
                        return (
                          <NotifRow
                            key={c.id}
                            onClick={() => { setOpen(false); navigate("/admin/crm"); }}
                            avatar={<Avatar label={initials(c.name)} className={colorFor(c.name)} />}
                            title={c.name}
                            subtitle={`${c.product || "Seguimiento"} · ${fmtDate(c.nextActivityAt)}`}
                            right={<span className={cn("shrink-0 text-[11px] font-medium", m.text)}>{m.label}</span>}
                          />
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

/* ── Piezas internas ── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted/70">
      {children}
    </p>
  );
}

function Avatar({ label, src, className }: { label: React.ReactNode; src?: string; className?: string }) {
  const [imgError, setImgError] = useState(false);
  const showImg = !!src && !imgError;
  return (
    <span className={cn("relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-semibold", className)}>
      {/* Iniciales de base: quedan visibles si no hay foto o si la imagen falla. */}
      {label}
      {showImg && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setImgError(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}

function Money({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("shrink-0 text-[11px] font-medium tabular-nums text-muted", className)}>
      {formatCordobas(value)}
    </span>
  );
}

// Comisión estimada a pagar: el número que el admin realmente sopesa al aprobar.
function CommissionTag({ value }: { value: number }) {
  return (
    <span className="block text-right leading-tight" title="Comisión estimada a pagar">
      <span className="block text-sm font-semibold tabular-nums text-text">{formatCordobas(value)}</span>
      <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-wide text-muted/70">
        comisión est.
      </span>
    </span>
  );
}

function NotifRow({
  avatar,
  title,
  subtitle,
  right,
  onClick,
  titleClass,
}: {
  avatar: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onClick: () => void;
  titleClass?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2/60"
    >
      {avatar}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-semibold text-text", titleClass)}>{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span>}
      </span>
      {right && <span className="shrink-0 self-center">{right}</span>}
    </motion.button>
  );
}
