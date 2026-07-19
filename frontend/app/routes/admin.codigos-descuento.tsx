// Códigos de descuento (Centro de Administración). Incentivo por reseña en
// Google/Facebook: el admin revisa la reseña a mano y emite un código acá.
// El canje real (que descuenta un uso) ocurre en el checkout público — este
// panel solo crea/lista/activa-desactiva.
import { useState } from "react";
import { Ticket, Plus, Power, Copy } from "lucide-react";
import { toast } from "sonner";
import { RequireRole } from "~/components/admin/RequireRole";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { Skeleton } from "~/components/ui/Skeleton";
import { cn } from "~/lib/utils";
import {
  useGetDiscountCodesQuery,
  useCreateDiscountCodeMutation,
  useSetDiscountCodeActiveMutation,
  type DiscountType,
} from "~/store/api/discountCodesApi";

const EMPTY_FORM = { code: "", type: "percent" as DiscountType, value: "", maxUses: "1", expiresAt: "", note: "" };

export default function AdminDiscountCodes() {
  const { data = [], isLoading } = useGetDiscountCodesQuery();
  const [createCode, { isLoading: creating }] = useCreateDiscountCodeMutation();
  const [setActive] = useSetDiscountCodeActiveMutation();
  const [form, setForm] = useState(EMPTY_FORM);

  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(form.value);
    if (!form.code.trim()) return toast.error("Escribe un código.");
    if (!value || value <= 0) return toast.error("El valor debe ser mayor a 0.");
    try {
      await createCode({
        code: form.code.trim(),
        type: form.type,
        value,
        maxUses: form.maxUses.trim() === "" ? 1 : Number(form.maxUses),
        expiresAt: form.expiresAt || undefined,
        note: form.note.trim(),
      }).unwrap();
      toast.success(`Código "${form.code.trim().toUpperCase()}" creado.`);
      setForm(EMPTY_FORM);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo crear el código.");
    }
  }

  async function toggleActive(code: string, active: boolean) {
    try {
      await setActive({ code, active }).unwrap();
      toast.success(active ? `"${code}" reactivado.` : `"${code}" desactivado.`);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo actualizar el código.");
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => toast.success("Código copiado."));
  }

  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Códigos de descuento</h1>
          <p className="text-muted">
            Incentivo por reseña: revisá la reseña en Google/Facebook y emití un código acá. El cliente lo usa una vez en el checkout.
          </p>
        </div>

        {/* Crear */}
        <section className="card-premium rounded-card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-bold text-text">
            <Plus className="h-4 w-4 text-accent-2" /> Nuevo código
          </h2>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Field label="Código *" className="lg:col-span-2">
              <input
                className="input uppercase"
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="RESENA-JUAN10"
                maxLength={30}
              />
            </Field>
            <Field label="Tipo">
              <select className="input" value={form.type} onChange={(e) => set("type", e.target.value as DiscountType)}>
                <option value="percent">% Porcentaje</option>
                <option value="fixed">C$ Monto fijo</option>
              </select>
            </Field>
            <Field label={form.type === "percent" ? "Valor (%)" : "Valor (C$)"}>
              <input
                className="input"
                type="number"
                min={1}
                max={form.type === "percent" ? 100 : undefined}
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                placeholder={form.type === "percent" ? "10" : "50"}
              />
            </Field>
            <Field label="Usos máx. (0 = ilimitado)">
              <input className="input" type="number" min={0} value={form.maxUses} onChange={(e) => set("maxUses", e.target.value)} />
            </Field>
            <Field label="Vence (opcional)">
              <input className="input" type="date" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
            </Field>
            <Field label="Nota (para vos, ej. quién dejó la reseña)" className="sm:col-span-2 lg:col-span-6">
              <input className="input" value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Reseña de Juan Pérez en Google — 19/07" maxLength={200} />
            </Field>
            <div className="sm:col-span-2 lg:col-span-6">
              <Button type="submit" loading={creating}>
                <Plus className="h-4 w-4" /> Crear código
              </Button>
            </div>
          </form>
        </section>

        {/* Lista */}
        <section className="card-premium rounded-card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-bold text-text">
            <Ticket className="h-4 w-4 text-accent-2" /> Códigos emitidos
          </h2>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Todavía no emitiste ningún código.</p>
          ) : (
            <ul className="space-y-2">
              {data.map((d) => {
                const exhausted = d.maxUses > 0 && d.usedCount >= d.maxUses;
                const expired = d.expiresAt ? new Date(d.expiresAt).getTime() < Date.now() : false;
                const effectivelyOff = !d.active || exhausted || expired;
                return (
                  <li
                    key={d.code}
                    className={cn(
                      "flex flex-wrap items-center gap-3 rounded-xl border border-border/70 p-3.5 transition-opacity",
                      effectivelyOff && "opacity-60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => copyCode(d.code)}
                      title="Copiar código"
                      className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 font-mono text-sm font-bold tracking-wide text-text hover:bg-surface-hover"
                    >
                      {d.code} <Copy className="h-3 w-3 text-muted" />
                    </button>
                    <span className="text-sm font-semibold text-accent-2">
                      {d.type === "percent" ? `${d.value}%` : `C$${d.value}`}
                    </span>
                    <span className="text-xs text-muted">
                      {d.usedCount} / {d.maxUses > 0 ? d.maxUses : "∞"} usos
                    </span>
                    {d.expiresAt && (
                      <span className="text-xs text-muted">Vence {new Date(d.expiresAt).toLocaleDateString("es-NI")}</span>
                    )}
                    {d.note && <span className="min-w-0 flex-1 truncate text-xs text-muted">{d.note}</span>}
                    <span
                      className={cn(
                        "ml-auto rounded-pill px-2.5 py-1 text-xs font-bold",
                        effectivelyOff ? "bg-surface-2 text-muted" : "bg-accent/12 text-accent-2",
                      )}
                    >
                      {!d.active ? "Desactivado" : exhausted ? "Agotado" : expired ? "Vencido" : "Activo"}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleActive(d.code, !d.active)}
                      title={d.active ? "Desactivar" : "Reactivar"}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
                    >
                      <Power className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </RequireRole>
  );
}
