// Editor de venta: el vendedor arma líneas (producto + cantidad + precio de venta),
// ve el cotizador en vivo (utilidad, comisión, ganancia) y registra la venta con
// foto de recibo opcional. El servidor recalcula todo al cotizar y al registrar.
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Camera, Tag, CreditCard, AlertTriangle, Check, User, CalendarDays, Package, ShoppingCart } from "lucide-react";
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

interface Line {
  productId: string;
  quantity: number | "";
  salePrice: number | "";
  mode?: "M1" | "M2"; // solo para líneas de inventario migrado
}

const emptyLine: Line = { productId: "", quantity: "", salePrice: "", mode: "M1" };

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
      ? sale.items.map((it) => ({ productId: it.productId, quantity: it.quantity, salePrice: it.salePrice, mode: it.mode ?? "M1" }))
      : [{ ...emptyLine }],
  );
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [selectedSellerEmail, setSelectedSellerEmail] = useState(sale?.sellerEmail ?? "");
  const [saleDate, setSaleDate] = useState<string>(sale?.createdAt ? sale.createdAt.slice(0, 10) : "");
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

  const sellers = allUsers.filter((u) => u.roles.includes("seller") || u.email === "ingaburtogerald@gmail.com");
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
        ...(origin === "migrated" ? { mode: l.mode ?? "M1" } : {}),
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

  // Productos ordenados por código (natural: IN1, IN2 … IN6, IN12) para el selector.
  const sortedProducts = useMemo(
    () => [...productsForUi].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [productsForUi],
  );

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
  }, [JSON.stringify(validLines)]);

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
      await report(fd).unwrap();
      toast.success("Venta registrada. Pendiente de aprobación.");
      setShowSuccessPrompt(true);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo registrar la venta.");
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="space-y-4 rounded-card border border-border bg-surface p-4">
        {/* Selector de vendedor (sólo visible para Admin) */}
        {isAdmin && (
          <div className="rounded-lg border border-dashed border-accent-2/30 bg-accent-2/5 p-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-accent-2">
                👤 Registrar a nombre de:
              </span>
              <select
                className="input border-accent-2/40 focus:border-accent-2 focus:ring-accent-2"
                value={selectedSellerEmail}
                onChange={(e) => setSelectedSellerEmail(e.target.value)}
              >
                <option value="">Seleccionar vendedor…</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.email}>
                    {s.displayName} ({s.email})
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* Fecha de la venta */}
        <label className="block sm:w-56">
          <span className="mb-1 block text-xs font-semibold text-accent-2">📅 Fecha de la venta (Obligatorio)</span>
          <DatePicker value={saleDate} onChange={setSaleDate} />
        </label>

        {lines.map((line, i) => {
          const p = productsForUi.find((pr) => pr.id === line.productId);
          return (
            <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2/50 p-4 relative group">
              <div className="flex items-start justify-between gap-3">
                <label className="block flex-1">
                  <span className="mb-1 block text-xs text-muted">Producto</span>
                  <ProductAutocomplete
                    products={sortedProducts}
                    value={line.productId}
                    onChange={(val) => update(i, { productId: val })}
                  />
                </label>
                <button
                  onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                  disabled={lines.length === 1}
                  className="mt-6 rounded-lg p-2 text-muted hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30 shrink-0 transition-colors"
                  aria-label="Quitar línea"
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-3 items-start">
                <label className="block w-full sm:w-1/3">
                  <span className="mb-1 block text-xs text-muted">Cantidad</span>
                  <input
                    type="number"
                    min={1}
                    max={p?.stock}
                    className="input"
                    placeholder="0"
                    value={line.quantity}
                    onChange={(e) => update(i, { quantity: e.target.value === "" ? "" : (parseInt(e.target.value, 10) || 0) })}
                  />
                </label>
                <label className="block w-full sm:w-2/3">
                  <span className="mb-1 flex flex-wrap items-center justify-between text-xs text-muted gap-2">
                    <span>Precio unitario (C$)</span>
                    {p && (() => {
                        const qty = Number(line.quantity) || 0;
                        let suggestedPrice = p.price;
                        let discountPercent = 0;

                        if (p.origin !== "migrated" && wholesaleDiscounts.length > 0) {
                          const applicableTiers = wholesaleDiscounts.filter(
                            (d) => qty >= d.minQty && (d.maxQty == null || qty <= d.maxQty)
                          );
                          if (applicableTiers.length > 0) {
                            const bestTier = applicableTiers.reduce((prev, current) => 
                              (prev.discountPercent > current.discountPercent) ? prev : current
                            );
                            discountPercent = bestTier.discountPercent;
                            suggestedPrice = p.price * (1 - discountPercent / 100);
                          }
                        }

                        return (
                          <div className="flex items-center gap-2">
                            {discountPercent > 0 && (
                              <span className="text-emerald-500 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded-pill">
                                −{discountPercent}% mayoreo
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => update(i, { salePrice: suggestedPrice })}
                              className="text-accent hover:text-accent-2 font-medium hover:underline transition-colors"
                              title="Haz clic para usar este precio sugerido"
                            >
                              Sugerido: {formatCordobas(suggestedPrice)}
                            </button>
                          </div>
                        );
                    })()}
                  </span>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    placeholder="Precio..."
                    value={line.salePrice}
                    onChange={(e) => update(i, { salePrice: e.target.value === "" ? "" : (parseFloat(e.target.value) || 0) })}
                  />
                </label>
              </div>

              {p && typeof line.quantity === "number" && line.quantity > p.stock && (
                <p className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 mt-1">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Solo hay {p.stock} uds disponibles.
                </p>
              )}

              {p?.origin === "migrated" && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 mt-1">
                  <span className="rounded-pill bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
                    🏷️ Migrado
                  </span>
                  <span className="text-xs text-muted">Cálculo:</span>
                  <div className="flex gap-1 rounded-pill border border-border bg-surface p-0.5">
                    {(["M1", "M2"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => update(i, { mode: m })}
                        className={cn(
                          "rounded-pill px-3 py-1 text-xs font-semibold transition-colors",
                          (line.mode ?? "M1") === m ? "bg-gradient-accent text-white" : "text-muted hover:text-text",
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Botones de acción rápidos */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 pt-2">
          <button
            onClick={() => setLines((ls) => [...ls, { ...emptyLine }])}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-2 hover:underline"
          >
            <Plus className="h-4 w-4" /> Agregar producto
          </button>

          {/* Recibo opcional con captura de cámara */}
          <label className="flex cursor-pointer items-center gap-2 rounded-pill border border-border bg-background/50 px-3 py-1.5 text-xs text-muted hover:text-text transition-colors">
            <Camera className="h-3.5 w-3.5" />
            {receipt ? receipt.name : isEdit ? "Actualizar foto del recibo" : "Adjuntar foto del recibo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setReceipt(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        {/* Cotización en vivo */}
        <div className="pt-2">
          <QuoteSummary result={result} loading={quoting} errorMsg={errorMsg} />
        </div>

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
              favor ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300",
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

        {/* Acciones principales de guardado */}
        {isEdit && sale?.status !== "pending_approval" && (
          <div className="pt-2 animate-in fade-in slide-in-from-bottom-2">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-accent-2">
                Motivo de la edición (Obligatorio)
              </span>
              <textarea
                className="input border-accent-2/40 focus:border-accent-2 focus:ring-accent-2 w-full"
                rows={2}
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Explica por qué estás editando esta venta ya procesada..."
                required
              />
            </label>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            className="flex-1 py-5 text-sm font-bold"
            onClick={registerSale}
            loading={reporting || updating}
            disabled={!saleDate || validLines.length === 0 || hasOverStock || isMixed || !!errorMsg || (isEdit && sale?.status !== 'pending_approval' && !editReason.trim())}
          >
            {isEdit ? "Guardar cambios" : "Registrar venta"} · {formatCordobas(result?.saleTotal ?? 0)}
          </Button>
          {isAdmin && !isEdit && (
            <Button
              variant="ghost"
              className="flex items-center justify-center gap-1.5 border border-border sm:w-48"
              onClick={() => setInstallmentOpen(true)}
              disabled={validLines.length === 0 || hasOverStock}
            >
              <CreditCard className="h-4 w-4" /> Vender en cuotas
            </Button>
          )}
        </div>
      </div>

      <Modal open={showSuccessPrompt} onClose={() => {}} title="¡Venta registrada con éxito!">
        <div className="space-y-4 text-center pb-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <Check className="h-8 w-8 text-emerald-500" />
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
              Salir
            </Button>
            <Button
              className="bg-accent text-white"
              onClick={() => {
                setShowSuccessPrompt(false);
                setLines([{ ...emptyLine }]);
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

