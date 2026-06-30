// Modales de aviso (sin formulario): mezcla de vendedores y éxito de pago.
// Presentacionales puros. Extraídos del God component.
import { Check, AlertTriangle } from "lucide-react";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import type { ApprovePaySuccess } from "~/hooks/sales/useAdminSaleActions";

/** Bloqueo cuando se intentan aprobar+pagar ventas de vendedores distintos. */
export function MixedSellerModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Atención" maxWidth="max-w-md">
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <div>
          <p className="text-lg font-bold text-text">Estás mezclando ventas</p>
          <p className="mt-2 text-sm text-muted">
            Has seleccionado ventas de dos o más vendedores distintos. Para aprobar y registrar el pago,{" "}
            <strong className="text-rose-400">selecciona ventas de un solo vendedor a la vez.</strong>
          </p>
        </div>
        <Button onClick={onClose} className="w-full bg-rose-500 text-white hover:bg-rose-600">Entendido</Button>
      </div>
    </Modal>
  );
}

/** Confirmación de pago: comprobante + instrucciones de notificación (WhatsApp/correo). */
export function PaySuccessModal({ data, onClose }: { data: ApprovePaySuccess; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Pago Registrado Exitosamente" maxWidth="max-w-2xl">
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
          <Check className="h-8 w-8" />
        </div>

        <div>
          <p className="text-lg font-bold text-text">¡El pago se ha registrado correctamente!</p>
          <p className="text-sm text-muted">El comprobante ha sido subido al sistema de historial.</p>
        </div>

        {data.notifiedVia === "whatsapp" && data.whatsappUrl ? (
          <div className="space-y-4 rounded-xl border border-whatsapp/30 bg-whatsapp/10 p-5 text-left">
            <p className="text-sm font-medium text-text">
              Para notificar al vendedor por WhatsApp, haz clic en el botón. Se abrirá una pestaña con el mensaje listo.
            </p>
            <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted">
              <p><strong>Instrucciones para adjuntar comprobantes:</strong></p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Haz clic en "Abrir WhatsApp Web".</li>
                <li>Regresa aquí y copia la imagen del comprobante (o saca un screenshot).</li>
                <li>Pega la imagen en el chat antes de enviarlo.</li>
              </ol>
            </div>
            <a
              href={data.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 py-3 text-sm font-bold text-white shadow-lg shadow-whatsapp/20 transition-transform hover:scale-[1.02]"
            >
              <img src="/icons/whatsapp.svg" alt="WA" className="h-5 w-5 brightness-0 invert" onError={(e) => (e.currentTarget.style.display = "none")} />
              Abrir WhatsApp Web
            </a>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted">
            Se ha enviado un correo electrónico de notificación al vendedor.
          </div>
        )}

        <div className="mt-4 text-left">
          {data.receiptUrl ? (
            <>
              <p className="mb-2 text-sm font-semibold text-text">Comprobante Registrado:</p>
              <div className="flex max-h-[300px] justify-center overflow-hidden rounded-xl border border-border bg-surface p-2">
                <img src={data.receiptUrl} alt="Comprobante" className="h-full w-auto object-contain" />
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-rose-500/30 bg-rose-500/5 p-4 text-center">
              <p className="text-sm font-medium text-rose-400">Pago registrado sin comprobante</p>
            </div>
          )}
        </div>

        <Button onClick={onClose} className="w-full">Cerrar</Button>
      </div>
    </Modal>
  );
}
