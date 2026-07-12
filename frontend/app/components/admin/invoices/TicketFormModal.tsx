import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserRound,
  Truck,
  CreditCard,
  AlertTriangle,
  ShoppingCart,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import {
  useCreateInvoiceMutation,
  useUpdateInvoiceMutation,
  useGetTicketSellersQuery,
  type Invoice,
  type NewInvoice,
} from "~/store/api/invoicesApi";
import { useGetSellableProductsQuery } from "~/store/api/salesApi";
import { OrderLineItemsTable, type OrderLine } from "../sales/OrderLineItemsTable";
import { useOrderCalculator } from "~/hooks/useOrderCalculator";
import { formatCordobas } from "~/lib/utils";

const strToPrice = (s: string | number) => {
  if (typeof s === "number") return s;
  const n = parseFloat(s);
  return Number.isNaN(n) || n < 0 ? 0 : n;
};

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
  const { data: products = [] } = useGetSellableProductsQuery();

  // Re-build available products including original stock if editing
  const productsForUi = useMemo(() => {
    if (!initial) return products;
    const byId = new Map(products.map((p) => [p.id, { ...p }]));
    for (const it of initial.items || []) {
      if (!it.productId) continue;
      const ex = byId.get(it.productId);
      if (ex) ex.stock += it.quantity || 0;
      else byId.set(it.productId, { 
        id: it.productId, 
        code: it.productCode, 
        name: it.productName, 
        price: it.unitPrice, 
        stock: it.quantity || 0, 
        origin: it.origin || "native" 
      });
    }
    return Array.from(byId.values());
  }, [products, initial]);

  // ── Líneas de producto ──
  const [lines, setLines] = useState<OrderLine[]>(
    () => (initial?.items || []).map((it) => ({
      uid: crypto.randomUUID(),
      productId: it.productId || "",
      quantity: it.quantity,
      salePrice: it.unitPrice || "",
    })),
  );

  const newLine = (): OrderLine => ({ uid: crypto.randomUUID(), productId: "", quantity: 1, salePrice: "" });

  // ── Formulario general ──
  const [form, setForm] = useState({
    firstName: initial?.customer?.firstName ?? "",
    lastName: initial?.customer?.lastName ?? "",
    phone: initial?.customer?.phone ?? "",
    sellerUid: initial?.assignedSeller?.uid ?? "",
    deliveryFee: initial?.deliveryFee ? String(initial.deliveryFee) : "",
    paymentMethod: initial?.paymentMethod ?? "",
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  
  const [hasDelivery, setHasDelivery] = useState(!!initial?.deliveryFee);
  const [showCustomer, setShowCustomer] = useState(
    !!initial?.customer?.firstName && initial.customer.firstName !== "Cliente General"
  );

  // Map to format that useOrderCalculator expects
  const calculatorLines = lines.map(l => {
    const p = productsForUi.find(pr => pr.id === l.productId);
    return {
      quantity: l.quantity,
      unitPrice: l.salePrice, // using salePrice as the user input field
      catalogPrice: p?.price || 0
    };
  });

  const { subtotal, autoDiscount, catalogSubtotal, total } = useOrderCalculator(calculatorLines);

  async function save() {
    const validLines = lines.filter(l => l.productId && l.quantity !== "" && l.salePrice !== "");
    if (validLines.length === 0) return toast.error("Agrega al menos un producto válido.");
    
    // Regla de No-Mezcla
    const origins = new Set(validLines.map(l => productsForUi.find(p => p.id === l.productId)?.origin || "native"));
    if (origins.size > 1) {
      return toast.error("Un ticket no puede mezclar inventario actual y migrado.");
    }

    const seller = sellers.find((s) => s.uid === form.sellerUid);
    if (!seller) return toast.error("Selecciona el vendedor de la venta.");

    const emptyPrice = validLines.find((l) => strToPrice(l.salePrice) <= 0);
    if (emptyPrice) {
      const p = productsForUi.find(pr => pr.id === emptyPrice.productId);
      return toast.error(`Ingresa el precio de "${p?.name || 'producto'}".`);
    }
    if (!form.paymentMethod) return toast.error("Selecciona el método de pago.");

    const finalFirstName = (showCustomer && form.firstName.trim()) ? form.firstName.trim() : "";
    const finalLastName = showCustomer ? form.lastName.trim() : "";
    const finalPhone = showCustomer ? form.phone.trim() : "";

    const body: NewInvoice = {
      customer: { firstName: finalFirstName, lastName: finalLastName, phone: finalPhone },
      items: validLines.map((l) => {
        const p = productsForUi.find(pr => pr.id === l.productId);
        return {
          productCode: p?.code || "",
          quantity: Number(l.quantity) || 1,
          unitPrice: strToPrice(l.salePrice),
          origin: p?.origin as "native" | "migrated",
          productId: l.productId,
        };
      }),
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

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Editar ticket ${initial!.ticketNumber}` : "Nuevo ticket"}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
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

        <Field label="Vendedor de la venta *">
          <select className="input" value={form.sellerUid} onChange={(e) => set("sellerUid", e.target.value)}>
            <option value="">Selecciona un vendedor…</option>
            {sellers.map((s) => (
              <option key={s.uid} value={s.uid}>{s.name}</option>
            ))}
          </select>
        </Field>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <SectionHeader icon={ShoppingCart} label="Productos" />
          </div>

          <div className="mt-3">
            {lines.length === 0 ? (
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
                  <Button variant="outline" size="sm" onClick={() => setLines([newLine()])} className="mt-4">
                    Agregar producto
                  </Button>
                </div>
              </motion.div>
            ) : (
              <OrderLineItemsTable
                lines={lines as any}
                products={productsForUi}
                isTicket={true}
                onChange={(newLines) => setLines(newLines as any)}
                onAddLine={() => setLines((ls) => [...ls, newLine()])}
              />
            )}
          </div>

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
                    <input type="number" min={0} className="input pl-8" placeholder="Costo de envío" value={form.deliveryFee} onChange={(e) => set("deliveryFee", e.target.value)} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

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
  );
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-accent-2" />
      <p className="text-xs font-semibold uppercase tracking-wide text-text">{label}</p>
    </div>
  );
}
