// Modal para crear o editar un seguimiento de cliente.
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { DatePicker } from "~/components/ui/DatePicker";
import {
  useCreateFollowupMutation,
  useUpdateFollowupMutation,
  type Followup,
  type FollowupType,
} from "~/store/api/followupsApi";

const TYPES: { value: FollowupType; label: string }[] = [
  { value: "callback", label: "📞 Llamar en una fecha" },
  { value: "restock", label: "📦 Avisar cuando haya stock" },
  { value: "other", label: "📝 Otro" },
];

export function FollowupModal({ open, onClose, item }: { open: boolean; onClose: () => void; item?: Followup | null }) {
  const isEdit = !!item;
  const [create, { isLoading: creating }] = useCreateFollowupMutation();
  const [update, { isLoading: updating }] = useUpdateFollowupMutation();

  const [form, setForm] = useState({
    customerName: item?.customerName ?? "",
    customerPhone: item?.customerPhone ?? "",
    type: (item?.type ?? "callback") as FollowupType,
    product: item?.product ?? "",
    note: item?.note ?? "",
    followUpDate: item?.followUpDate ?? "",
    status: item?.status ?? "pending",
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (form.customerName.trim().length < 2) return toast.error("El nombre del cliente es obligatorio.");
    if (!form.followUpDate) return toast.error("Selecciona la fecha de seguimiento.");
    const body = {
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      type: form.type,
      product: form.product.trim(),
      note: form.note.trim(),
      followUpDate: form.followUpDate,
      status: form.status,
    };
    try {
      if (isEdit && item) await update({ id: item.id, body }).unwrap();
      else await create(body).unwrap();
      toast.success(isEdit ? "Seguimiento actualizado." : "Seguimiento agregado.");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo guardar el seguimiento.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Editar seguimiento" : "Nuevo seguimiento"} maxWidth="max-w-xl">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente *">
            <input className="input" value={form.customerName} onChange={(e) => set("customerName", e.target.value)} placeholder="Nombre del cliente" />
          </Field>
          <Field label="Teléfono (WhatsApp)">
            <input className="input" value={form.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} placeholder="Ej. 8888 8888" />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            <select className="input" value={form.type} onChange={(e) => set("type", e.target.value)}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Fecha de seguimiento *">
            <DatePicker value={form.followUpDate} onChange={(v) => set("followUpDate", v)} />
          </Field>
        </div>

        <Field label="Producto (opcional)">
          <input className="input" value={form.product} onChange={(e) => set("product", e.target.value)} placeholder="Ej. KZ EDX Pro / Mouse Attack Shark" />
        </Field>

        <Field label="Nota">
          <textarea className="input" rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Ej. Me dijo que le hable el 30 para la compra…" />
        </Field>

        {isEdit && (
          <Field label="Estado">
            <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="pending">Pendiente</option>
              <option value="done">Hecho</option>
              <option value="lost">Perdido</option>
            </select>
          </Field>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={save} loading={creating || updating}>
            {isEdit ? "Guardar cambios" : "Agregar seguimiento"}
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
