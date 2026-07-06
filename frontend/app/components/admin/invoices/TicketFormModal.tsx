// Modal para generar o editar un ticket de facturación. Al crear, el servidor
// RESERVA el stock FIFO; al editar (solo pendientes) reajusta las reservas.
// El precio se autocompleta desde el catálogo y es negociable; el delivery es
// solo informativo (se imprime pero no entra al total de la venta).
// Versión premium: secciones icónicas, mini-cards de producto, footer con
// tipografía destacada.
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
  unitPrice: number;
  origin: ProductOrigin;
  productId: string;
}

/** Píldora "Migrado" (mismo lenguaje visual que el editor de ventas). */
function MigratedTag() {
  return (
    <span className="shrink-0 rounded-pill bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
      Migrado
    </span>
  );
}

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

  // Buscador de productos con sugerencias en vivo (por código o nombre, con debounce).
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);
  const { data: results = [], isFetching: searching } = useSearchProductsQuery(debouncedQuery, {
    skip: debouncedQuery.length < 2,
  });
  // Solo se ofrecen productos con stock: un ticket reserva stock, así que los
  // agotados no deben aparecer como opción (antes salían deshabilitados).
  const inStock = results.filter((p) => (p.stock || 0) > 0);
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const [lines, setLines] = useState<Line[]>(
    () => (initial?.items || []).map((it) => ({
      productCode: it.productCode,
      productName: it.productName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      origin: it.origin || "native",
      productId: it.productId || "",
    })),
  );
  const [form, setForm] = useState({
    firstName: initial?.customer?.firstName ?? "",
    lastName: initial?.customer?.lastName ?? "",
    phone: initial?.customer?.phone ?? "",
    sellerUid: initial?.assignedSeller?.uid ?? "",
    deliveryFee: initial?.deliveryFee ? String(initial.deliveryFee) : "",
    paymentMethod: initial?.paymentMethod ?? "Efectivo",
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const total = subtotal;

  function addProduct(p: ProductLookup) {
    // Regla de No-Mezcla: un ticket es 100% nativo o 100% migrado (sus reservas
    // viven en colecciones distintas). Se valida también en el backend.
    const currentOrigin = lines[0]?.origin;
    if (currentOrigin && currentOrigin !== p.origin) {
      toast.error("Un ticket no puede mezclar inventario actual y migrado. Emite tickets por separado.");
      return;
    }
    setLines((ls) => {
      // Dedupe por identidad real (origen + doc id): un código migrado y uno
      // nativo podrían coincidir, pero son productos distintos.
      const existing = ls.find((l) => l.origin === p.origin && l.productId === p.productId);
      if (existing) return ls.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      return [...ls, {
        productCode: p.code,
        productName: p.name,
        quantity: 1,
        unitPrice: p.price,
        origin: p.origin,
        productId: p.productId,
      }];
    });
    setQuery("");
    setDebouncedQuery("");
    setDropdownOpen(false);
  }

  function update(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function save() {
    if (lines.length === 0) return toast.error("Agrega al menos un producto.");
    if (!form.firstName.trim()) return toast.error("Escribe el nombre del cliente.");
    const seller = sellers.find((s) => s.uid === form.sellerUid);
    if (!seller) return toast.error("Selecciona el vendedor de la venta.");

    const body: NewInvoice = {
      customer: { firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim() },
      items: lines.map((l) => ({
        productCode: l.productCode,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        origin: l.origin,
        productId: l.productId,
      })),
      discount: 0,
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

  return (
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
            className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-300"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>Al guardar se reajustan las reservas de stock. Recuerda reimprimir el ticket.</span>
          </motion.div>
        )}

        {/* ═══ Sección: Cliente ═══ */}
        <SectionHeader icon={UserRound} label="Cliente" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nombre *">
            <input className="input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="María" />
          </Field>
          <Field label="Apellido">
            <input className="input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="García" />
          </Field>
          <Field label="Teléfono">
            <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="8888-8888" />
          </Field>
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
        <div className="space-y-3 border-t border-border pt-4">
          <SectionHeader icon={ShoppingCart} label="Productos" />

          {/* Buscador */}
          <div className="relative" ref={searchWrapRef}>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 transition-colors focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20">
              <Search className={cn("h-4 w-4 shrink-0 transition-colors", searching ? "animate-pulse text-accent" : "text-muted")} />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setDropdownOpen(true); }}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={(e) => {
                  // Enter agrega la primera sugerencia con stock (flujo rápido de la cajera).
                  if (e.key === "Enter" && inStock.length > 0) addProduct(inStock[0]);
                  if (e.key === "Escape") setDropdownOpen(false);
                }}
                placeholder="Busca por código o nombre…"
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted"
              />
            </div>

            {/* Sugerencias en vivo */}
            <AnimatePresence>
              {dropdownOpen && debouncedQuery.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 z-50 mt-1.5 w-full overflow-hidden rounded-card border border-border bg-surface-2 p-1 shadow-2xl"
                >
                  {inStock.length === 0 && !searching ? (
                    <p className="px-3 py-3 text-center text-sm text-muted">
                      {results.length > 0
                        ? `Sin stock disponible para “${debouncedQuery}”`
                        : `Sin resultados para “${debouncedQuery}”`}
                    </p>
                  ) : (
                    inStock.map((p) => (
                      <button
                        key={`${p.origin}:${p.productId}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addProduct(p)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-all hover:translate-x-0.5 hover:bg-accent/5"
                      >
                        <Package className="h-3.5 w-3.5 shrink-0 text-muted/50" />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        {p.origin === "migrated" && <MigratedTag />}
                        <span className="rounded-md bg-bg px-2 py-0.5 text-[11px] font-mono text-muted">
                          {p.code}
                        </span>
                        <span className="w-20 text-right font-heading font-semibold text-text">
                          {formatCordobas(p.price)}
                        </span>
                        <span className="w-16 text-right text-[11px] text-muted">
                          {p.stock} disp.
                        </span>
                      </button>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Líneas de producto */}
          {lines.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Package className="h-8 w-8 text-muted/30" />
              <p className="text-sm text-muted">
                Busca por código o nombre y toca una sugerencia para agregarla.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Encabezados */}
              <div className="flex items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <span className="flex-1">Producto</span>
                <span className="w-16 text-center">Cant.</span>
                <span className="w-24 text-center">Precio C$</span>
                <span className="w-5" />
              </div>

              <AnimatePresence mode="popLayout">
                {lines.map((l, i) => (
                  <motion.div
                    key={`${l.origin}:${l.productId || l.productCode}`}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8, transition: { duration: 0.15 } }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    className="group flex items-center gap-2 rounded-xl border border-border bg-bg p-2.5 text-sm transition-colors hover:border-accent/20"
                  >
                    <Package className="h-3.5 w-3.5 shrink-0 text-accent/40" />
                    <span className="min-w-0 flex-1 truncate font-medium">{l.productName}</span>
                    {l.origin === "migrated" && <MigratedTag />}
                    <input
                      type="number"
                      min={1}
                      value={l.quantity}
                      onChange={(e) => update(i, { quantity: parseInt(e.target.value) || 1 })}
                      className="input w-16 text-center"
                    />
                    <input
                      type="number"
                      min={0}
                      value={l.unitPrice}
                      onChange={(e) => update(i, { unitPrice: parseFloat(e.target.value) || 0 })}
                      className="input w-24 text-center"
                    />
                    <button
                      onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                      className="rounded-lg p-1 text-muted opacity-50 transition-all hover:bg-rose-500/10 hover:text-rose-400 hover:opacity-100 group-hover:opacity-80"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ═══ Sección: Pago ═══ */}
        <div className="border-t border-border pt-4">
          <SectionHeader icon={CreditCard} label="Pago" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Método de pago">
              <select className="input" value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
                <option>Efectivo</option>
                <option>Transferencia</option>
                <option>Tarjeta</option>
              </select>
            </Field>
            <Field label="Delivery (C$) — informativo">
              <div className="relative">
                <Truck className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted/50" />
                <input type="number" min={0} className="input pl-8" placeholder="0" value={form.deliveryFee} onChange={(e) => set("deliveryFee", e.target.value)} />
              </div>
            </Field>
          </div>
        </div>

        {/* ═══ Footer: Total + acciones ═══ */}
        <div className="flex items-center justify-between border-t border-border pt-5">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Total</span>
            <p className="font-heading text-3xl font-bold tabular-nums text-text">
              {formatCordobas(total)}
            </p>
            {(form.deliveryFee !== "" && parseFloat(form.deliveryFee) > 0) && (
              <p className="mt-0.5 text-xs text-muted">
                + {formatCordobas(parseFloat(form.deliveryFee))} de delivery (no entra a la venta)
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={save} loading={creating || updating} disabled={lines.length === 0}>
              {isEdit ? "Guardar cambios" : "Generar ticket"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ── Helpers internos ── */

// Encabezado de sección: ícono + etiqueta. Sin borde-franja lateral (patrón
// baneado); el ícono en acento y la mayúscula ya establecen la jerarquía.
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-accent-2" />
      <p className="text-xs font-semibold uppercase tracking-wide text-text">{label}</p>
    </div>
  );
}
