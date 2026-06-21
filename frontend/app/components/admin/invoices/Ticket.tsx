// Ticket térmico POS 80mm imprimible. Se renderiza en blanco/negro monoespaciado
// (independiente del tema oscuro) y se envía a la impresora vía react-to-print.
import { forwardRef } from "react";
import type { Invoice } from "~/store/api/invoicesApi";

const c$ = (n: number) => `C$${Math.round(n).toLocaleString("es-NI")}`;

export const Ticket = forwardRef<HTMLDivElement, { invoice: Invoice }>(function Ticket(
  { invoice },
  ref,
) {
  const date = invoice.createdAt ? new Date(invoice.createdAt) : new Date();

  return (
    <div
      ref={ref}
      style={{ width: "80mm" }}
      className="mx-auto bg-white p-3 font-mono text-[11px] leading-tight text-black"
    >
      <div className="text-center">
        <p className="text-base font-bold tracking-wide">GYRO STORE</p>
        <p>Managua, Nicaragua</p>
      </div>
      <Sep />
      <div className="flex justify-between">
        <span>{date.toLocaleDateString("es-NI")}</span>
        <span>{date.toLocaleTimeString("es-NI", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <p>Ticket #: {invoice.ticketNumber}</p>
      <Sep />

      <div className="flex justify-between font-bold">
        <span className="flex-1">Producto</span>
        <span className="w-8 text-right">Cant</span>
        <span className="w-16 text-right">Precio</span>
      </div>
      {invoice.items.map((l, i) => (
        <div key={i} className="flex justify-between">
          <span className="flex-1 truncate pr-1">{l.productName}</span>
          <span className="w-8 text-right">{l.quantity}</span>
          <span className="w-16 text-right">{c$(l.lineTotal)}</span>
        </div>
      ))}
      <Sep />

      <Row label="Subtotal:" value={c$(invoice.subtotal)} />
      <Row label="Descuento:" value={c$(invoice.discount)} />
      <Row label="TOTAL:" value={c$(invoice.total)} bold />
      <Sep />

      <p>Método: {invoice.paymentMethod}</p>
      <p>Atendido por: {invoice.sellerName}</p>
      <Sep />
      <div className="text-center">
        <p>¡Gracias por su compra!</p>
        <p>Instagram: @gyrostore</p>
      </div>
    </div>
  );
});

function Sep() {
  return <p className="my-1 overflow-hidden whitespace-nowrap">{"=".repeat(42)}</p>;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
