// Editor de venta: el vendedor arma líneas (producto + cantidad + precio de venta),
// ve el cotizador en vivo (utilidad, comisión, ganancia) y registra la venta con
// foto de recibo opcional. El servidor recalcula todo al cotizar y al registrar.
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, Camera, Tag, CreditCard, AlertTriangle, Check, CheckCircle2, User, CalendarDays, Package, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { Modal } from "~/components/ui/Modal";
import { QuoteSummary } from "./QuoteSummary";
import { InstallmentSaleModal } from "./InstallmentSaleModal";
import { ProductAutocomplete } from "./ProductAutocomplete";
import {
  useGetSellableProductsQuery,
  useGetPricingConfigQuery,
  useQuoteSaleMutation,
  useReportSaleMutation,
  useUpdateSaleMutation,
  type QuoteResult,
  type Discount,
  type Sale,
} from "~/store/api/salesApi";
import { useGetUsersQuery } from "~/store/api/usersApi";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin } from "~/store/slices/authSlice";
import { DatePicker } from "~/components/ui/DatePicker";
import { formatCordobas, cn } from "~/lib/utils";

import { OrderLineItemsTable, type OrderLine as Line } from "./OrderLineItemsTable";

const newLine = (): Line => ({ uid: crypto.randomUUID(), productId: "", quantity: "", salePrice: "", mode: "M2" });

export function SaleEditor({ sale, onDone }: { sale?: Sale | null; onDone?: () => void } = {}) {
  const isEdit = !!sale;
  const isAdmin = useAppSelector(selectIsAdmin);
  const { data: products = [] } = useGetSellableProductsQuery();
  const { data: pricing } = useGetPricingConfigQuery();
  const { data: allUsers = [] } = useGetUsersQuery(undefined, { skip: !isAdmin });
  const wholesaleDiscounts = pricing?.wholesaleDiscounts ?? [];

  const [quote, { isLoading: quoting }] = useQuoteSaleMutation();
  const [report, { isLoading: reporting }] = useReportSaleMutation();
  const [updateSale, { isLoading: updating }] = useUpdateSaleMutation();

  const [lines, setLines] = useState<Line[]>(() =>
    sale && sale.items?.length
      ? sale.items.map((it) => ({ uid: crypto.randomUUID(), productId: it.productId, quantity: it.quantity, salePrice: it.salePrice, mode: it.mode ?? "M2" }))
      : [newLine()],
  );
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [selectedSellerEmail, setSelectedSellerEmail] = useState(sale?.sellerEmail ?? "");
  // Venta nueva: hoy por defecto (el caso del 95%); editar conserva la fecha original.
  const [saleDate, setSaleDate] = useState<string>(
    sale?.createdAt ? sale.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [editReason, setEditReason] = useState("");
  const [installmentOpen, setInstallmentOpen] = useState(false);
  const [showSuccessPrompt, setShowSuccessPrompt] = useState(false);

  // En modo edición, la venta ya tiene stock reservado: lo "devolvemos" al catálogo
  // del editor (sumando su cantidad) para que sus productos sigan seleccionables.
  const productsForUi = useMemo(() => {
    if (!sale) return products;
    const byId = new Map(products.map((p) => [p.id, { ...p }]));
    for (const it of sale.items || []) {
      const ex = byId.get(it.productId);
      if (ex) ex.stock += it.quantity || 0;
      else byId.set(it.productId, { id: it.productId, code: it.code, name: it.name, price: it.salePrice, stock: it.quantity || 0, origin: (it.origin as any) || "native" });
    }
    return Array.from(byId.values());
  }, [products, sale]);

  // Vendedores + admins (los admins también pueden registrarse ventas a sí mismos).
  const sellers = allUsers.filter(
    (u) => u.roles.includes("seller") || u.roles.includes("admin") || u.roles.includes("global_admin"),
  );
  const validLines = lines
    .filter(
      (l) => l.productId && typeof l.quantity === "number" && l.quantity > 0 && typeof l.salePrice === "number" && l.salePrice > 0
    )
    .map((l) => {
      const p = productsForUi.find((pr) => pr.id === l.productId);
      const origin = p?.origin ?? "native";
      return {
        productId: l.productId,
        quantity: l.quantity as number,
        salePrice: l.salePrice as number,
        origin,
        ...(origin === "migrated" ? { mode: l.mode ?? "M2" } : {}),
      };
    });
  // ¿Alguna línea pide más unidades de las que hay en stock?
  const hasOverStock = lines.some((l) => {
    const p = productsForUi.find((pr) => pr.id === l.productId);
    return p && typeof l.quantity === "number" && l.quantity > p.stock;
  });
  // Regla: una venta no puede mezclar inventario actual y migrado.
  const hasMigratedItem = lines.some((l) => {
    const p = productsForUi.find((pr) => pr.id === l.productId);
    return p?.origin === "migrated";
  });
  const isMixed = new Set(validLines.map((l) => l.origin)).size > 1;

  // Total local optimista: mientras el servidor cotiza, el botón ya muestra el importe.
  const localTotal = lines.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.salePrice) || 0),
  0);

  // Ventas distintas (por código+precio) en la registración: cada combinación se registra como venta aparte.
  const distinctProductCount = new Set(
    validLines.map((l) => {
      const code = productsForUi.find((pr) => pr.id === l.productId)?.code ?? l.productId;
      return `${code}|${l.salePrice}`;
    }),
  ).size;

  // Una sola razón visible a la vez: el botón deshabilitado siempre explica por qué.
  const disabledReason =
    validLines.length === 0 ? "Agrega al menos un producto con cantidad y precio."
    : hasOverStock ? "Hay líneas que exceden el stock disponible."
    : isMixed ? "No mezcles inventario actual y migrado en la misma venta."
    : !saleDate ? "Selecciona la fecha de la venta."
    : isAdmin && !selectedSellerEmail ? "Selecciona el vendedor de esta venta."
    : isEdit && sale?.status !== "pending_approval" && !editReason.trim()
      ? "Escribe el motivo de la edición para habilitar el guardado."
    : null;

  // Preview del recibo adjunto (object URL con limpieza al reemplazar/desmontar).
  const receiptUrl = useMemo(() => (receipt ? URL.createObjectURL(receipt) : null), [receipt]);
  useEffect(() => {
    return () => {
      if (receiptUrl) URL.revokeObjectURL(receiptUrl);
    };
  }, [receiptUrl]);

  const linesKey = JSON.stringify(validLines);
  useEffect(() => {
    if (validLines.length === 0) {
      setResult(null);
      setErrorMsg("");
      return;
    }
    if (isMixed) {
      setResult(null);
      setErrorMsg("Una venta no puede mezclar inventario actual y migrado. Deja un solo tipo.");
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await quote({ items: validLines }).unwrap();
        setResult(res);
        setErrorMsg("");
      } catch (err: any) {
        setResult(null);
        setErrorMsg(err?.data?.error || "Error al calcular la cotización.");
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey]);

  function update(i: number, patch: Partial<Line>) {
    setLines((ls) => {
      const newLines = [...ls];
      const current = newLines[i];
      const updated = { ...current, ...patch };

      newLines[i] = updated;
      return newLines;
    });
  }

  async function registerSale() {
    if (validLines.length === 0) return toast.error("Agrega al menos una línea válida.");
    if (isMixed) return toast.error("No mezcles inventario actual y migrado en la misma venta.");
    if (!saleDate) return toast.error("La fecha de la venta es obligatoria.");

    if (isAdmin && !selectedSellerEmail) {
      return toast.error("Por favor, selecciona el vendedor para esta venta.");
    }

    const selSeller = isAdmin ? sellers.find((s) => s.email === selectedSellerEmail) : null;

    // Modo edición: PUT con FormData (se puede cambiar el recibo).
    if (isEdit && sale) {
      const fd = new FormData();
      fd.append("items", JSON.stringify(validLines));
      if (receipt) fd.append("receipt", receipt);
      if (saleDate) fd.append("saleDate", saleDate);
      if (selSeller) {
        fd.append("sellerUid", selSeller.uid || selSeller.id || "");
        fd.append("sellerEmail", selSeller.email);
        fd.append("sellerName", selSeller.displayName);
      }
      if (sale.status !== 'pending_approval' && editReason) {
        fd.append("editReason", editReason);
      }

      try {
        await updateSale({
          id: sale.id,
          body: fd,
        }).unwrap();
        toast.success("Venta actualizada.");
        onDone?.();
      } catch (err: any) {
        toast.error(err?.data?.error || "No se pudo actualizar la venta.");
      }
      return;
    }

    const fd = new FormData();
    fd.append("items", JSON.stringify(validLines));
    if (receipt) fd.append("receipt", receipt);
    if (saleDate) fd.append("saleDate", saleDate);

    if (selSeller) {
      fd.append("sellerUid", selSeller.uid || selSeller.id || "");
      fd.append("sellerEmail", selSeller.email);
      fd.append("sellerName", selSeller.displayName);
    }

    try {
      const created = await report(fd).unwrap();
      const createdCount = created.count ?? 1;
      toast.success(
        createdCount > 1
          ? `${createdCount} ventas registradas (una por producto). Pendientes de aprobación.`
          : "Venta registrada. Pendiente de aprobación.",
      );
      setShowSuccessPrompt(true);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo registrar la venta.");
    }
  }

  return (
    <div className="space-y-4">
      {/* El título vive en la barra del Modal que envuelve al editor (no se duplica aquí). */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        {/* COLUMNA IZQUIERDA: datos + productos */}
        <div className="space-y-4">
          {/* Sección: datos de la venta */}
          <div className="space-y-3 rounded-card border border-border bg-surface shadow-premium p-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-accent-2" />
              <h3 className="text-sm font-semibold text-text">Datos de la venta</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {isAdmin && (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Registrar a nombre de</span>
                  <select
                    className="input"
                    value={selectedSellerEmail}
                    onChange={(e) => setSelectedSellerEmail(e.target.value)}
                  >
                    <option value="" className="bg-surface text-text">Seleccionar vendedor…</option>
                    {sellers.map((s) => (
                      <option key={s.id} value={s.email} className="bg-surface text-text">
                        {s.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-medium text-muted">
                  <CalendarDays className="h-3.5 w-3.5" /> Fecha de la venta *
                </span>
                <DatePicker value={saleDate} onChange={setSaleDate} />
              </label>
            </div>
          </div>

          {/* Sección: productos */}
          <div className="space-y-3 rounded-card border border-border bg-surface shadow-premium p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-accent-2" />
              <h3 className="text-sm font-semibold text-text">Productos</h3>
              <span className="ml-auto rounded-pill bg-surface-2 px-2 py-0.5 text-xs text-muted">{lines.length}</span>
            </div>

            <OrderLineItemsTable
              lines={lines as any}
              products={productsForUi}
              wholesaleDiscounts={wholesaleDiscounts}
              onChange={(newLines) => setLines(newLines as any)}
              onAddLine={!isEdit ? () => setLines((ls) => [...ls, newLine()]) : undefined}
            />

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-end">
              {receipt && receiptUrl ? (
                <div className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2/50 p-2 sm:w-auto sm:max-w-xs animate-in fade-in">
                  <img src={receiptUrl} alt="Recibo adjunto" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-text">{receipt.name}</p>
                    <p className="text-[11px] text-muted">
                      {receipt.size >= 1048576
                        ? `${(receipt.size / 1048576).toFixed(1)} MB`
                        : `${Math.round(receipt.size / 1024)} KB`}
                    </p>
                  </div>
                  <button
                    onClick={() => setReceipt(null)}
                    className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    aria-label="Quitar foto del recibo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex w-full justify-center cursor-pointer items-center gap-2 rounded-pill border border-border bg-bg/50 px-3 py-1.5 text-xs text-muted transition-colors hover:text-text sm:w-auto">
                  <Camera className="h-3.5 w-3.5" />
                  {isEdit ? "Actualizar foto del recibo" : "Adjuntar foto del recibo"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setReceipt(e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: resumen sticky + acciones */}
        <div className="space-y-4 lg:sticky lg:top-0 lg:self-start">
          <QuoteSummary result={result} loading={quoting} errorMsg={errorMsg} />

          {/* Aviso de ajuste de saldo al editar una venta YA PAGADA */}
          {isEdit && sale?.status === "paid" && result && (() => {
            const oldCom = sale.comisionVendedor ?? 0;
            const newCom = result.comisionVendedor ?? 0;
            const delta = Math.round((newCom - oldCom) * 100) / 100;
            if (delta === 0) return null;
            const favor = delta > 0;
            return (
              <div className={cn(
                "rounded-lg border p-3 text-sm animate-in fade-in",
                favor ? "border-accent/30 bg-accent/10 text-accent-2" : "border-danger/30 bg-danger/10 text-danger",
              )}>
                <p className="font-semibold">
                  {favor ? "Saldo a favor del vendedor" : "Saldo en contra del vendedor"}: {formatCordobas(Math.abs(delta))}
                </p>
                <p className="mt-1 text-xs opacity-90">
                  Esta venta ya fue pagada. La comisión cambia de {formatCordobas(oldCom)} a {formatCordobas(newCom)}. La diferencia se
                  {favor ? " sumará" : " descontará"} en el próximo pago del vendedor (o puedes saldarla aparte desde Historial de Pagos). El lote de pago original no se modifica.
                </p>
              </div>
            );
          })()}

          {/* Motivo de edición de venta ya procesada */}
          {isEdit && sale?.status !== "pending_approval" && (
            <div className="rounded-card border border-border bg-surface shadow-premium p-4 animate-in fade-in">
              <label className="block">
                <span className="mb-1 block text-sm font-bold text-accent-2">
                  Motivo de la edición (Obligatorio)
                </span>
                <textarea
                  className="input w-full bg-surface-2/30 hover:bg-surface-2 focus:ring-1 focus:ring-accent-2 border-accent-2/40"
                  rows={2}
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Explica por qué estás editando esta venta ya procesada..."
                  required
                />
              </label>
            </div>
          )}

          {/* Acciones principales */}
          <div className="flex flex-col gap-3">
            <Button
              className="group w-full gap-2 py-5 text-sm font-bold shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30"
              onClick={registerSale}
              loading={reporting || updating}
              disabled={!!disabledReason || !!errorMsg}
            >
              <CheckCircle2 className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" />
              {isEdit ? "Guardar cambios" : distinctProductCount > 1 ? `Registrar ${distinctProductCount} ventas` : "Registrar venta"} · {formatCordobas(result?.saleTotal ?? localTotal)}
            </Button>
            {!isEdit && distinctProductCount > 1 && (
              <p className="text-center text-xs text-muted animate-in fade-in">
                Cada producto distinto se registra como una venta independiente.
              </p>
            )}
            {disabledReason && (
              <p className="flex items-center gap-1.5 text-xs text-warning animate-in fade-in">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {disabledReason}
              </p>
            )}
            {isAdmin && !isEdit && (
              <Button
                variant="ghost"
                className="group flex w-full items-center justify-center gap-1.5 border border-border"
                onClick={() => setInstallmentOpen(true)}
                disabled={validLines.length === 0 || hasOverStock || !saleDate || !result}
              >
                <CreditCard className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" /> Vender en cuotas
              </Button>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={showSuccessPrompt}
        onClose={() => {
          // Escape / clic afuera equivalen a "Cerrar" (antes quedaba atrapado).
          setShowSuccessPrompt(false);
          onDone?.();
        }}
        title="¡Venta registrada con éxito!"
      >
        <div className="space-y-4 text-center pb-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
            <Check className="h-8 w-8 text-accent" />
          </div>
          <p className="text-muted">Tu venta ha sido reportada y está pendiente de aprobación.</p>
          <h3 className="text-lg font-bold text-text mt-4">¿Deseas registrar otra venta?</h3>
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowSuccessPrompt(false);
                onDone?.(); // Cierra el modal principal
              }}
            >
              Cerrar
            </Button>
            <Button
              className="bg-accent text-white"
              onClick={() => {
                setShowSuccessPrompt(false);
                setLines([newLine()]);
                setReceipt(null);
                setResult(null);
                setErrorMsg("");
                setSelectedSellerEmail("");
              }}
            >
              Sí, registrar otra
            </Button>
          </div>
        </div>
      </Modal>

      {installmentOpen && saleDate && result && (
        <InstallmentSaleModal
          open={installmentOpen}
          onClose={() => setInstallmentOpen(false)}
          totalAmount={result?.saleTotal ?? 0}
          items={validLines.map((l) => ({
            productId: l.productId,
            name: productsForUi.find((pr) => pr.id === l.productId)?.name ?? "",
            quantity: l.quantity,
            salePrice: l.salePrice,
          }))}
          seller={
            selectedSellerEmail
              ? (() => {
                  const s = sellers.find((sl) => sl.email === selectedSellerEmail);
                  return s
                    ? { email: s.email, name: s.displayName, uid: s.uid || s.id || "" }
                    : undefined;
                })()
              : undefined
          }
          onCreated={() => {
            setInstallmentOpen(false);
            onDone?.();
          }}
        />
      )}
    </div>
  );
}

