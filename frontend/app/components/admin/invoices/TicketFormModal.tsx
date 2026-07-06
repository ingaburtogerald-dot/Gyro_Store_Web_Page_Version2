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
} from "~/store/api/invoicesApi";
import { formatCordobas, cn } from "~/lib/utils";

interface Line {
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
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
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const [lines, setLines] = useState<Line[]>(
    () => (initial?.items || []).map((it) => ({
      productCode: it.productCode, productName: it.productName, quantity: it.quantity, unitPrice: it.unitPrice,
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
    setLines((ls) => {
      const existing = ls.find((l) => l.productCode === p.code);
      if (existing) return ls.map((l) => (l.productCode === p.code ? { ...l, quantity: l.quantity + 1 } : l));
      return [...ls, { productCode: p.code, productName: p.name, quantity: 1, unitPrice: p.price }];
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
      items: lines.map((l) => ({ productCode: l.productCode, quantity: l.quantity, unitPrice: l.unitPrice })),
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
                  // Enter agrega la primera sugerencia (flujo rápido de la cajera).
                  if (e.key === "Enter" && results.length > 0) addProduct(results[0]);
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
                  {results.length === 0 && !searching ? (
                    <p className="px-3 py-3 text-center text-sm text-muted">
                      Sin resultados para &ldquo;{debouncedQuery}&rdquo;
                    </p>
                  ) : (
                    results.map((p) => {
                      const out = (p.stock || 0) <= 0;
                      return (
                        <button
                          key={p.code}
                          type="button"
                          disabled={out}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addProduct(p)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-all",
                            out
                              ? "cursor-not-allowed opacity-40"
                              : "hover:bg-accent/5 hover:translate-x-0.5",
                          )}
                        >
                          <Package className="h-3.5 w-3.5 shrink-0 text-muted/50" />
                          <span className="flex-1 truncate">{p.name}</span>
                          <span className="rounded-md bg-bg px-2 py-0.5 text-[11px] font-mono text-muted">
                            {p.code}
                          </span>
                          <span className="w-20 text-right font-heading font-semibold text-text">
                            {formatCordobas(p.price)}
                          </span>
                          <span
                            className={cn(
                              "w-16 text-right text-[11px]",
                              out ? "text-rose-400" : "text-muted",
                            )}
                          >
                            {out ? "sin stock" : `${p.stock} disp.`}
                          </span>
                        </button>
                      );
                    })
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
                    key={l.productCode}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8, transition: { duration: 0.15 } }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    className="group flex items-center gap-2 rounded-xl border border-border bg-bg p-2.5 text-sm transition-colors hover:border-accent/20"
                  >
                    <Package className="h-3.5 w-3.5 shrink-0 text-accent/40" />
                    <span className="flex-1 truncate font-medium">{l.productName}</span>
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
            <p className="gradient-text font-heading text-3xl font-bold">
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

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="section-accent-border flex items-center gap-2">
      <Icon className="h-4 w-4 text-accent/70" />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
