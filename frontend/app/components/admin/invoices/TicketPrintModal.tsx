// Modal de vista previa e impresión térmica de un ticket (80mm, react-to-print).
// Se usa al generar un ticket nuevo y para reimprimir desde el historial.
// Incluye botón de descarga como imagen PNG (html2canvas-pro).
import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useReactToPrint } from "react-to-print";
import { Printer, Eye, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { Ticket } from "./Ticket";
import type { Invoice } from "~/store/api/invoicesApi";

export function TicketPrintModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const ticketRef = useRef<HTMLDivElement>(null);
  // `@page { margin: 0 }` elimina el margen de impresión que el navegador añade
  // por defecto ENCIMA del margen físico de la impresora térmica: ese doble
  // margen es lo que desperdiciaba papel arriba. El rollo define el ancho 80mm;
  // la altura es automática (recibo continuo).
  const handlePrint = useReactToPrint({
    contentRef: ticketRef,
    documentTitle: invoice.ticketNumber,
    // `@page { margin: 0 }` elimina el doble margen del navegador. `print-color-adjust:
    // exact` OBLIGA a imprimir fondos/colores (sin esto la franja negra del TOTAL
    // desaparece y su texto blanco queda invisible). `break-inside: avoid` evita que
    // los bloques se partan, y el padding inferior deja avance para que la cuchilla
    // no corte las últimas líneas.
    pageStyle: `
      @page { size: 80mm auto; margin: 0; }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `,
  });
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!ticketRef.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(ticketRef.current, {
        scale: 3, // Alta resolución para que se vea nítido
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `ticket-${invoice.ticketNumber}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Imagen descargada correctamente.");
    } catch {
      toast.error("No se pudo generar la imagen del ticket.");
    } finally {
      setDownloading(false);
    }
  }, [invoice.ticketNumber]);

  return (
    <Modal open onClose={onClose} title={`Ticket ${invoice.ticketNumber}`} maxWidth="max-w-sm">
      <div className="space-y-5">
        {/* Label de vista previa */}
        <div className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted">
          <Eye className="h-3.5 w-3.5" />
          Vista previa
        </div>

        {/* Preview container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="max-h-[55vh] overflow-y-auto rounded-2xl border border-border bg-white shadow-[0_8px_40px_rgba(0,0,0,0.4)] custom-scrollbar"
        >
          <Ticket ref={ticketRef} invoice={invoice} />
        </motion.div>

        {/* Acciones */}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>
    </Modal>
  );
}
