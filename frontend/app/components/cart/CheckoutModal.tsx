// Modal de checkout. Valida con Zod, crea la orden en el backend (que recalcula
// el total) y abre WhatsApp con el mensaje formateado del pedido.
import { forwardRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, MapPin, Store, Truck, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { checkoutSchema, type CheckoutInput } from "~/schemas/validators";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { clearCart, closeCart, selectCartItems, selectCartTotal } from "~/store/slices/cartSlice";
import { useCreatePublicOrderMutation } from "~/store/api/ordersApi";
import { useValidateDiscountCodeMutation, type DiscountType } from "~/store/api/discountCodesApi";
import { formatCordobas } from "~/lib/utils";

export function CheckoutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectCartItems);
  const total = useAppSelector(selectCartTotal);
  const [createOrder, { isLoading }] = useCreatePublicOrderMutation();

  // Código de descuento (incentivo por reseña): preview de solo lectura contra
  // POST /discount-codes/validate — el canje real (que sí gasta un uso) ocurre
  // recién al confirmar el pedido, en el mismo request que lo crea.
  const [validateCode, { isLoading: validatingCode }] = useValidateDiscountCodeMutation();
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<{ code: string; type: DiscountType; value: number } | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  function changeCode(v: string) {
    setCodeInput(v.toUpperCase());
    setAppliedCode(null);
    setCodeError(null);
  }

  async function applyCode() {
    const code = codeInput.trim();
    if (!code) return;
    setCodeError(null);
    try {
      const result = await validateCode(code).unwrap();
      setAppliedCode(result);
    } catch (err: any) {
      setAppliedCode(null);
      setCodeError(err?.data?.error || "Código inválido.");
    }
  }

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { deliveryMethod: "retiro" },
  });

  const deliveryMethod = watch("deliveryMethod");

  const [geo, setGeo] = useState<{ status: "idle" | "loading" | "ok"; url?: string }>({ status: "idle" });

  // Captura la ubicación GPS puntual del cliente y la adjunta como link de Google
  // Maps (para el repartidor). Es opcional: si niega el permiso, queda la dirección.
  function captureLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("Tu dispositivo no permite compartir ubicación.");
      return;
    }
    setGeo({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
        setValue("locationUrl", url, { shouldValidate: true });
        setGeo({ status: "ok", url });
        toast.success("Ubicación agregada 📍");
      },
      (err) => {
        setGeo({ status: "idle" });
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Permiso denegado. Podés escribir la dirección abajo."
            : "No se pudo obtener tu ubicación. Escribí la dirección.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  // Si la validación falla, RHF no llama a onSubmit y el botón parecía "no hacer
  // nada". Con onInvalid avisamos qué campo falta en vez de fallar en silencio.
  function onInvalid(errs: typeof errors) {
    const first: any = Object.values(errs).find(Boolean);
    toast.error(first?.message || "Revisa los datos del formulario.");
  }

  async function onSubmit(data: CheckoutInput) {
    if (items.length === 0) {
      toast.error("Tu carrito está vacío.");
      return;
    }
    try {
      const result = await createOrder({
        ...data,
        discountCode: appliedCode?.code,
        items: items.map((i) => ({
          // Línea de combo: manda comboId (el servidor revalida el precio del
          // paquete). Producto suelto: catalogId + variante.
          catalogId: i.comboId ? "" : i.catalogId,
          comboId: i.comboId,
          variantId: i.variantId,
          variantName: i.variantName,
          quantity: i.quantity,
        })),
      }).unwrap();

      reset();
      setCodeInput("");
      setAppliedCode(null);
      setCodeError(null);
      dispatch(clearCart());
      dispatch(closeCart());
      onClose();
      // En móvil el navegador puede bloquear window.open tras un await; si pasa,
      // navegamos en la misma pestaña para que WhatsApp igual abra.
      const opened = window.open(result.whatsappUrl, "_blank");
      if (!opened) window.location.href = result.whatsappUrl;
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
            // max-h + overflow-y-auto: en móvil, con "Envío a domicilio" + todos los
            // campos + teclado abierto, el formulario puede superar el alto visible;
            // sin esto el CTA final quedaba inalcanzable. pb con safe-area para que
            // el home indicator no tape el botón de confirmar.
            className="fixed left-1/2 top-1/2 z-[60] flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-premium"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
          >
            <div className="flex shrink-0 items-center justify-between p-6 pb-4">
              <h2 id="checkout-title" className="text-lg font-bold">Tus datos</h2>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="grid h-11 w-11 place-items-center text-muted hover:text-text md:h-8 md:w-8"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit, onInvalid)}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              <Field label="Nombre completo *" error={errors.customerName?.message}>
                <input className="input" autoComplete="name" placeholder="Ej. Juan Pérez" {...register("customerName")} />
              </Field>

              <Field label="Teléfono / WhatsApp *" error={errors.customerPhone?.message}>
                <input className="input" inputMode="tel" placeholder="Ej. 8888 8888" {...register("customerPhone")} />
              </Field>

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">¿Cómo querés recibirlo?</legend>
                <div className="grid grid-cols-2 gap-2">
                  <Radio value="retiro" label="Retiro en tienda" icon={Store} {...register("deliveryMethod")} />
                  <Radio value="envio" label="Envío a domicilio" icon={Truck} {...register("deliveryMethod")} />
                </div>
              </fieldset>

              {deliveryMethod === "envio" && (
                <div className="space-y-2">
                  <input type="hidden" {...register("locationUrl")} />
                  <button
                    type="button"
                    onClick={captureLocation}
                    disabled={geo.status === "loading"}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-60"
                  >
                    <MapPin className="h-4 w-4" />
                    {geo.status === "loading"
                      ? "Obteniendo ubicación…"
                      : geo.status === "ok"
                        ? "Ubicación agregada ✓"
                        : "Usar mi ubicación actual"}
                  </button>
                  {geo.status === "ok" && geo.url && (
                    <a
                      href={geo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-center text-xs text-accent underline"
                    >
                      Ver el pin en el mapa
                    </a>
                  )}
                  <Field label="Dirección / referencias" error={errors.address?.message}>
                    <textarea
                      className="input"
                      rows={2}
                      placeholder="Barrio, calle, señas (portón negro, casa esquinera…)"
                      {...register("address")}
                    />
                  </Field>
                  <p className="text-xs text-muted">
                    Compartí tu ubicación <span className="font-medium">o</span> escribí la dirección (idealmente las dos).
                  </p>
                </div>
              )}

              <Field label="Nota (opcional)">
                <input className="input" placeholder="Color, modelo, horario…" {...register("note")} />
              </Field>

              <Field label="¿Tenés un código de descuento?">
                <div className="flex gap-2">
                  <input
                    className="input flex-1 uppercase"
                    value={codeInput}
                    onChange={(e) => changeCode(e.target.value)}
                    placeholder="Ej. RESENA-JUAN10"
                    maxLength={30}
                  />
                  <Button type="button" variant="outline" onClick={applyCode} loading={validatingCode} disabled={!codeInput.trim()}>
                    Aplicar
                  </Button>
                </div>
                {appliedCode && (
                  <p className="mt-1.5 text-xs font-semibold text-accent-2">
                    ✓ {appliedCode.type === "percent" ? `${appliedCode.value}%` : `C$${appliedCode.value}`} de descuento aplicado
                  </p>
                )}
                {codeError && <p className="mt-1.5 text-xs text-danger">{codeError}</p>}
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
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

// forwardRef es imprescindible: react-hook-form pasa un ref para registrar el
// grupo de radios. Sin esto el ref se pierde, `deliveryMethod` se lee vacío y el
// checkout no envía (validación falla en silencio).
const Radio = forwardRef<
  HTMLInputElement,
  { label: string; value: string; icon: LucideIcon } & React.InputHTMLAttributes<HTMLInputElement>
>(function Radio({ label, value, icon: Icon, ...props }, ref) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm has-[:checked]:border-accent">
      <input ref={ref} type="radio" value={value} className="accent-accent" {...props} />
      <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      {label}
    </label>
  );
});
