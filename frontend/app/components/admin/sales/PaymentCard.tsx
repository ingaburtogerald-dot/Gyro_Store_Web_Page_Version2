import { useState } from "react";
import { Receipt, Calendar, Check, ChevronDown, ChevronUp, AlertCircle, Banknote, Landmark } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatCordobas } from "~/lib/utils";
import { useGetSalesByIdsQuery, type MySellerPayment } from "~/store/api/salesApi";

function dayLabel(iso: string | null) {
  if (!iso) return "Sin fecha";
  return new Date(iso).toLocaleDateString("es-NI", { day: "numeric", month: "short", year: "numeric" });
}

export function PaymentCard({ payment: p }: { payment: MySellerPayment }) {
  const [expanded, setExpanded] = useState(false);
  const isSettlement = !!p.isSettlement || (p.saleIds?.length === 0 && !!p.saldoAplicado);

  const { data: batchSales = [], isLoading: loadingBatchSales } = useGetSalesByIdsQuery(
    p.saleIds ?? [],
    { skip: !expanded || (p.saleIds?.length ?? 0) === 0 }
  );

  return (
    <div className={cn(
      "overflow-hidden rounded-xl border transition-all duration-300",
      expanded ? "border-accent/40 bg-surface-2/80 shadow-[0_4px_20px_rgba(0,0,0,0.3)]" : "border-border bg-surface hover:border-accent/20 hover:bg-surface-2"
    )}>
      {/* Cabecera de la fila */}
      <div 
        onClick={() => setExpanded(!expanded)}
        className="flex cursor-pointer items-center justify-between gap-4 p-4"
      >
        <div className="flex w-full min-w-0 items-center justify-between sm:w-auto sm:flex-1 sm:justify-start sm:gap-6">
          <div className="flex items-center gap-3">
          <div className="relative">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-accent text-sm font-bold text-white shadow-inner">
              Tú
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-text">Mi Pago</span>
            <span className="text-[11px] text-muted">
              {dayLabel(p.createdAt)} • <span className="font-mono">ID: {p.id.slice(0, 6).toUpperCase()}</span>
            </span>
          </div>
        </div>

          <div className="hidden flex-col items-start sm:flex">
            <span className="text-xs text-muted">Fecha</span>
            <span className="text-sm font-medium text-text">{dayLabel(p.createdAt)}</span>
          </div>
          
          <div className="hidden flex-col items-start md:flex">
            <span className="text-xs text-muted">Método</span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {p.paymentMethod === "cash" ? "💵 Efectivo" : "🏦 Depósito"}
              {isSettlement && <span className="ml-1 rounded-pill bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">Ajuste</span>}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted">Total</span>
            <span className="text-base font-bold text-whatsapp drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]">
              {formatCordobas(p.totalComision)}
            </span>
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-muted transition-colors hover:text-text">
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
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
            <div className="border-t border-border/50 bg-background/30 p-5">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
                
                {/* Detalles y Ventas */}
                <div className="space-y-6">
                  {/* Fila de Resumen */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="rounded-lg border border-border/50 bg-surface/50 p-3">
                      <p className="mb-1 text-xs text-muted">Fecha de pago</p>
                      <p className="text-sm font-semibold text-text">{dayLabel(p.createdAt)}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-surface/50 p-3">
                      <p className="mb-1 text-xs text-muted">Aprobado por</p>
                      <p className="text-sm font-semibold text-text">{p.createdBy || "Admin"}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-surface/50 p-3">
                      <p className="mb-1 text-xs text-muted">Método</p>
                      <p className="flex items-center gap-1.5 text-sm font-semibold capitalize text-text">
                        {p.paymentMethod === "cash" ? <Banknote className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
                        {p.paymentMethod === "cash" ? "Efectivo" : "Depósito"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-surface/50 p-3">
                      <p className="mb-1 text-xs text-muted">Ventas incluidas</p>
                      <p className="text-sm font-semibold text-text">{p.ventasCount || 0}</p>
                    </div>
                  </div>

                  {/* Ajustes de saldo */}
                  {!!p.saldoAplicado && (
                    <div className={cn(
                      "flex items-center justify-between rounded-lg border p-3 text-sm",
                      p.saldoAplicado > 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10"
                    )}>
                      <div>
                        <span className="font-semibold text-text">Nota de ajuste de saldo incluido en este pago.</span>
                      </div>
                      <div className={cn("font-bold", p.saldoAplicado > 0 ? "text-emerald-400" : "text-rose-400")}>
                        Saldo {p.saldoAplicado > 0 ? "a favor" : "en contra"}: {p.saldoAplicado > 0 ? "+" : "−"}{formatCordobas(Math.abs(p.saldoAplicado))}
                      </div>
                    </div>
                  )}

                  {/* Lista de ventas incluidas */}
                  {p.ventasCount === 0 ? (
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
                          {(p.saleIds || []).map((id) => {
                            const sale = batchSales.find((s) => s.id === id);
                            if (!sale) return (
                              <div key={id} className="flex items-center justify-between rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted">
                                <span className="font-mono">{id}</span>
                                <span className="italic">Venta archivada o no disponible</span>
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
