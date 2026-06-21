// Generar ticket: buscar producto por código, armar líneas, calcular total,
// crear la factura e imprimir en la impresora térmica (react-to-print).
import { useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { Search, Trash2, Printer, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { Ticket } from "./Ticket";
import {
  useLazyLookupProductQuery,
  useCreateInvoiceMutation,
  type Invoice,
} from "~/store/api/invoicesApi";
import { formatCordobas } from "~/lib/utils";

interface Line {
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export function TicketBuilder() {
  const [lookup] = useLazyLookupProductQuery();
  const [createInvoice, { isLoading }] = useCreateInvoiceMutation();

  const [code, setCode] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [created, setCreated] = useState<Invoice | null>(null);

  const ticketRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: ticketRef, documentTitle: created?.ticketNumber });

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  async function addByCode() {
    if (!code.trim()) return;
    try {
      const p = await lookup(code.trim()).unwrap();
      setLines((ls) => {
        const existing = ls.find((l) => l.productCode === p.code);
        if (existing) return ls.map((l) => (l.productCode === p.code ? { ...l, quantity: l.quantity + 1 } : l));
        return [...ls, { productCode: p.code, productName: p.name, quantity: 1, unitPrice: p.price }];
      });
      setCode("");
    } catch (err: any) {
      toast.error(err?.data?.error || "Producto no encontrado.");
    }
  }

  function update(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function generate() {
    if (lines.length === 0) return toast.error("Agrega al menos un producto.");
    try {
      const invoice = await createInvoice({ items: lines, discount, paymentMethod }).unwrap();
      setCreated(invoice);
      setLines([]);
      setDiscount(0);
      toast.success(`Ticket ${invoice.ticketNumber} generado.`);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo generar el ticket.");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3 rounded-card border border-border bg-surface p-4">
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-pill border border-border bg-bg px-3">
            <Search className="h-4 w-4 text-muted" />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addByCode()}
              placeholder="Código del producto…"
              className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted"
            />
          </div>
          <Button onClick={addByCode}>
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        </div>

        {lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Busca productos por código para agregarlos.</p>
        ) : (
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={l.productCode} className="flex items-center gap-2 rounded-xl border border-border bg-bg p-2 text-sm">
                <span className="flex-1 truncate">{l.productName}</span>
                <input
                  type="number"
                  min={1}
                  value={l.quantity}
                  onChange={(e) => update(i, { quantity: parseInt(e.target.value) || 1 })}
                  className="input w-16"
                />
                <input
                  type="number"
                  min={0}
                  value={l.unitPrice}
                  onChange={(e) => update(i, { unitPrice: parseFloat(e.target.value) || 0 })}
                  className="input w-24"
                />
                <button onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="text-muted hover:text-red-400">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Método de pago</span>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option>Efectivo</option>
              <option>Transferencia</option>
              <option>Tarjeta</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Descuento (C$)</span>
            <input type="number" min={0} className="input" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} />
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-muted">Total</span>
          <span className="font-heading text-xl font-bold">{formatCordobas(total)}</span>
        </div>
        <Button className="w-full" onClick={generate} loading={isLoading} disabled={lines.length === 0}>
          Generar ticket
        </Button>
      </div>

      {/* Vista previa / impresión */}
      <div className="space-y-3">
        {created ? (
          <>
            <div className="overflow-hidden rounded-card border border-border">
              <Ticket ref={ticketRef} invoice={created} />
            </div>
            <Button variant="outline" className="w-full" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Imprimir ticket
            </Button>
          </>
        ) : (
          <div className="rounded-card border border-dashed border-border p-8 text-center text-sm text-muted">
            El ticket generado aparecerá aquí para imprimir.
          </div>
        )}
      </div>
    </div>
  );
}
