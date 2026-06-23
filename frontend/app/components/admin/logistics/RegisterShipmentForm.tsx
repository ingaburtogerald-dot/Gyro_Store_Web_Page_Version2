// Formulario del cliente para registrar un paquete nuevo (foto obligatoria).
import { useState } from "react";
import { Camera, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { DatePicker } from "~/components/ui/DatePicker";
import { useCreateShipmentMutation } from "~/store/api/logisticsApi";

// Códigos de país comunes para el teléfono del proveedor (China primero).
const COUNTRY_CODES = [
  { code: "+86", flag: "🇨🇳" },
  { code: "+505", flag: "🇳🇮" },
  { code: "+1", flag: "🇺🇸" },
  { code: "+52", flag: "🇲🇽" },
  { code: "+34", flag: "🇪🇸" },
  { code: "+57", flag: "🇨🇴" },
  { code: "+51", flag: "🇵🇪" },
  { code: "+55", flag: "🇧🇷" },
  { code: "+852", flag: "🇭🇰" },
];

export function RegisterShipmentForm() {
  const [createShipment, { isLoading }] = useCreateShipmentMutation();
  const [form, setForm] = useState({ trackingNumber: "", providerName: "", providerPhoneCode: "+86", providerPhone: "", purchaseDate: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [invoice, setInvoice] = useState<File | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!photo) return toast.error("La foto del paquete es obligatoria.");
    if (!form.trackingNumber.trim()) return toast.error("El tracking es obligatorio.");
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append("photo", photo);
    if (invoice) fd.append("invoiceFile", invoice);
    try {
      await createShipment(fd).unwrap();
      toast.success("Paquete registrado.");
      setForm({ trackingNumber: "", providerName: "", providerPhoneCode: "+86", providerPhone: "", purchaseDate: "" });
      setPhoto(null);
      setInvoice(null);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo registrar.");
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2">
      <Field label="Tracking number *">
        <input className="input" value={form.trackingNumber} onChange={set("trackingNumber")} placeholder="N° de seguimiento" />
      </Field>
      <Field label="Fecha de compra">
        <DatePicker
          value={form.purchaseDate}
          onChange={(v) => setForm((f) => ({ ...f, purchaseDate: v }))}
        />
      </Field>
      <Field label="Proveedor (China)">
        <input className="input" value={form.providerName} onChange={set("providerName")} placeholder="Nombre del proveedor" />
      </Field>
      <Field label="Teléfono del proveedor">
        <div className="flex gap-2">
          <select
            className="input w-28 shrink-0"
            value={form.providerPhoneCode}
            onChange={(e) => setForm((f) => ({ ...f, providerPhoneCode: e.target.value }))}
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
            ))}
          </select>
          <input className="input" value={form.providerPhone} onChange={set("providerPhone")} placeholder="Número / WeChat" />
        </div>
      </Field>

      <label className="flex cursor-pointer items-center gap-2 rounded-pill border border-border px-3 py-2 text-sm text-muted hover:text-text">
        <Camera className="h-4 w-4" />
        {photo ? photo.name : "Foto del paquete *"}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
      </label>
      <label className="flex cursor-pointer items-center gap-2 rounded-pill border border-border px-3 py-2 text-sm text-muted hover:text-text">
        <FileText className="h-4 w-4" />
        {invoice ? invoice.name : "Factura electrónica (opcional)"}
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setInvoice(e.target.files?.[0] || null)} />
      </label>

      <div className="sm:col-span-2">
        <Button type="submit" loading={isLoading}>Registrar paquete</Button>
      </div>
    </form>
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
