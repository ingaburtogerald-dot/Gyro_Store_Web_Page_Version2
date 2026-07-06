// Ticket térmico POS 80mm imprimible.
// Diseño profesional con logo line-art centrado, jerarquía tipográfica clara,
// separadores elegantes, sección de totales destacada, código QR y políticas.
// TODO el texto es negro puro — las impresoras térmicas no reproducen grises.
import { forwardRef } from "react";
import type { Invoice } from "~/store/api/invoicesApi";

const c$ = (n: number) => `C$${Math.round(n).toLocaleString("es-NI")}`;

export const Ticket = forwardRef<HTMLDivElement, { invoice: Invoice }>(function Ticket(
  { invoice },
  ref,
) {
  const date = invoice.createdAt ? new Date(invoice.createdAt) : new Date();
  const hasDelivery = (invoice.deliveryFee || 0) > 0;
  const grandTotal = invoice.total + (invoice.deliveryFee || 0);

  return (
    <div
      ref={ref}
      style={{ width: "80mm", fontFamily: "'Segoe UI', Arial, sans-serif", color: "#000" }}
      className="mx-auto bg-white px-4 py-5 text-[13px] leading-snug text-black"
    >
      {/* ═══════════════════════════════════════════
          CABECERA: Logo centrado + info de contacto
          ═══════════════════════════════════════════ */}
      <div className="mb-4 text-center">
        {/* Contenedor recortado: oculta el texto "GYRO STORE" del fondo del PNG */}
        <div className="mx-auto mb-1 h-20 w-28 overflow-hidden">
          <img
            src="/logo-ticket.png"
            alt="Gyro Store"
            className="h-28 w-full object-cover object-top"
          />
        </div>
        <p className="text-[18px] font-black uppercase tracking-widest">GYRO STORE</p>
        <p className="mt-1 text-[11px] tracking-wide text-black">
          Tu tienda de tecnología &amp; accesorios
        </p>
        <Separator />
        <p className="mt-1.5 text-[11px] text-black">
          Conchita Palacios 2c al lago 1c arriba · Managua
        </p>
        <p className="text-[11px] text-black">
          WhatsApp: +505 8594-4758
        </p>
      </div>

      <DashedSep />

      {/* ═══════════════════════════════════════════
          DATOS DEL TICKET
          ═══════════════════════════════════════════ */}
      <div className="mb-1 space-y-0.5 text-[12px]">
        <Row label="TICKET Nº" value={`#${invoice.ticketNumber}`} bold />
        <Row
          label="FECHA"
          value={`${date.toLocaleDateString("es-NI")} — ${date.toLocaleTimeString("es-NI", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })}`}
        />
      </div>

      {/* Cliente y Vendedor */}
      {(invoice.customer?.firstName || invoice.assignedSeller?.name || invoice.sellerName) && (
        <div className="mb-1 mt-1.5 space-y-0.5 text-[12px]">
          {invoice.customer?.firstName && (
            <Row
              label="Cliente"
              value={`${invoice.customer.firstName} ${invoice.customer.lastName || ""}`.trim()}
              bold
            />
          )}
          {invoice.customer?.phone && (
            <Row label="Tel" value={invoice.customer.phone} />
          )}
          {(invoice.assignedSeller?.name || invoice.sellerName) && (
            <Row
              label="Vendedor"
              value={invoice.assignedSeller?.name || invoice.sellerName}
            />
          )}
        </div>
      )}

      <DashedSep />

      {/* ═══════════════════════════════════════════
          DETALLE DE PRODUCTOS
          ═══════════════════════════════════════════ */}
      <div className="space-y-0">
        {invoice.items.map((l, i) => (
          <div key={i} className="border-b border-dotted border-black/40 py-2.5">
            {/* Nombre del producto a ancho completo */}
            <p className="text-[13px] font-bold leading-tight">{l.productName}</p>
            {/* Detalles: Cant · Precio unitario → Total alineado a la derecha */}
            <div className="mt-1.5 flex items-center justify-between text-[11px]">
              <span className="pl-1">
                Cantidad: {l.quantity} &nbsp;·&nbsp; Precio: {c$(l.unitPrice)}
              </span>
              <span className="text-[13px] font-black">{c$(l.lineTotal)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════
          RESUMEN FINANCIERO
          ═══════════════════════════════════════════ */}
      <div className="mt-3 space-y-1 text-[12px]">
        <Row label="Subtotal" value={c$(invoice.subtotal)} />
        {invoice.discount > 0 && (
          <Row label="Descuento" value={`-${c$(invoice.discount)}`} />
        )}
        {hasDelivery && (
          <Row label="Delivery" value={c$(invoice.deliveryFee || 0)} />
        )}
      </div>

      {/* ── TOTAL DESTACADO ── */}
      <div
        className="mt-3 flex items-center justify-between rounded-sm px-3 py-2.5"
        style={{ backgroundColor: "#000", color: "#fff" }}
      >
        <span className="text-[13px] font-extrabold tracking-[0.12em]">TOTAL A PAGAR</span>
        <span className="text-[18px] font-black">{c$(grandTotal)}</span>
      </div>

      {/* Método de pago */}
      <p className="mt-2 text-right text-[11px] font-bold uppercase tracking-wide">
        Pago: {invoice.paymentMethod}
      </p>

      <DashedSep />

      {/* ═══════════════════════════════════════════
          DESPEDIDA + QR
          ═══════════════════════════════════════════ */}
      <div className="text-center">
        <p className="text-[14px] font-black tracking-wide">¡GRACIAS POR TU COMPRA!</p>
        <p className="mt-1 text-[11px]">Visita nuestra tienda en línea</p>

        {/* QR dinámico */}
        <div className="my-3 flex justify-center">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
              "https://gyro-store.onrender.com/",
            )}`}
            alt="QR Tienda Online"
            className="h-[80px] w-[80px]"
          />
        </div>
        <p className="text-[11px] font-bold">gyro-store.onrender.com</p>
        <p className="mt-0.5 text-[10px]">Instagram: @gyrostore</p>
      </div>

      <Separator />

      {/* ═══════════════════════════════════════════
          POLÍTICAS DE GARANTÍA
          ═══════════════════════════════════════════ */}
      <div className="mt-2 px-0.5 text-[9px] leading-[1.25]">
        <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wider">
          Políticas de Garantía
        </p>
        <p>1. Presentar este ticket es obligatorio para reclamos.</p>
        <p>2. Válida solo por defectos de fábrica (evaluación 48-72h).</p>
        <p>3. Anulada por daños físicos, golpes, humedad o mal uso.</p>
        <p>4. Artículos deben devolverse con cajas y accesorios originales.</p>
      </div>

      {/* ── Corte final ── */}
      <div className="mt-4 text-center text-[8px] tracking-[0.3em] text-black">
        {"· ".repeat(22)}
      </div>
    </div>
  );
});

/* ── Componentes internos ── */

/** Separador punteado */
function DashedSep() {
  return <div className="my-3 border-b-[1.5px] border-dashed border-black" />;
}

/** Separador sólido fino */
function Separator() {
  return <div className="mx-auto my-2 h-[1px] w-full bg-black/30" />;
}

/** Fila clave:valor */
function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between text-black">
      <span>{label}:</span>
      <span className={bold ? "font-bold" : ""}>{value}</span>
    </div>
  );
}
