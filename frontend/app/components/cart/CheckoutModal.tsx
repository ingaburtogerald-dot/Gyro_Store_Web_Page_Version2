// Modal de checkout. Valida con Zod, crea la orden en el backend (que recalcula
// el total) y abre WhatsApp con el mensaje formateado del pedido.
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { checkoutSchema, type CheckoutInput } from "~/lib/validators";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { clearCart, closeCart, selectCartItems, selectCartTotal } from "~/store/slices/cartSlice";
import { useCreatePublicOrderMutation } from "~/store/api/ordersApi";
import { formatCordobas } from "~/lib/utils";

export function CheckoutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectCartItems);
  const total = useAppSelector(selectCartTotal);
  const [createOrder, { isLoading }] = useCreatePublicOrderMutation();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { deliveryMethod: "retiro" },
  });

  const deliveryMethod = watch("deliveryMethod");

  async function onSubmit(data: CheckoutInput) {
    try {
      const result = await createOrder({
        ...data,
        items: items.map((i) => ({
          catalogId: i.catalogId,
          variantId: i.variantId,
          variantName: i.variantName,
          quantity: i.quantity,
        })),
      }).unwrap();

      reset();
      dispatch(clearCart());
      dispatch(closeCart());
      onClose();
      window.open(result.whatsappUrl, "_blank");
      toast.success("Pedido enviado. Te redirigimos a WhatsApp.");
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo enviar el pedido.");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-surface shadow-premium p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="checkout-title" className="text-lg font-bold">Tus datos</h2>
              <button onClick={onClose} aria-label="Cerrar">
                <X className="h-5 w-5 text-muted hover:text-text" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <Field label="Nombre completo *" error={errors.customerName?.message}>
                <input className="input" autoComplete="name" placeholder="Ej. Juan Pérez" {...register("customerName")} />
              </Field>

              <Field label="Teléfono / WhatsApp *" error={errors.customerPhone?.message}>
                <input className="input" inputMode="tel" placeholder="Ej. 8888 8888" {...register("customerPhone")} />
              </Field>

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">¿Cómo querés recibirlo?</legend>
                <div className="grid grid-cols-2 gap-2">
                  <Radio value="retiro" label="🏬 Retiro en tienda" {...register("deliveryMethod")} />
                  <Radio value="envio" label="🚚 Envío a domicilio" {...register("deliveryMethod")} />
                </div>
              </fieldset>

              {deliveryMethod === "envio" && (
                <Field label="Dirección de entrega *" error={errors.address?.message}>
                  <textarea className="input" rows={2} placeholder="Barrio, calle, referencias…" {...register("address")} />
                </Field>
              )}

              <Field label="Nota (opcional)">
                <input className="input" placeholder="Color, modelo, horario…" {...register("note")} />
              </Field>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-muted">Total</span>
                <strong className="font-heading text-lg">{formatCordobas(total)}</strong>
              </div>

              <Button type="submit" variant="whatsapp" className="w-full" loading={isLoading}>
                Confirmar y enviar por WhatsApp
              </Button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
}

const Radio = (
  { label, value, ...props }: { label: string; value: string } & React.InputHTMLAttributes<HTMLInputElement>,
) => (
  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm has-[:checked]:border-accent">
    <input type="radio" value={value} className="accent-accent" {...props} />
    {label}
  </label>
);
