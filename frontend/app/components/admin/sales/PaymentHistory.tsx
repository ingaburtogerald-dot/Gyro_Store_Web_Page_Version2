import { useMemo, useState, useEffect } from "react";
import { Receipt, Mail, MessageSquare, Search, Calendar, Check, ChevronDown, AlertCircle, Banknote, Landmark } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { DatePicker } from "~/components/ui/DatePicker";
import { cn } from "~/lib/utils";
import {
  useGetPaymentsHistoryQuery,
  useGetSalesByIdsQuery,
  useGetBalancesQuery,
  useUpdatePaymentDateMutation,
  type PaymentBatch,
} from "~/store/api/salesApi";
import { formatCordobas } from "~/lib/utils";
import { SellerBalances } from "./SellerBalances";

type GroupBy = "day" | "seller";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function dayLabel(iso: string | null) {
  if (!iso) return "Sin fecha";
  return new Date(iso).toLocaleDateString("es-NI", { day: "numeric", month: "short", year: "numeric" });
}

function PaymentAccordionRow({ p }: { p: PaymentBatch }) {
  const [expanded, setExpanded] = useState(false);
  const [newDate, setNewDate] = useState(p.createdAt?.split("T")[0] || "");
  const [updatePaymentDate, { isLoading: isUpdatingDate }] = useUpdatePaymentDateMutation();

  const isSettlement = !!p.isSettlement || (p.saleIds.length === 0 && !!p.saldoAplicado);

  const { data: batchSales = [], isLoading: loadingBatchSales } = useGetSalesByIdsQuery(
    p.saleIds ?? [],
    { skip: !expanded || (p.saleIds.length ?? 0) === 0 }
  );

  const hasDateChanged = newDate && p.createdAt && newDate !== p.createdAt.split("T")[0];

  async function handleSaveDate() {
    try {
      await updatePaymentDate({ id: p.id, date: newDate }).unwrap();
      toast.success("Fecha actualizada exitosamente.");
    } catch (err: any) {
      toast.error(err?.data?.error || "Error al actualizar la fecha.");
    }
  }

  return (
    <div className={cn(
      "overflow-hidden rounded-xl border transition-all duration-300",
      expanded ? "border-accent/40 bg-surface-2/80 shadow-[0_4px_20px_rgba(0,0,0,0.3)]" : "border-border bg-surface hover:border-accent/20 hover:bg-surface-2"
    )}>
      {/* Cabecera de la fila (resumen compacto): una línea, sin fecha duplicada
          ni espacio muerto. El detalle completo vive en el cuerpo expandible. */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex cursor-pointer items-center gap-3 px-4 py-3"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-accent text-xs font-bold text-white">
          {initials(p.sellerName)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-text">{p.sellerName}</span>
            {isSettlement && (
              <span className="rounded-pill bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">Ajuste</span>
            )}
          </div>
          <span className="text-[11px] text-muted">
            {dayLabel(p.createdAt)} · <span className="font-mono">{p.id.slice(-6).toUpperCase()}</span>
          </span>
        </div>

        <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted sm:inline-flex">
          {p.paymentMethod === "cash" ? <Banknote className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
          {p.paymentMethod === "cash" ? "Efectivo" : "Depósito"}
        </span>

        <div className="shrink-0 text-right">
          <span className="block text-[10px] uppercase tracking-wide text-muted">Total</span>
          <span className="font-heading text-base font-bold tabular-nums text-whatsapp">
            {formatCordobas(p.totalComision)}
          </span>
        </div>

        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted transition-transform duration-300",
            expanded && "rotate-180 text-accent-2",
          )}
        />
      </div>

      {/* Cuerpo Expandible */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="border-t border-border/50 bg-bg/30 p-5">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
                
                {/* Detalles y Ventas */}
                <div className="space-y-6">
                  {/* Fila de Resumen */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="rounded-lg border border-border/50 bg-surface/50 p-3">
                      <p className="mb-1 text-xs text-muted">Fecha de pago</p>
                      <div className="flex flex-col gap-2">
                        <DatePicker value={newDate} onChange={(v) => setNewDate(v)} disabled={isUpdatingDate} />
                        {hasDateChanged && (
                          <button
                            onClick={handleSaveDate}
                            disabled={isUpdatingDate}
                            className="flex items-center justify-center gap-1.5 rounded-md bg-emerald-500 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-600"
                          >
                            <Check className="h-3.5 w-3.5" /> Guardar fecha
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-surface/50 p-3">
                      <p className="mb-1 text-xs text-muted">Aprobado por</p>
                      <p className="text-sm font-semibold text-text">{p.createdBy}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-surface/50 p-3">
                      <p className="mb-1 text-xs text-muted">Notificado vía</p>
                      <p className="flex items-center gap-1.5 text-sm font-semibold capitalize text-text">
                        {p.notifiedVia === "whatsapp" ? <MessageSquare className="h-4 w-4 text-whatsapp" /> : <Mail className="h-4 w-4" />}
                        {p.notifiedVia}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-surface/50 p-3">
                      <p className="mb-1 text-xs text-muted">Ventas incluidas</p>
                      <p className="text-sm font-semibold text-text">{p.saleIds.length}</p>
                    </div>
                  </div>

                  {/* Ajustes de saldo */}
                  {!!p.saldoAplicado && (
                    <div className={cn(
                      "flex items-center justify-between rounded-lg border p-3 text-sm",
                      p.saldoAplicado > 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10"
                    )}>
                      <div>
                        <span className="font-semibold text-text">Comisión bruta:</span> {formatCordobas(p.grossComision ?? 0)}
                      </div>
                      <div className={cn("font-bold", p.saldoAplicado > 0 ? "text-emerald-400" : "text-rose-400")}>
                        Saldo {p.saldoAplicado > 0 ? "a favor" : "en contra"}: {p.saldoAplicado > 0 ? "+" : "−"}{formatCordobas(Math.abs(p.saldoAplicado))}
                      </div>
                    </div>
                  )}

                  {/* Lista de ventas incluidas */}
                  {p.saleIds.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                      <AlertCircle className="h-4 w-4" /> Este es un <strong>ajuste de saldo</strong>, no incluye ventas.
                    </div>
                  ) : (
                    <div>
                      <h4 className="mb-3 text-sm font-bold text-text">Desglose de Ventas</h4>
                      {loadingBatchSales ? (
                        <div className="flex items-center justify-center p-4">
                          <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {p.saleIds.map((id) => {
                            const sale = batchSales.find((s) => s.id === id);
                            if (!sale) return (
                              <div key={id} className="flex items-center justify-between rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted">
                                <span className="font-mono">{id}</span>
                                <span className="italic">Venta archivada o eliminada</span>
                              </div>
                            );

                            return (
                              <div key={id} className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface/40 p-3 transition-colors hover:border-accent/30 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <div className="mb-0.5 text-xs text-muted">{sale.createdAt ? new Date(sale.createdAt).toLocaleDateString("es-NI") : "—"}</div>
                                  <p className="text-sm font-medium text-text">
                                    {sale.items?.map((i: any) => `${i.quantity}x ${i.name}`).join(", ") || "Venta Migrada"}
                                  </p>
                                  {sale.saleOrigin === "migrated" && (
                                    <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">Migrada</span>
                                  )}
                                </div>
                                <div className="flex gap-4 sm:flex-col sm:items-end sm:gap-0">
                                  <div className="text-right">
                                    <span className="mr-1 inline text-[10px] text-muted sm:hidden">Venta:</span>
                                    <span className="text-sm font-medium text-text">{formatCordobas(sale.saleTotal)}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="mr-1 inline text-[10px] text-muted sm:hidden">Comisión:</span>
                                    <span className="text-sm font-bold text-whatsapp">{formatCordobas(sale.comisionVendedor ?? 0)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Comprobante */}
                <div className="flex flex-col">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-text"><Receipt className="h-4 w-4" /> Comprobante</h4>
                  {p.receiptUrl ? (
                    <div className="group relative flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface p-2 min-h-[200px]">
                      <img src={p.receiptUrl} alt="Comprobante" className="h-full w-full object-contain" />
                      <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/60 font-semibold text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                        Abrir imagen original
                      </a>
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-rose-500/30 bg-rose-500/5 p-6 text-center">
                      <p className="mb-1 text-sm font-bold text-rose-400">Sin comprobante</p>
                      <p className="text-xs italic text-muted">"{p.noReceiptComment || "Sin justificación"}"</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PaymentHistory({ selectedSeller }: { selectedSeller: string }) {
  const { data: payments = [], isLoading } = useGetPaymentsHistoryQuery();
  const { data: balances = {} } = useGetBalancesQuery();
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [search, setSearch] = useState("");

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (selectedSeller !== "all" && p.sellerEmail !== selectedSeller) return false;
      if (q && !p.sellerName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [payments, selectedSeller, search]);

  const filteredBalances = useMemo(() => {
    return Object.values(balances).filter((b) => selectedSeller === "all" ? true : b.sellerEmail === selectedSeller);
  }, [balances, selectedSeller]);

  // Resumen del período filtrado.
  const summary = useMemo(() => {
    const total = filteredPayments.reduce((s, p) => s + (p.totalComision || 0), 0);
    const sellers = new Set(filteredPayments.map((p) => p.sellerEmail));
    return { total, count: filteredPayments.length, sellers: sellers.size };
  }, [filteredPayments]);

  // Agrupación (los pagos ya vienen ordenados por fecha desc desde el backend).
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; sub?: string; total: number; items: PaymentBatch[] }>();
    for (const p of filteredPayments) {
      const key = groupBy === "day" ? dayLabel(p.createdAt) : p.sellerEmail;
      const label = groupBy === "day" ? key : p.sellerName;
      if (!map.has(key)) map.set(key, { label, sub: groupBy === "seller" ? p.sellerEmail : undefined, total: 0, items: [] });
      const g = map.get(key)!;
      g.total += p.totalComision || 0;
      g.items.push(p);
    }
    return Array.from(map.values());
  }, [filteredPayments, groupBy]);

  if (isLoading) return <div className="h-40 animate-pulse rounded-card border border-border bg-surface shadow-premium" />;

  return (
    <div className="space-y-6">
      <SellerBalances balances={filteredBalances} />

      {/* Resumen del período */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-card border border-whatsapp/30 bg-whatsapp/5 p-4">
          <p className="text-xs font-semibold text-muted">Total Pagado</p>
          <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-whatsapp">{formatCordobas(summary.total)}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4 shadow-premium">
          <p className="text-xs font-semibold text-muted">Pagos Procesados</p>
          <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-text">{summary.count}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4 shadow-premium">
          <p className="text-xs font-semibold text-muted">Vendedores</p>
          <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-text">{summary.sellers}</p>
        </div>
      </div>

      {/* Buscador + agrupación */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="input w-full bg-surface-2/30 pl-9 hover:bg-surface-2 focus:ring-1 focus:ring-accent"
            placeholder="Buscar por vendedor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input bg-surface-2/30 font-medium hover:bg-surface-2 focus:ring-1 focus:ring-accent sm:w-56"
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
        >
          <option value="day">Agrupar por día</option>
          <option value="seller">Agrupar por vendedor</option>
        </select>
      </div>

      {filteredPayments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted">
          No hay historial de pagos para la selección actual.
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <div key={g.label + (g.sub ?? "")} className="space-y-3">
              {/* Encabezado del grupo sutil */}
              <div className="flex items-center gap-3 px-1">
                {groupBy === "day" ? (
                  <Calendar className="h-4 w-4 text-muted" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-2/15 text-[9px] font-bold text-accent-2">
                    {initials(g.label)}
                  </span>
                )}
                <span className="text-sm font-bold text-muted">{g.label}</span>
                <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                <span className="text-xs font-semibold text-muted">
                  {g.items.length} pago{g.items.length === 1 ? "" : "s"} · <span className="text-text">{formatCordobas(g.total)}</span>
                </span>
              </div>

              {/* Filas Acordeón */}
              <div className="flex flex-col gap-2">
                {g.items.map((p) => (
                  <PaymentAccordionRow key={p.id} p={p} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
