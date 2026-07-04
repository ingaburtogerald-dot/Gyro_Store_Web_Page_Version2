// Modal para crear o editar un contacto/lead del CRM.
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import {
  useCreateContactMutation,
  useUpdateContactMutation,
  type Contact,
  type CrmStage,
} from "~/store/api/contactsApi";
import { STAGE_ORDER, STAGE_META } from "./crmMeta";

export function ContactModal({ open, onClose, item }: { open: boolean; onClose: () => void; item?: Contact | null }) {
  const isEdit = !!item;
  const [create, { isLoading: creating }] = useCreateContactMutation();
  const [update, { isLoading: updating }] = useUpdateContactMutation();

  const [form, setForm] = useState({
    name: item?.name ?? "",
    phone: item?.phone ?? "",
    email: item?.email ?? "",
    product: item?.product ?? "",
    value: item?.value ?? 0,
    source: item?.source ?? "",
    stage: (item?.stage ?? "new") as CrmStage,
    tags: (item?.tags ?? []).join(", "),
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (form.name.trim().length < 2) return toast.error("El nombre del cliente es obligatorio.");
    const body = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      product: form.product.trim(),
      value: Number(form.value) || 0,
      source: form.source.trim(),
      stage: form.stage,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (isEdit && item) await update({ id: item.id, body }).unwrap();
      else await create(body).unwrap();
      toast.success(isEdit ? "Contacto actualizado." : "Contacto agregado.");
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
          <Field label="Valor estimado (C$)">
            <input className="input" type="number" min={0} value={form.value} onChange={(e) => set("value", e.target.value)} />
          </Field>
        </div>

        <Field label="Producto de interés (opcional)">
          <input className="input" value={form.product} onChange={(e) => set("product", e.target.value)} placeholder="Ej. KZ EDX Pro / Mouse Attack Shark" />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Etapa">
            <select className="input" value={form.stage} onChange={(e) => set("stage", e.target.value)}>
              {STAGE_ORDER.map((s) => (
                <option key={s} value={s}>{STAGE_META[s].label}</option>
              ))}
            </select>
          </Field>
          <Field label="Origen (opcional)">
            <input className="input" value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="Ej. WhatsApp, Feria, Referido" />
          </Field>
        </div>

        <Field label="Etiquetas (separadas por coma)">
          <input className="input" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="mayorista, VIP" />
        </Field>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={save} loading={creating || updating}>
            {isEdit ? "Guardar cambios" : "Agregar contacto"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
