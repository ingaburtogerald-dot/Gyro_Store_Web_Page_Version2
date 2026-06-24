import { useState, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Check, X, AlertTriangle, Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { Modal } from "~/components/ui/Modal";
import { DatePicker } from "~/components/ui/DatePicker";
import { DataTable } from "~/components/ui/DataTable";
import { AdminSaleCard } from "./AdminSaleCard";
import { SaleEditor } from "./SaleEditor";
import {
  useGetSalesPaginatedQuery,
  useApproveSaleMutation,
  useApproveAndPayBulkMutation,
  useRejectSaleMutation,
  useDeleteSaleMutation,
  useGetBalancesQuery,
  type Sale,
} from "~/store/api/salesApi";
import { formatCordobas } from "~/lib/utils";

export function PendingSales({ selectedSeller, selectedMonth, onRegisterSale }: { selectedSeller: string; selectedMonth: string; onRegisterSale?: () => void }) {
  const { data: salesData, isLoading } = useGetSalesPaginatedQuery({
    page: 1,
    limit: 100,
    status: "pending_approval",
    sellerEmail: selectedSeller,
    date: selectedMonth,
  });
  const sales = salesData?.data ?? [];
  const [approve, { isLoading: approving }] = useApproveSaleMutation();
  const [approveAndPayBulk] = useApproveAndPayBulkMutation();
  const [reject, { isLoading: rejecting }] = useRejectSaleMutation();
  const [del, { isLoading: deleting }] = useDeleteSaleMutation();
  const [rejectFor, setRejectFor] = useState<Sale[] | null>(null);
  const [editFor, setEditFor] = useState<Sale | null>(null);
  const [deleteFor, setDeleteFor] = useState<Sale[] | null>(null);
  const [payFor, setPayFor] = useState<Sale[] | null>(null);
  const [successData, setSuccessData] = useState<{ receiptUrl: string; whatsappUrl?: string; notifiedVia: string } | null>(null);
  const [reason, setReason] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [mixedSellerWarning, setMixedSellerWarning] = useState(false);

  async function handleDelete() {
    if (!deleteFor || !deleteReason.trim()) return;
    try {
      await Promise.all(deleteFor.map(s => del({ id: s.id, reason: deleteReason.trim() }).unwrap()));
      toast.success(deleteFor.length > 1 ? "Ventas eliminadas." : "Venta eliminada.");
      setDeleteFor(null);
      setDeleteReason("");
      setSelectedSales(new Set());
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo eliminar.");
    }
  }

  const pending = sales;

  async function handleBulkApprove() {
    const salesToApprove = pending.filter(p => selectedSales.has(p.id));
    if (salesToApprove.length === 0) return;
    
    // Check if all belong to same seller
    const firstSeller = salesToApprove[0].sellerEmail;
    if (salesToApprove.some(s => s.sellerEmail !== firstSeller)) {
      setMixedSellerWarning(true);
      return;
    }
    
    setPayFor(salesToApprove);
  }

  async function handleReject() {
    if (!rejectFor) return;
    try {
      await Promise.all(rejectFor.map(s => reject({ id: s.id, reason }).unwrap()));
      toast.success(rejectFor.length > 1 ? "Ventas rechazadas." : "Venta rechazada.");
      setRejectFor(null);
      setReason("");
      setSelectedSales(new Set());
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo rechazar.");
    }
  }

  const columns = useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: "sellerName",
        header: "Vendedor",
        cell: (c) => {
          const row = c.row.original;
          return (
            <div>
              <div className="font-semibold text-text">{c.getValue()}</div>
              {row.insufficientStockError && (
                <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-rose-400">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Stock insuficiente</span>
                </div>
              )}
            </div>
          );
        }
      },
      {
        accessorKey: "createdAt",
        header: "Fecha",
        cell: (c) => (c.getValue() ? new Date(c.getValue()).toLocaleDateString("es-NI") : "—")
      },
      {
        id: "code",
        header: "Código",
        enableSorting: false,
        cell: (c) => {
          const items = c.row.original.items || [];
          return (
            <div className="text-xs">
              {items.map((it: any, idx: number) => (
                <div key={idx} className="font-mono text-muted">{it.code || "—"}</div>
              ))}
            </div>
          );
        }
      },
      {
        id: "products",
        header: "Producto(s)",
        enableSorting: false,
        cell: (c) => {
          const items = c.row.original.items || [];
          return (
            <div className="max-w-[350px] min-w-[200px] text-xs">
              {items.map((it: any, idx: number) => {
                const variant = it.variantName && it.variantName !== "Estándar" ? ` (${it.variantName})` : "";
                return (
                  <div key={idx} className="truncate text-muted" title={`${it.name}${variant}`}>
                    {it.name}{variant}
                  </div>
                );
              })}
            </div>
          );
        }
      },
      {
        id: "quantity",
        header: "Cant.",
        enableSorting: false,
        cell: (c) => {
          const items = c.row.original.items || [];
          const totalQty = items.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0);
          return <span className="font-mono text-xs">{totalQty}</span>;
        }
      },
      {
        accessorKey: "saleTotal",
        header: "Precio venta",
        enableSorting: false,
        cell: (c) => <span className="font-semibold text-text">{formatCordobas(c.getValue())}</span>
      },
      {
        accessorKey: "totalCostReal",
        header: "Costo real",
        enableSorting: false,
        cell: (c) => <span className="font-mono text-xs text-muted-foreground">{c.getValue() !== undefined ? formatCordobas(c.getValue()) : "—"}</span>
      },
      {
        id: "inversionRecuperada",
        header: "Inversión recuperada",
        enableSorting: false,
        cell: (c) => {
          const s = c.row.original;
          const invRecuperada = (s.saleTotal || 0) - (s.totalCostReal || 0);
          return <span className="font-mono text-xs text-emerald-400">{formatCordobas(invRecuperada)}</span>;
        }
      },
      {
        accessorKey: "totalUtilidadBruta",
        header: "Utilidad bruta",
        enableSorting: false,
        cell: (c) => <span className="font-mono text-xs text-muted-foreground">{c.getValue() !== undefined ? formatCordobas(c.getValue()) : "—"}</span>
      },
      {
        accessorKey: "totalCostosFijos",
        header: "Costos fijos",
        enableSorting: false,
        cell: (c) => <span className="font-mono text-xs text-rose-400/90">{c.getValue() !== undefined ? `-${formatCordobas(c.getValue())}` : "—"}</span>
      },
      {
        accessorKey: "totalUtilidadNeta",
        header: "Utilidad neta",
        enableSorting: false,
        cell: (c) => <span className="font-semibold text-text">{c.getValue() !== undefined ? formatCordobas(c.getValue()) : "—"}</span>
      },
      {
        accessorKey: "comisionVendedor",
        header: "Comisión",
        enableSorting: false,
        cell: (c) => {
          const pct = c.row.original.comisionPercent;
          return (
            <div className="text-xs font-semibold text-emerald-400">
              {c.getValue() !== undefined ? formatCordobas(c.getValue()) : "—"}
              {pct !== undefined && <span className="text-[10px] text-muted ml-0.5">({pct}%)</span>}
            </div>
          );
        }
      },
      {
        accessorKey: "gananciaTienda",
        header: "Ganancia tienda",
        enableSorting: false,
        cell: (c) => <span className="font-bold text-whatsapp">{c.getValue() !== undefined ? formatCordobas(c.getValue()) : "—"}</span>
      }
    ],
    []
  );

  const totals = useMemo(() => {
    let cant = 0, venta = 0, costo = 0, utilBruta = 0, costosFijos = 0, utilNeta = 0, comision = 0, ganancia = 0;
    for (const s of pending) {
      cant += s.items?.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0) || 0;
      venta += s.saleTotal || 0;
      costo += s.totalCostReal || 0;
      utilBruta += s.totalUtilidadBruta || 0;
      costosFijos += s.totalCostosFijos || 0;
      utilNeta += s.totalUtilidadNeta || 0;
      comision += s.comisionVendedor || 0;
      ganancia += s.gananciaTienda || 0;
    }
    return { cant, venta, costo, utilBruta, costosFijos, utilNeta, comision, ganancia };
  }, [pending]);

  return (
    <div className="space-y-4 rounded-card border border-border bg-surface p-4 relative">
      <div className="sticky top-0 z-30 flex flex-col lg:flex-row items-start justify-between gap-4 bg-surface pb-2">
        <div>
          <h2 className="text-lg font-bold text-text">Ventas Pendientes de Aprobación</h2>
          <p className="text-xs text-muted">Revisa las transacciones reportadas y audita sus utilidades. Selecciona una fila para editarla o eliminarla.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {pending.length > 0 && (
            <div className="flex items-center gap-4 rounded-lg border border-border bg-surface-2 px-4 py-2 text-xs shadow-sm">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted uppercase font-bold">Cantidades</span>
                <span className="text-sm font-semibold text-text">{totals.cant}</span>
              </div>
              <div className="flex flex-col border-l border-border pl-4">
                <span className="text-[10px] text-muted uppercase font-bold">Venta Total</span>
                <span className="text-sm font-semibold text-text">{formatCordobas(totals.venta)}</span>
              </div>
              <div className="flex flex-col border-l border-border pl-4">
                <span className="text-[10px] text-muted uppercase font-bold">Comisión</span>
                <span className="text-sm font-semibold text-emerald-400">{formatCordobas(totals.comision)}</span>
              </div>
              <div className="flex flex-col border-l border-border pl-4">
                <span className="text-[10px] text-muted uppercase font-bold">Ganancia</span>
                <span className="text-sm font-bold text-whatsapp">{formatCordobas(totals.ganancia)}</span>
              </div>
            </div>
          )}
          {onRegisterSale && (
            <button
              onClick={onRegisterSale}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-accent px-4 py-2 text-sm font-bold text-white transition-all hover:opacity-90 whitespace-nowrap shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]"
            >
              <Plus className="h-4 w-4" />
              <span>Registrar Venta</span>
            </button>
          )}
        </div>
      </div>

      {selectedSales.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-accent-2/30 bg-accent-2/5 p-3 animate-in fade-in slide-in-from-top-2">
          <div className="text-sm">
            <span className="text-muted">{selectedSales.size > 1 ? "Ventas seleccionadas: " : "Venta seleccionada: "}</span>
            {selectedSales.size === 1 ? (
              <>
                <span className="font-semibold text-text">{pending.find(p => p.id === Array.from(selectedSales)[0])?.sellerName}</span>
                <span className="text-muted ml-2">({formatCordobas(pending.find(p => p.id === Array.from(selectedSales)[0])?.saleTotal || 0)})</span>
              </>
            ) : (
              <span className="font-semibold text-text">{selectedSales.size}</span>
            )}
          </div>
          <div className="flex gap-2">
            {selectedSales.size === 1 && (
              <Button variant="outline" size="sm" onClick={() => {
                const sale = pending.find(p => p.id === Array.from(selectedSales)[0]);
                if (sale) setEditFor(sale);
              }}>
                <Pencil className="mr-1.5 h-4 w-4" />
                Editar
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                const sales = pending.filter(p => selectedSales.has(p.id));
                setRejectFor(sales);
              }}
              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
            >
              <X className="mr-1.5 h-4 w-4" />
              Rechazar
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                const sales = pending.filter(p => selectedSales.has(p.id));
                setDeleteFor(sales);
              }}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Eliminar
            </Button>
            <Button 
              size="sm" 
              onClick={handleBulkApprove}
              disabled={approving || pending.filter(p => selectedSales.has(p.id)).some(s => !!s.insufficientStockError)}
              className="bg-emerald-500/90 hover:bg-emerald-500"
            >
              <Check className="mr-1.5 h-4 w-4" />
              Aprobar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedSales(new Set())}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={pending}
        isLoading={isLoading}
        hideSearch={true}
        emptyText="No hay ventas pendientes de aprobación. 🎉"
        onRowClick={(row) => {
          setSelectedSales((prev) => {
            const next = new Set(prev);
            if (next.has(row.id)) next.delete(row.id);
            else next.add(row.id);
            return next;
          });
        }}
        selectedRowIds={selectedSales}
        onSelectAll={(select) => {
          if (select) setSelectedSales(new Set(pending.map(p => p.id)));
          else setSelectedSales(new Set());
        }}
        allSelected={pending.length > 0 && selectedSales.size === pending.length}
        initialSorting={[{ id: "createdAt", desc: false }]}
        mobileCard={(s) => <AdminSaleCard sale={s} />}
      />

      <Modal open={!!editFor} onClose={() => setEditFor(null)} title="Editar Venta Pendiente" maxWidth="max-w-5xl">
        <div className="max-h-[80vh] overflow-y-auto pr-1">
          {editFor && <SaleEditor sale={editFor} onDone={() => { setEditFor(null); setSelectedSales(new Set()); }} />}
        </div>
      </Modal>

      {deleteFor && (
        <Modal open={!!deleteFor} onClose={() => { setDeleteFor(null); setDeleteReason(""); }} title="Eliminar venta">
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {deleteFor.length === 1 ? (
                <>¿Eliminar por completo la venta de <strong className="text-text">{deleteFor[0].sellerName}</strong> por <strong>{formatCordobas(deleteFor[0].saleTotal)}</strong>? Se liberará el stock reservado. Esta acción no se puede deshacer.</>
              ) : (
                <>¿Eliminar por completo las <strong>{deleteFor.length} ventas</strong> seleccionadas? Se liberará el stock reservado de todas ellas. Esta acción no se puede deshacer.</>
              )}
            </p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted">Motivo de la eliminación (obligatorio)</span>
              <textarea
                className="input"
                rows={3}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Indica por qué se elimina esta venta (queda en auditoría)…"
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" size="sm" onClick={() => { setDeleteFor(null); setDeleteReason(""); }}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleDelete}
                loading={deleting}
                disabled={!deleteReason.trim()}
                className="bg-red-500/90 hover:bg-red-500"
              >
                Eliminar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {rejectFor && (
        <Modal open={!!rejectFor} onClose={() => setRejectFor(null)} title="Rechazar venta">
          <div className="space-y-4">
            <div className="text-xs text-muted">
              {rejectFor.length === 1 ? (
                <>Venta de <strong className="text-text">{rejectFor[0].sellerName}</strong> por un total de <strong>{formatCordobas(rejectFor[0].saleTotal)}</strong>.</>
              ) : (
                <>Estás a punto de rechazar <strong>{rejectFor.length} ventas</strong> seleccionadas.</>
              )}
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted">
                Motivo del rechazo (obligatorio)
              </span>
              <textarea
                className="input"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Indica el motivo de rechazo que se enviará al vendedor por correo…"
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={() => setRejectFor(null)}>
                Cancelar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReject}
                loading={rejecting}
                disabled={!reason.trim()}
                className="border-red-500/40 text-red-400 hover:bg-red-500/10"
              >
                Rechazar Venta
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {payFor && (
        <ApproveAndPayModal 
          sales={payFor} 
          onClose={() => setPayFor(null)} 
          onSuccess={(data) => {
            setPayFor(null);
            setSelectedSales(new Set());
            setSuccessData(data);
          }}
          approveAndPayBulk={approveAndPayBulk}
        />
      )}

      {successData && (
        <Modal open={!!successData} onClose={() => setSuccessData(null)} title="Pago Registrado Exitosamente" maxWidth="max-w-2xl">
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
              <Check className="h-8 w-8" />
            </div>
            
            <div>
              <p className="text-lg font-bold text-text">¡El pago se ha registrado correctamente!</p>
              <p className="text-sm text-muted">El comprobante ha sido subido al sistema de historial.</p>
            </div>

            {successData.notifiedVia === "whatsapp" && successData.whatsappUrl ? (
              <div className="rounded-xl border border-whatsapp/30 bg-whatsapp/10 p-5 space-y-4 text-left">
                <p className="text-sm font-medium text-text">
                  Para notificar al vendedor por WhatsApp, haz clic en el siguiente botón. Se abrirá una nueva pestaña con el mensaje listo.
                </p>
                <div className="text-xs text-muted bg-surface p-3 rounded-lg border border-border">
                  <p><strong>Instrucciones para adjuntar comprobantes:</strong></p>
                  <ol className="list-decimal pl-4 mt-2 space-y-1">
                    <li>Haz clic en "Abrir WhatsApp Web".</li>
                    <li>Regresa a esta ventana y haz clic derecho en el comprobante a continuación para copiar la imagen (o saca un screenshot de la tabla de ventas original).</li>
                    <li>Pega la imagen en el chat de WhatsApp antes de enviarlo.</li>
                  </ol>
                </div>
                
                <a
                  href={successData.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 py-3 text-sm font-bold text-white shadow-lg shadow-whatsapp/20 transition-transform hover:scale-[1.02]"
                >
                  <img src="/icons/whatsapp.svg" alt="WA" className="h-5 w-5 brightness-0 invert" onError={(e) => e.currentTarget.style.display='none'} />
                  Abrir WhatsApp Web
                </a>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted">
                Se ha enviado un correo electrónico de notificación al vendedor.
              </div>
            )}

            <div className="mt-4 text-left">
              {successData.receiptUrl ? (
                <>
                  <p className="mb-2 text-sm font-semibold text-text">Comprobante Registrado:</p>
                  <div className="rounded-xl border border-border bg-surface p-2 max-h-[300px] overflow-hidden flex justify-center">
                    <img src={successData.receiptUrl} alt="Comprobante" className="object-contain h-full w-auto" />
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-rose-500/30 bg-rose-500/5 p-4 text-center">
                  <p className="text-sm font-medium text-rose-400">Pago registrado sin comprobante</p>
                </div>
              )}
            </div>

            <Button onClick={() => setSuccessData(null)} className="w-full">Cerrar</Button>
          </div>
        </Modal>
      )}

      {mixedSellerWarning && (
        <Modal open={true} onClose={() => setMixedSellerWarning(false)} title="Atención" maxWidth="max-w-md">
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div>
              <p className="text-lg font-bold text-text">Estás mezclando ventas</p>
              <p className="text-sm text-muted mt-2">
                Has seleccionado ventas de dos o más vendedores distintos. Para aprobar y registrar el pago, <strong className="text-rose-400">por favor selecciona ventas de un solo vendedor a la vez.</strong>
              </p>
            </div>
            <Button onClick={() => setMixedSellerWarning(false)} className="w-full bg-rose-500 hover:bg-rose-600 text-white">
              Entendido
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ApproveAndPayModal({ sales, onClose, onSuccess, approveAndPayBulk }: { sales: Sale[]; onClose: () => void; onSuccess: (data: any) => void; approveAndPayBulk: any }) {
  const [method, setMethod] = useState<"cash" | "deposit">("cash");
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  const { data: balances = {} } = useGetBalancesQuery();
  const totalComision = sales.reduce((sum, s) => sum + (s.comisionVendedor || 0), 0);
  const sellerName = sales[0].sellerName;
  const saldo = balances[sales[0]?.sellerEmail]?.balance ?? 0;
  const totalAPagar = Math.max(0, Math.round((totalComision + saldo) * 100) / 100);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file && !comment.trim()) {
      return toast.error("Debes adjuntar el comprobante o ingresar un motivo de por qué no lo subes.");
    }
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("saleIds", JSON.stringify(sales.map(s => s.id)));
      fd.append("paymentMethod", method);
      if (file) fd.append("receipt", file);
      if (comment.trim()) fd.append("noReceiptComment", comment.trim());
      if (paymentDate) fd.append("paymentDate", paymentDate);

      const res = await approveAndPayBulk(fd).unwrap();
      onSuccess(res);
      toast.success("Pago procesado exitosamente.");
    } catch (err: any) {
      toast.error(err?.data?.error || "Error al procesar el pago.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title="Revisión y Pago de Ventas">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 text-sm text-muted">
            Vendedor: <strong className="text-text">{sellerName}</strong>
            <br/>
            Ventas a aprobar: <strong className="text-text">{sales.length}</strong>
          </div>
          
          <div className="bg-background/50 rounded-lg p-3 border border-border/50 space-y-1.5">
            {saldo !== 0 && (
              <>
                <div className="flex justify-between items-center text-xs text-muted">
                  <span>Comisión de ventas:</span>
                  <span>{formatCordobas(totalComision)}</span>
                </div>
                <div className={`flex justify-between items-center text-xs font-medium ${saldo > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  <span>Saldo {saldo > 0 ? "a favor" : "en contra"} (ajustes):</span>
                  <span>{saldo > 0 ? "+" : "−"}{formatCordobas(Math.abs(saldo))}</span>
                </div>
                <div className="border-t border-border/50 my-1" />
              </>
            )}
            <div className="flex justify-between items-center text-sm font-semibold">
              <span>Total a Pagar:</span>
              <span className="text-lg text-emerald-400">{formatCordobas(saldo !== 0 ? totalAPagar : totalComision)}</span>
            </div>
            {saldo < 0 && totalAPagar === 0 && (
              <p className="text-[11px] text-rose-400 pt-1">
                El saldo en contra supera la comisión: se descontará lo posible y el resto queda pendiente para el próximo pago.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Fecha de Pago</label>
          <DatePicker
            value={paymentDate}
            onChange={(val) => setPaymentDate(val)}
            placeholder="Selecciona la fecha de pago"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Método de Pago</label>
          <div className="grid grid-cols-2 gap-2">
            <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors ${method === "cash" ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface hover:bg-surface-2 text-muted"}`}>
              <input type="radio" name="method" value="cash" className="hidden" checked={method === "cash"} onChange={() => setMethod("cash")} />
              💵 Efectivo (Factura)
            </label>
            <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors ${method === "deposit" ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface hover:bg-surface-2 text-muted"}`}>
              <input type="radio" name="method" value="deposit" className="hidden" checked={method === "deposit"} onChange={() => setMethod("deposit")} />
              🏦 Depósito (Screenshot)
            </label>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Comprobante (Opcional si justificas)</label>
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 p-6 text-sm text-muted hover:border-accent hover:text-accent transition-colors">
            {file ? file.name : method === "cash" ? "Sube la foto de la factura" : "Sube el screenshot del depósito"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>

        {!file && (
          <div className="animate-fade-in">
            <label className="mb-1.5 block text-xs font-semibold text-rose-400">Motivo por no subir comprobante (Obligatorio)</label>
            <textarea
              className="input w-full"
              rows={2}
              placeholder="Ej: Pago realizado previamente, venta migrada..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
            />
          </div>
        )}

        <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="bg-emerald-500 hover:bg-emerald-600 text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Aprobar y Pagar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
