import { useMemo, useState, useEffect } from "react";
import { Receipt, Mail, MessageSquare, Search, Calendar, Pencil, Check, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { DatePicker } from "~/components/ui/DatePicker";
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

// Una card de pago aligerada: vendedor + monto como héroes; el resto en pills.
function PaymentCard({ p, onClick }: { p: PaymentBatch; onClick: () => void }) {
  const isSettlement = !!p.isSettlement || (p.saleIds.length === 0 && !!p.saldoAplicado);
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-card border border-border bg-surface p-3.5 transition-colors hover:border-accent/50 hover:bg-surface-2"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-2/15 text-[11px] font-bold text-accent-2">
            {initials(p.sellerName)}
          </span>
          <span className="truncate text-sm font-semibold text-text">{p.sellerName}</span>
        </div>
        <span className="shrink-0 text-base font-bold text-whatsapp">{formatCordobas(p.totalComision)}</span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {isSettlement ? (
          <span className="rounded-pill bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
            Ajuste de saldo
          </span>
        ) : (
          <span className="rounded-pill bg-background/60 px-2 py-0.5 text-[11px] text-muted">
            {p.saleIds.length} venta{p.saleIds.length === 1 ? "" : "s"}
          </span>
        )}
        <span className="rounded-pill bg-background/60 px-2 py-0.5 text-[11px] text-muted">
          {p.paymentMethod === "cash" ? "💵 Efectivo" : "🏦 Depósito"}
        </span>
        <span
          className="flex items-center gap-1 rounded-pill bg-background/60 px-2 py-0.5 text-[11px] text-muted"
          title={`Notificado vía ${p.notifiedVia}`}
        >
          {p.notifiedVia === "whatsapp" ? (
            <MessageSquare className="h-3 w-3 text-whatsapp" />
          ) : (
            <Mail className="h-3 w-3" />
          )}
        </span>
      </div>
    </div>
  );
}

export function PaymentHistory({ selectedSeller }: { selectedSeller: string }) {
  const { data: payments = [], isLoading } = useGetPaymentsHistoryQuery();
  const { data: balances = {} } = useGetBalancesQuery();
  const [viewDetail, setViewDetail] = useState<PaymentBatch | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [search, setSearch] = useState("");
  const [newDate, setNewDate] = useState("");
  const [updatePaymentDate, { isLoading: isUpdatingDate }] = useUpdatePaymentDateMutation();

  useEffect(() => {
    if (viewDetail?.createdAt) {
      setNewDate(viewDetail.createdAt.split("T")[0]);
    }
  }, [viewDetail]);

  const { data: batchSales = [], isLoading: loadingBatchSales } = useGetSalesByIdsQuery(
    viewDetail?.saleIds ?? [],
    { skip: !viewDetail || (viewDetail?.saleIds.length ?? 0) === 0 }
  );

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

  if (isLoading) return <div className="h-40 animate-pulse rounded-card border border-border bg-surface" />;

  return (
    <div className="space-y-4">
      <SellerBalances balances={filteredBalances} />

      {/* Resumen del período */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-card border border-border bg-surface p-3">
          <p className="text-xs text-muted">Total pagado</p>
          <p className="mt-0.5 text-lg font-bold text-whatsapp">{formatCordobas(summary.total)}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-3">
          <p className="text-xs text-muted">Pagos</p>
          <p className="mt-0.5 text-lg font-bold text-text">{summary.count}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-3">
          <p className="text-xs text-muted">Vendedores</p>
          <p className="mt-0.5 text-lg font-bold text-text">{summary.sellers}</p>
        </div>
      </div>

      {/* Buscador + agrupación */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="input w-full pl-9"
            placeholder="Buscar vendedor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input sm:w-52"
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
        >
          <option value="day">Agrupar por día</option>
          <option value="seller">Agrupar por vendedor</option>
        </select>
      </div>

      {filteredPayments.length === 0 ? (
        <div className="rounded-card border border-dashed border-border py-12 text-center text-muted">
          No hay historial de pagos para la selección actual.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.label + (g.sub ?? "")} className="space-y-2.5">
              {/* Encabezado del grupo */}
              <div className="flex items-center gap-3">
                {groupBy === "day" ? (
                  <Calendar className="h-4 w-4 shrink-0 text-muted" />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-2/15 text-[10px] font-bold text-accent-2">
                    {initials(g.label)}
                  </span>
                )}
                <span className="text-sm font-semibold text-text">{g.label}</span>
                <span className="h-px flex-1 bg-border" />
                <span className="shrink-0 text-xs text-muted">
                  {g.items.length} pago{g.items.length === 1 ? "" : "s"} · {formatCordobas(g.total)}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((p) => (
                  <PaymentCard key={p.id} p={p} onClick={() => setViewDetail(p)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal 
        open={!!viewDetail} 
        onClose={() => setViewDetail(null)} 
        title="Detalle de Pago" 
        maxWidth="max-w-2xl"
        headerRight={
          viewDetail && newDate && newDate !== (viewDetail.createdAt?.split("T")[0] || "") ? (
            <button
              className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-1.5 px-3 text-xs font-bold text-white shadow-lg hover:bg-emerald-600 transition-all animate-in fade-in slide-in-from-top-1"
              disabled={isUpdatingDate}
              onClick={async () => {
                if (!viewDetail) return;
                try {
                  await updatePaymentDate({ id: viewDetail.id, date: newDate }).unwrap();
                  toast.success("Fecha actualizada exitosamente.");
                  setViewDetail(null);
                } catch (err: any) {
                  toast.error(err?.data?.error || "Error al actualizar la fecha.");
                }
              }}
            >
              <Check className="h-4 w-4" />
              Guardar cambio de fecha
            </button>
          ) : null
        }
      >
        {viewDetail && (
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-xl bg-background/50 border border-border p-4">
              <div>
                <p className="text-xs text-muted">Vendedor</p>
                <p className="font-bold text-text">{viewDetail.sellerName}</p>
                <p className="text-xs text-muted">{viewDetail.sellerEmail}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">Total Pagado</p>
                <p className="text-xl font-bold text-whatsapp">{formatCordobas(viewDetail.totalComision)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="mb-2 text-sm font-semibold text-text">Resumen</p>
                <ul className="space-y-1.5 text-xs text-muted">
                  <li className="flex flex-col gap-2 sm:flex-row sm:items-center py-2 border-b border-border/50">
                    <strong className="w-24 shrink-0 text-text">Fecha:</strong>
                    <div className="flex flex-col gap-2 w-full pr-4">
                      <DatePicker
                        value={newDate}
                        onChange={(val) => setNewDate(val)}
                        disabled={isUpdatingDate}
                      />
                    </div>
                  </li>
                  <li><strong>Aprobado por:</strong> {viewDetail.createdBy}</li>
                  <li><strong>Método:</strong> <span className="capitalize">{viewDetail.paymentMethod === 'cash' ? '💵 Efectivo' : '🏦 Depósito'}</span></li>
                  <li><strong>Notificado vía:</strong> <span className="capitalize">{viewDetail.notifiedVia}</span></li>
                  <li><strong>Ventas incluidas:</strong> {viewDetail.saleIds.length}</li>
                  {!!viewDetail.saldoAplicado && (
                    <>
                      <li className="pt-1.5 border-t border-border/60 mt-1.5">
                        <strong>Comisión bruta:</strong> {formatCordobas(viewDetail.grossComision ?? 0)}
                      </li>
                      <li className={viewDetail.saldoAplicado > 0 ? "text-emerald-400" : "text-rose-400"}>
                        <strong>Saldo {viewDetail.saldoAplicado > 0 ? "a favor" : "en contra"}:</strong>{" "}
                        {viewDetail.saldoAplicado > 0 ? "+" : "−"}{formatCordobas(Math.abs(viewDetail.saldoAplicado))}
                      </li>
                    </>
                  )}
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4 flex flex-col">
                <p className="mb-2 text-sm font-semibold text-text flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> Comprobante
                </p>
                {viewDetail.receiptUrl ? (
                  <div className="flex-1 rounded-lg border border-border bg-background/50 flex items-center justify-center p-2 relative group overflow-hidden">
                    <img src={viewDetail.receiptUrl} alt="Comprobante" className="object-contain h-32 w-auto" />
                    <a href={viewDetail.receiptUrl} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity">
                      Ver tamaño completo
                    </a>
                  </div>
                ) : (
                  <div className="flex-1 rounded-lg border border-dashed border-rose-500/30 bg-rose-500/5 flex flex-col items-center justify-center p-4 text-center">
                    <p className="text-xs font-semibold text-rose-400 mb-1">Sin comprobante</p>
                    <p className="text-[11px] text-muted-foreground max-w-[200px] italic">
                      "{viewDetail.noReceiptComment || 'Sin justificación'}"
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {viewDetail.saleIds.length === 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300">
                Este registro es un <strong>ajuste de saldo</strong>, no un pago de ventas. No incluye ventas.
              </div>
            ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-text">Ventas Incluidas ({viewDetail.saleIds.length}):</p>

              {loadingBatchSales ? (
                <div className="flex justify-center p-6">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent-2 border-t-transparent" />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {viewDetail.saleIds.map(id => {
                    const sale = batchSales.find(s => s.id === id);
                    if (!sale) return (
                      <div key={id} className="rounded-xl border border-border bg-surface-2 p-3 text-xs text-muted flex items-center justify-between">
                        <span className="font-mono">{id}</span>
                        <span className="italic">Venta archivada o no encontrada</span>
                      </div>
                    );
                    
                    const displayComision = sale.comisionVendedor ?? 0;

                    return (
                      <div key={id} className="rounded-xl border border-border bg-surface p-3 hover:border-accent/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="text-xs text-muted mb-1">
                            {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString("es-NI") : "—"}
                          </div>
                          <p className="text-sm font-semibold text-text">
                            {sale.items?.map((i: any) => `${i.quantity}x ${i.name}`).join(', ') || 'Venta Migrada'}
                          </p>
                          {sale.saleOrigin === 'migrated' && (
                            <span className="inline-block mt-1 text-[10px] font-medium bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full">
                              Migrada
                            </span>
                          )}
                        </div>
                        <div className="flex sm:flex-col items-end gap-2 sm:gap-0 bg-surface-2 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                          <div className="text-right">
                            <span className="text-[10px] text-muted block sm:inline sm:mr-1">Venta:</span>
                            <span className="text-sm font-semibold text-text">{formatCordobas(sale.saleTotal)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-muted block sm:inline sm:mr-1">Comisión:</span>
                            <span className="text-sm font-bold text-whatsapp">{formatCordobas(displayComision)}</span>
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
        )}
      </Modal>
    </div>
  );
}
