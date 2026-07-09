// Modal para generar o editar un ticket de facturación. Al crear, el servidor
// RESERVA el stock FIFO; al editar (solo pendientes) reajusta las reservas.
// El precio se autocompleta desde el catálogo y es negociable; el delivery es
// solo informativo (se imprime pero no entra al total de la venta).
// El descuento se calcula automáticamente como la diferencia entre el precio
// de catálogo y el precio ingresado (no es manual).
// La búsqueda de productos vive en un mini-modal dedicado para mantener el
// formulario principal limpio.
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Trash2,
  Package,
  UserRound,
  Truck,
  CreditCard,
  AlertTriangle,
  ShoppingCart,
  Plus,
  Minus,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import {
  useSearchProductsQuery,
  useCreateInvoiceMutation,
  useUpdateInvoiceMutation,
  useGetTicketSellersQuery,
  type Invoice,
  type NewInvoice,
  type ProductLookup,
  type ProductOrigin,
} from "~/store/api/invoicesApi";
import { formatCordobas, cn } from "~/lib/utils";

interface Line {
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  catalogPrice: number;
  origin: ProductOrigin;
  productId: string;
}

/** Píldora "Migrado" */
function MigratedTag() {
  return (
    <span className="shrink-0 rounded-pill bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">
      Migrado
    </span>
  );
}

const priceToStr = (n: number) => (n > 0 ? String(n) : "");
const strToPrice = (s: string) => {
  const n = parseFloat(s);
  return Number.isNaN(n) || n < 0 ? 0 : n;
};

/* ═══════════════════════════════════════════════════════════════════════════════
   Mini-modal de búsqueda de productos
   ═══════════════════════════════════════════════════════════════════════════════ */
function ProductSearchModal({
  open,
  onClose,
  onSelect,
  currentOrigin,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (p: ProductLookup) => void;
  currentOrigin?: ProductOrigin;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results = [], isFetching: searching } = useSearchProductsQuery(debouncedQuery, {
    skip: debouncedQuery.length < 2,
  });
  const inStock = results.filter((p) => (p.stock || 0) > 0);

  // Auto-focus al abrir.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Limpiar al cerrar.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  function handleSelect(p: ProductLookup) {
    // Regla de No-Mezcla.
    if (currentOrigin && currentOrigin !== p.origin) {
      toast.error("Un ticket no puede mezclar inventario actual y migrado. Emite tickets por separado.");
      return;
    }
    onSelect(p);
    // Cerrar el modal después de seleccionar (según solicitud).
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar producto" maxWidth="max-w-lg">
      <div className="space-y-3">
        {/* Barra de búsqueda */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 transition-colors focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20">
          <Search className={cn("h-4 w-4 shrink-0 transition-colors", searching ? "animate-pulse text-accent" : "text-muted")} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && inStock.length > 0) handleSelect(inStock[0]);
            }}
            placeholder="Busca por código o nombre…"
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setDebouncedQuery(""); }}
              className="shrink-0 rounded-md p-1 text-muted hover:text-text"
            >
              <span className="text-xs">Limpiar</span>
            </button>
          )}
        </div>

        {/* Resultados */}
        <div className="min-h-[200px]">
          {debouncedQuery.length < 2 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Search className="h-7 w-7 text-muted/25" />
              <p className="text-sm text-muted">
                Escribe al menos 2 caracteres para buscar.
              </p>
            </div>
          ) : searching ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
              <p className="text-sm text-muted">Buscando…</p>
            </div>
          ) : inStock.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Package className="h-7 w-7 text-muted/25" />
              <p className="text-sm text-muted">
                {results.length > 0
                  ? `Sin stock disponible para "${debouncedQuery}"`
                  : `Sin resultados para "${debouncedQuery}"`}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {inStock.map((p) => (
                <button
                  key={`${p.origin}:${p.productId}`}
                  type="button"
                  onClick={() => handleSelect(p)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-left text-sm transition-all hover:bg-accent/5 active:scale-[0.99]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/8">
                    <Package className="h-4 w-4 text-accent/50" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text">{p.name}</p>
                    <p className="text-[11px] text-muted">
                      Código: {p.code}
                      {p.origin === "migrated" && <span className="ml-1.5 text-warning">• Migrado</span>}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-heading font-semibold text-text">
                      {p.price > 0 ? formatCordobas(p.price) : "—"}
                    </p>
                    <p className="text-[11px] text-muted">{p.stock} disp.</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tip */}
        <p className="text-center text-[11px] text-muted/60">
          Presiona <kbd className="rounded bg-surface-2 px-1 py-0.5 text-[10px] font-mono">Enter</kbd> para agregar el primer resultado · Toca un producto para seleccionarlo
        </p>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Formulario principal del ticket
   ═══════════════════════════════════════════════════════════════════════════════ */
export function TicketFormModal({
  initial,
  onClose,
  onCreated,
}: {
  initial?: Invoice | null;
  onClose: () => void;
  onCreated: (invoice: Invoice) => void;
}) {
  const isEdit = !!initial;
  const [createInvoice, { isLoading: creating }] = useCreateInvoiceMutation();
  const [updateInvoice, { isLoading: updating }] = useUpdateInvoiceMutation();
  const { data: sellers = [] } = useGetTicketSellersQuery();

  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // ── Líneas de producto ──
  const [lines, setLines] = useState<Line[]>(
    () => (initial?.items || []).map((it) => ({
      productCode: it.productCode,
      productName: it.productName,
      quantity: it.quantity,
      unitPrice: priceToStr(it.unitPrice),
      catalogPrice: it.unitPrice,
      origin: it.origin || "native",
      productId: it.productId || "",
    })),
  );

  // ── Formulario general ──
  const [form, setForm] = useState({
    firstName: initial?.customer?.firstName ?? "",
    lastName: initial?.customer?.lastName ?? "",
    phone: initial?.customer?.phone ?? "",
    sellerUid: initial?.assignedSeller?.uid ?? "",
    deliveryFee: initial?.deliveryFee ? String(initial.deliveryFee) : "",
    paymentMethod: initial?.paymentMethod ?? "", // Ahora inicia vacío
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  
  const [hasDelivery, setHasDelivery] = useState(!!initial?.deliveryFee);
  const [showCustomer, setShowCustomer] = useState(
    !!initial?.customer?.firstName && initial.customer.firstName !== "Cliente General"
  );

  // ── Cálculos ──
  const subtotal = lines.reduce((s, l) => s + strToPrice(l.unitPrice) * l.quantity, 0);

  // Descuento automático: diferencia entre precio catálogo y precio ingresado.
  const autoDiscount = lines.reduce((acc, l) => {
    const price = strToPrice(l.unitPrice);
    if (price > 0 && l.catalogPrice > 0 && price < l.catalogPrice) {
      return acc + (l.catalogPrice - price) * l.quantity;
    }
    return acc;
  }, 0);

  const catalogSubtotal = lines.reduce((s, l) => {
    const price = strToPrice(l.unitPrice);
    const cat = l.catalogPrice > 0 ? l.catalogPrice : price;
    return s + cat * l.quantity;
  }, 0);

  const total = subtotal;

  // ── Acciones ──
  function handleProductSelected(p: ProductLookup) {
    setLines((ls) => {
      const existing = ls.find((l) => l.origin === p.origin && l.productId === p.productId);
      if (existing) return ls.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      return [...ls, {
        productCode: p.code,
        productName: p.name,
        quantity: 1,
        unitPrice: priceToStr(p.price),
        catalogPrice: p.price,
        origin: p.origin,
        productId: p.productId,
      }];
    });
    toast.success(`${p.name} agregado`, { duration: 1500 });
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  function changeQty(i: number, delta: number) {
    setLines((ls) => ls.map((l, idx) => {
      if (idx !== i) return l;
      return { ...l, quantity: Math.max(1, l.quantity + delta) };
    }));
  }

  async function save() {
    if (lines.length === 0) return toast.error("Agrega al menos un producto.");
    const seller = sellers.find((s) => s.uid === form.sellerUid);
    if (!seller) return toast.error("Selecciona el vendedor de la venta.");

    const emptyPrice = lines.find((l) => strToPrice(l.unitPrice) <= 0);
    if (emptyPrice) {
      return toast.error(`Ingresa el precio de "${emptyPrice.productName}".`);
    }
    if (!form.paymentMethod) return toast.error("Selecciona el método de pago.");

    const finalFirstName = (showCustomer && form.firstName.trim()) ? form.firstName.trim() : "";
    const finalLastName = showCustomer ? form.lastName.trim() : "";
    const finalPhone = showCustomer ? form.phone.trim() : "";

    const body: NewInvoice = {
      customer: { firstName: finalFirstName, lastName: finalLastName, phone: finalPhone },
      items: lines.map((l) => ({
        productCode: l.productCode,
        quantity: l.quantity,
        unitPrice: strToPrice(l.unitPrice),
        origin: l.origin,
        productId: l.productId,
      })),
      discount: autoDiscount,
      deliveryFee: form.deliveryFee === "" ? 0 : parseFloat(form.deliveryFee) || 0,
      paymentMethod: form.paymentMethod,
      assignedSeller: seller,
    };

    try {
      if (isEdit && initial) {
        await updateInvoice({ id: initial.id, body }).unwrap();
        toast.success(`Ticket ${initial.ticketNumber} actualizado. Las reservas quedaron reajustadas.`);
        onClose();
        return;
      }
      const invoice = await createInvoice(body).unwrap();
      toast.success(`Ticket ${invoice.ticketNumber} generado. El stock quedó reservado.`);
      onCreated(invoice);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo guardar el ticket.");
    }
  }

  const currentOrigin = lines[0]?.origin;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={isEdit ? `Editar ticket ${initial!.ticketNumber}` : "Nuevo ticket"}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-5">
          {/* Banner de edición */}
          {isEdit && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/8 px-4 py-3 text-sm text-warning"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>Al guardar se reajustan las reservas de stock. Recuerda reimprimir el ticket.</span>
            </motion.div>
          )}

          {/* ═══ Sección: Cliente ═══ */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionHeader icon={UserRound} label="Cliente" />
              {!showCustomer && (
                <button type="button" onClick={() => setShowCustomer(true)} className="flex items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-all hover:bg-accent/20">
                  <UserRound className="h-3.5 w-3.5" /> Proporcionar información
                </button>
              )}
            </div>
            
            <AnimatePresence>
              {showCustomer && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center justify-end mb-2">
                     <button type="button" onClick={() => setShowCustomer(false)} className="text-xs text-danger hover:text-danger">Omitir información del cliente</button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 mb-4">
                    <Field label="Nombre">
                      <input className="input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="María" autoFocus />
                    </Field>
                    <Field label="Apellido">
                      <input className="input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="García" />
                    </Field>
                    <Field label="Teléfono">
                      <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="8888-8888" />
                    </Field>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ═══ Vendedor ═══ */}
          <Field label="Vendedor de la venta *">
            <select className="input" value={form.sellerUid} onChange={(e) => set("sellerUid", e.target.value)}>
              <option value="">Selecciona un vendedor…</option>
              {sellers.map((s) => (
                <option key={s.uid} value={s.uid}>{s.name}</option>
              ))}
            </select>
          </Field>

          {/* ═══ Sección: Productos ═══ */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <SectionHeader icon={ShoppingCart} label="Productos" />
              <Button variant="outline" size="sm" onClick={() => setSearchModalOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                {lines.length === 0 ? "Agregar producto" : "Agregar otro"}
              </Button>
            </div>

            {/* Lista de productos */}
            <div className="mt-3">
              {lines.length === 0 ? (
                /* Empty state */
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 py-10 text-center"
                >
                  <div className="rounded-2xl bg-accent/8 p-4">
                    <ShoppingCart className="h-8 w-8 text-accent/40" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">Sin productos en el ticket</p>
                    <p className="mt-0.5 text-xs text-muted">
                      Toca "Agregar producto" para buscar y añadir artículos.
                    </p>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-1.5">
                  {/* Encabezados */}
                  <div className="flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    <span className="flex-1">Producto</span>
                    <span className="w-[88px] text-center">Cant.</span>
                    <span className="w-24 text-center">Precio C$</span>
                    <span className="hidden w-20 text-right sm:block">Subtotal</span>
                    <span className="w-7" />
                  </div>

                  <AnimatePresence mode="popLayout">
                    {lines.map((l, i) => {
                      const linePrice = strToPrice(l.unitPrice);
                      const lineSubtotal = linePrice * l.quantity;
                      const priceEmpty = l.unitPrice === "" || linePrice <= 0;
                      const hasLineDiscount = linePrice > 0 && l.catalogPrice > 0 && linePrice < l.catalogPrice;

                      return (
                        <motion.div
                          key={`${l.origin}:${l.productId || l.productCode}`}
                          layout
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8, transition: { duration: 0.15 } }}
                          transition={{ type: "spring", stiffness: 400, damping: 28 }}
                          className="group rounded-xl border border-border bg-bg p-2.5 transition-colors hover:border-accent/20"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <Package className="h-3.5 w-3.5 shrink-0 text-accent/40" />
                            <div className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{l.productName}</span>
                              {l.origin === "migrated" && (
                                <span className="text-[10px]"><MigratedTag /></span>
                              )}
                            </div>

                            {/* Cantidad: botones −/+ */}
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => changeQty(i, -1)}
                                disabled={l.quantity <= 1}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted transition-all hover:border-accent/30 hover:text-text disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={l.quantity}
                                onChange={(e) => updateLine(i, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                                className="input w-11 px-1 text-center tabular-nums"
                              />
                              <button
                                type="button"
                                onClick={() => changeQty(i, 1)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted transition-all hover:border-accent/30 hover:text-text"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>

                            {/* Precio */}
                            <input
                              type="number"
                              min={0}
                              value={l.unitPrice}
                              onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                              onWheel={(e) => (e.target as HTMLInputElement).blur()}
                              onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                              placeholder="Precio"
                              className={cn(
                                "input w-24 text-center tabular-nums",
                                priceEmpty && "border-danger/50 text-danger placeholder:text-danger/50",
                              )}
                            />

                            {/* Subtotal (desktop) */}
                            <span className="hidden w-20 text-right text-xs font-semibold tabular-nums text-muted sm:block">
                              {linePrice > 0 ? formatCordobas(lineSubtotal) : "—"}
                            </span>

                            {/* Eliminar */}
                            <button
                              type="button"
                              onClick={() => removeLine(i)}
                              className="rounded-lg p-1 text-muted opacity-50 transition-all hover:bg-danger/10 hover:text-danger hover:opacity-100 group-hover:opacity-80"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Indicador de descuento por línea */}
                          {hasLineDiscount && (
                            <div className="mt-1.5 flex items-center gap-1 pl-6 text-[11px] text-accent-2">
                              <Tag className="h-2.5 w-2.5" />
                              <span>
                                Descuento: −{formatCordobas((l.catalogPrice - linePrice) * l.quantity)}
                              </span>
                              <span className="text-muted/50 line-through">
                                {formatCordobas(l.catalogPrice)}/u
                              </span>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Botón agregar otro (dentro de la lista) */}
                  <button
                    type="button"
                    onClick={() => setSearchModalOpen(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/60 py-2.5 text-xs font-medium text-muted transition-all hover:border-accent/30 hover:text-accent-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar otro artículo
                  </button>
                </div>
              )}
            </div>

            {/* Descuento automático calculado */}
            <AnimatePresence>
              {autoDiscount > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
                    <Tag className="h-4 w-4 shrink-0 text-accent-2" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-accent-2">
                        Descuento aplicado
                      </p>
                      <p className="text-[11px] text-muted">
                        Calculado por diferencia con el precio de catálogo.
                      </p>
                    </div>
                    <span className="shrink-0 font-heading text-lg font-bold tabular-nums text-accent-2">
                      −{formatCordobas(autoDiscount)}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ═══ Sección: Pago ═══ */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <SectionHeader icon={CreditCard} label="Pago" />
              {!hasDelivery && (
                <button type="button" onClick={() => setHasDelivery(true)} className="flex items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-all hover:bg-accent/20">
                  <Truck className="h-3.5 w-3.5" /> Agregar Delivery
                </button>
              )}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Método de pago *">
                <select className="input" value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
                  <option value="" disabled>Selecciona método…</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Tarjeta">Tarjeta</option>
                </select>
              </Field>
              <AnimatePresence>
                {hasDelivery && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted">Delivery (C$)</span>
                      <button type="button" onClick={() => { setHasDelivery(false); set("deliveryFee", ""); }} className="text-xs text-danger hover:text-danger">Quitar</button>
                    </div>
                    <div className="relative">
                      <Truck className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted/50" />
                      <input type="number" min={0} className="input pl-8" placeholder="Costo de envío" value={form.deliveryFee} onChange={(e) => set("deliveryFee", e.target.value)} autoFocus />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ═══ Footer: Resumen financiero + acciones ═══ */}
          <div className="border-t border-border pt-5">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0 space-y-1">
                {autoDiscount > 0 && (
                  <div className="flex items-baseline gap-3 text-sm">
                    <span className="w-20 text-xs text-muted">Subtotal</span>
                    <span className="tabular-nums text-muted line-through">{formatCordobas(catalogSubtotal)}</span>
                  </div>
                )}
                {autoDiscount > 0 && (
                  <div className="flex items-baseline gap-3 text-sm">
                    <span className="w-20 text-xs text-muted">Descuento</span>
                    <span className="tabular-nums text-accent-2">−{formatCordobas(autoDiscount)}</span>
                  </div>
                )}
                {(form.deliveryFee !== "" && parseFloat(form.deliveryFee) > 0) && (
                  <div className="flex items-baseline gap-3 text-sm">
                    <span className="w-20 text-xs text-muted">Delivery</span>
                    <span className="tabular-nums text-muted">
                      +{formatCordobas(parseFloat(form.deliveryFee))}
                      <span className="ml-1 text-[10px] text-muted/60">(no entra a la venta)</span>
                    </span>
                  </div>
                )}
                <div className="flex items-baseline gap-3 pt-1">
                  <span className="w-20 text-xs font-medium uppercase tracking-wide text-muted">Total</span>
                  <p className="font-heading text-3xl font-bold tabular-nums text-text">
                    {formatCordobas(total)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
                <Button size="sm" onClick={save} loading={creating || updating} disabled={lines.length === 0}>
                  {isEdit ? "Guardar cambios" : "Generar ticket"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Mini-modal de búsqueda */}
      <ProductSearchModal
        open={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSelect={handleProductSelected}
        currentOrigin={currentOrigin}
      />
    </>
  );
}

/* ── Helpers internos ── */

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-accent-2" />
      <p className="text-xs font-semibold uppercase tracking-wide text-text">{label}</p>
    </div>
  );
}
