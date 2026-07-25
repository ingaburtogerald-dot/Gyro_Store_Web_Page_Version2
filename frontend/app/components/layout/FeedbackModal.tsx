// Modal de feedback público: reportar un bug, sugerir una mejora o pedir un
// producto. Envío anónimo (el teléfono es opcional) — no requiere sesión.
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { feedbackSchema, type FeedbackInput } from "~/schemas/validators";
import { useSendFeedbackMutation } from "~/store/api/feedbackApi";

const TYPES: { value: FeedbackInput["type"]; label: string }[] = [
  { value: "bug", label: "Reportar un error" },
  { value: "idea", label: "Sugerir una mejora" },
  { value: "product", label: "Pedir un producto" },
];

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sendFeedback, { isLoading }] = useSendFeedbackMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FeedbackInput>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { type: "bug", message: "", userPhone: "" },
  });

  async function onSubmit(data: FeedbackInput) {
    try {
      await sendFeedback({ ...data, userPhone: data.userPhone || undefined }).unwrap();
      reset();
      toast.success("¡Gracias por tu aporte!");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo enviar tu mensaje.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Danos tu opinión" maxWidth="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Field label="Tipo *" error={errors.type?.message}>
          <select className="input" {...register("type")}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mensaje *" error={errors.message?.message}>
          <textarea
            className="input"
            rows={4}
            placeholder="Contanos qué pasó o qué te gustaría ver…"
            {...register("message")}
          />
        </Field>
        <Field label="Teléfono (opcional)" error={errors.userPhone?.message}>
          <input
            className="input"
            type="tel"
            inputMode="tel"
            placeholder="8888 8888 — por si queremos darte seguimiento"
            {...register("userPhone")}
          />
        </Field>
        <Button type="submit" className="w-full" loading={isLoading}>
          Enviar
        </Button>
      </form>
    </Modal>
  );
}
