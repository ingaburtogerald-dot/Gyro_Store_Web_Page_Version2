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
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-accent text-white shadow-[0_0_15px_rgba(124,131,255,0.35)]">
          <ShoppingCart className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-text">{isEdit ? "Editar venta" : "Registrar venta"}</h2>
          <p className="text-xs text-muted">Arma las líneas y el total se calcula en vivo.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        {/* COLUMNA IZQUIERDA: datos + productos */}
        <div className="space-y-4">
          {/* Sección: datos de la venta */}
          <div className="space-y-3 rounded-card border border-border bg-surface p-4">
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
                    <option value="">Seleccionar vendedor…</option>
                    {sellers.map((s) => (
                      <option key={s.id} value={s.email}>
                        {s.displayName} ({s.email})
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
          <div className="space-y-3 rounded-card border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-accent-2" />
              <h3 className="text-sm font-semibold text-text">Productos</h3>
              <span className="ml-auto rounded-pill bg-surface-2 px-2 py-0.5 text-xs text-muted">{lines.length}</span>
            </div>

            {lines.map((line, i) => {
              const p = productsForUi.find((pr) => pr.id === line.productId);
              const lineSubtotal = (Number(line.quantity) || 0) * (Number(line.salePrice) || 0);
              return (
                <div key={i} className="space-y-3 rounded-xl border border-border bg-surface-2/50 p-3.5 animate-in fade-in">
                  {/* Fila superior: número + código + producto + eliminar */}
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-accent text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    {p?.code && (
                      <span className="shrink-0 rounded-md bg-surface px-2 py-0.5 font-mono text-xs text-muted">{p.code}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <ProductAutocomplete
                        products={sortedProducts}
                        value={line.productId}
                        onChange={(val) => update(i, { productId: val })}
                      />
                    </div>
                    <button
                      onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                      disabled={lines.length === 1}
                      className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
                      aria-label="Quitar línea"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Fila inferior: cantidad + precio + subtotal */}
                  <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
                    <label className="block w-24 shrink-0">
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
                    <label className="block min-w-0 flex-1">
                      <span className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
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
                                  <span className="rounded-pill bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-500">
                                    −{discountPercent}% mayoreo
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => update(i, { salePrice: suggestedPrice })}
                                  className="font-medium text-accent transition-colors hover:text-accent-2 hover:underline"
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
                    <div className="shrink-0 pt-5 text-right">
                      <span className="block text-xs text-muted">Subtotal</span>
                      <span className="text-sm font-bold text-text">{formatCordobas(lineSubtotal)}</span>
                    </div>
                  </div>

                  {p && typeof line.quantity === "number" && line.quantity > p.stock && (
                    <p className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Solo hay {p.stock} uds disponibles.
                    </p>
                  )}

                  {p?.origin === "migrated" && (
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                      <span className="flex items-center gap-1 rounded-pill bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
                        <Tag className="h-3 w-3" /> Migrado
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

            {/* Agregar producto + recibo opcional */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                onClick={() => setLines((ls) => [...ls, { ...emptyLine }])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-accent-2/40 px-3 py-2 text-sm font-semibold text-accent-2 transition-colors hover:bg-accent-2/5"
              >
                <Plus className="h-4 w-4" /> Agregar producto
              </button>

              <label className="flex cursor-pointer items-center gap-2 rounded-pill border border-border bg-background/50 px-3 py-1.5 text-xs text-muted transition-colors hover:text-text">
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

          {/* Motivo de edición de venta ya procesada */}
          {isEdit && sale?.status !== "pending_approval" && (
            <div className="rounded-card border border-border bg-surface p-4 animate-in fade-in">
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

          {/* Acciones principales */}
          <div className="flex flex-col gap-3">
            <Button
              className="w-full py-5 text-sm font-bold"
              onClick={registerSale}
              loading={reporting || updating}
              disabled={!saleDate || validLines.length === 0 || hasOverStock || isMixed || !!errorMsg || (isEdit && sale?.status !== 'pending_approval' && !editReason.trim())}
            >
              {isEdit ? "Guardar cambios" : "Registrar venta"} · {formatCordobas(result?.saleTotal ?? 0)}
            </Button>
            {isEdit && sale?.status !== "pending_approval" && !editReason.trim() && (
              <p className="flex items-center gap-1.5 text-xs text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Escribe el <strong>motivo de la edición</strong> para habilitar “Guardar cambios”.
              </p>
            )}
            {isAdmin && !isEdit && (
              <Button
                variant="ghost"
                className="flex w-full items-center justify-center gap-1.5 border border-border"
                onClick={() => setInstallmentOpen(true)}
                disabled={validLines.length === 0 || hasOverStock}
              >
                <CreditCard className="h-4 w-4" /> Vender en cuotas
              </Button>
            )}
          </div>
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
              Cerrar
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

