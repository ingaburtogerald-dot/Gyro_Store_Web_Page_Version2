import type { MetaFunction } from "@remix-run/node";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Instagram, Facebook, MapPin } from "lucide-react";
import { toast } from "sonner";
import { PublicHeader } from "~/components/layout/PublicHeader";
import { PublicFooter } from "~/components/layout/PublicFooter";
import { Button } from "~/components/ui/Button";
import { contactSchema, type ContactInput } from "~/lib/validators";
import { useSendContactMutation } from "~/store/api/ordersApi";
import { useGetConfigQuery } from "~/store/api/catalogApi";

export const meta: MetaFunction = () => [{ title: "Contacto · Gyro Store" }];

export default function Contacto() {
  const { data: config } = useGetConfigQuery();
  const [sendContact, { isLoading }] = useSendContactMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactInput>({ resolver: zodResolver(contactSchema) });

  async function onSubmit(data: ContactInput) {
    try {
      await sendContact(data).unwrap();
      reset();
      toast.success("Mensaje enviado. Te responderemos pronto.");
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo enviar el mensaje.");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg font-sans text-text">
      <PublicHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold">Contacto</h1>
        <p className="mt-1 text-muted">¿Tenés una consulta? Escribinos y te respondemos.</p>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-3"
          >
            <Field label="Nombre *" error={errors.name?.message}>
              <input className="input" placeholder="Tu nombre" {...register("name")} />
            </Field>
            <Field label="Correo *" error={errors.email?.message}>
              <input className="input" type="email" placeholder="tu@correo.com" {...register("email")} />
            </Field>
            <Field label="Teléfono" error={errors.phone?.message}>
              <input className="input" inputMode="tel" placeholder="8888 8888" {...register("phone")} />
            </Field>
            <Field label="Mensaje *" error={errors.message?.message}>
              <textarea className="input" rows={4} placeholder="¿En qué te ayudamos?" {...register("message")} />
            </Field>
            <Button type="submit" className="w-full" loading={isLoading}>
              Enviar mensaje
            </Button>
          </motion.form>

          <div className="space-y-4">
            <div className="rounded-card border border-border bg-surface shadow-premium p-5">
              <h2 className="font-semibold">Visitanos</h2>
              <a
                href="https://maps.google.com/?q=Managua,Nicaragua"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
              >
                <MapPin className="h-4 w-4" /> {config?.storeAddress ?? "Managua, Nicaragua"}
              </a>
            </div>
            <div className="rounded-card border border-border bg-surface shadow-premium p-5">
              <h2 className="font-semibold">Síguenos</h2>
              <div className="mt-3 flex gap-3">
                <a href={config?.socialLinks?.instagram ?? "#"} aria-label="Instagram"
                  className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-muted hover:text-text">
                  <Instagram className="h-5 w-5" />
                </a>
                <a href={config?.socialLinks?.facebook ?? "#"} aria-label="Facebook"
                  className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-muted hover:text-text">
                  <Facebook className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
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
