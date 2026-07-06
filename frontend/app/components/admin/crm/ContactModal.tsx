// Modal para registrar o editar un contacto de Seguimientos.
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { cn } from "~/lib/utils";
import {
  useCreateContactMutation,
  useUpdateContactMutation,
  type Contact,
  type ContactSource,
  type ContactTag,
} from "~/store/api/contactsApi";
import { SOURCE_ORDER, SOURCE_META, TAG_ORDER, TAG_META } from "./crmMeta";

export function ContactModal({ open, onClose, item }: { open: boolean; onClose: () => void; item?: Contact | null }) {
  const isEdit = !!item;
  const [create, { isLoading: creating }] = useCreateContactMutation();
  const [update, { isLoading: updating }] = useUpdateContactMutation();

  const [form, setForm] = useState({
    name: item?.name ?? "",
    phone: item?.phone ?? "",
    email: item?.email ?? "",
    product: item?.product ?? "",
    // Tolera orígenes heredados de la migración que no están en el enum nuevo.
    source: (item && SOURCE_ORDER.includes(item.source) ? item.source : item ? "other" : "facebook_ads") as ContactSource,
    tags: (item?.tags ?? []) as ContactTag[],
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const toggleTag = (t: ContactTag) =>
    setForm((f) => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] }));

  async function save() {
    if (form.name.trim().length < 2) return toast.error("El nombre del cliente es obligatorio.");
    const body = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      product: form.product.trim(),
      source: form.source,
      tags: form.tags,
    };
    try {
      if (isEdit && item) await update({ id: item.id, body }).unwrap();
      else await create(body).unwrap();
      toast.success(isEdit ? "Contacto actualizado." : "Contacto registrado.");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo guardar el contacto.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Editar contacto" : "Nuevo contacto"} maxWidth="max-w-xl">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente *">
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nombre del cliente" />
          </Field>
          <Field label="Teléfono (WhatsApp)">
            <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Ej. 8888 8888" />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Correo (opcional)">
            <input className="input" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="cliente@correo.com" />
          </Field>
          <Field label="Origen (cómo llegó)">
            <select className="input" value={form.source} onChange={(e) => set("source", e.target.value)}>
              {SOURCE_ORDER.map((s) => (
                <option key={s} value={s}>{SOURCE_META[s].emoji} {SOURCE_META[s].label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Producto de interés (opcional)">
          <input className="input" value={form.product} onChange={(e) => set("product", e.target.value)} placeholder="Ej. KZ EDX Pro / Mouse Attack Shark" />
        </Field>

        <Field label="Etiquetas (varias)">
          <div className="flex flex-wrap gap-2">
            {TAG_ORDER.map((t) => {
              const active = form.tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={cn(
                    "rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors",
                    active ? cn(TAG_META[t].cls, "border-transparent") : "border-border text-muted hover:text-text",
                  )}
                >
                  {TAG_META[t].label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={save} loading={creating || updating}>
            {isEdit ? "Guardar cambios" : "Registrar contacto"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
