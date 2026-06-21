// Registro de pérdidas: formulario + historial. Las pérdidas se reflejan en los KPIs.
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { DataTable } from "~/components/ui/DataTable";
import { useGetLossesQuery, useCreateLossMutation, type Loss } from "~/store/api/reportsApi";
import { DateField } from "~/components/ui/DatePicker";
import { formatCordobas } from "~/lib/utils";

const schema = z.object({
  date: z.string().min(1, "Fecha requerida"),
  amount: z.coerce.number().positive("Monto inválido"),
  currency: z.enum(["C$", "USD"]),
  reason: z.string().min(2, "Motivo requerido"),
  category: z.enum(["robo", "daño", "devolucion", "otro"]),
});
type FormInput = z.infer<typeof schema>;

const CATEGORY_LABEL: Record<Loss["category"], string> = {
  robo: "Robo", daño: "Daño", devolucion: "Devolución", otro: "Otro",
};

export function LossesPanel() {
  const { data: losses = [] } = useGetLossesQuery();
  const [createLoss, { isLoading }] = useCreateLossMutation();
  const {
    register, control, handleSubmit, reset, formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split("T")[0], currency: "C$", category: "otro" },
  });

  async function onSubmit(data: FormInput) {
    try {
      await createLoss(data).unwrap();
      toast.success("Pérdida registrada.");
      reset({ date: new Date().toISOString().split("T")[0], currency: "C$", category: "otro" });
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo registrar.");
    }
  }

  const columns = useMemo<ColumnDef<Loss, any>[]>(
    () => [
      { accessorKey: "date", header: "Fecha" },
      { accessorKey: "reason", header: "Motivo" },
      { accessorKey: "category", header: "Categoría", cell: (c) => CATEGORY_LABEL[c.getValue() as Loss["category"]] },
      {
        accessorKey: "amount",
        header: "Monto",
        cell: (c) => `${c.row.original.currency === "USD" ? "$" : "C$"}${c.getValue()}`,
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Fecha" error={errors.date?.message}>
          <DateField control={control} name="date" invalid={!!errors.date} />
        </Field>
        <Field label="Monto" error={errors.amount?.message}>
          <input type="number" step="0.01" min={0} className="input" {...register("amount")} />
        </Field>
        <Field label="Moneda">
          <select className="input" {...register("currency")}>
            <option value="C$">C$</option>
            <option value="USD">USD</option>
          </select>
        </Field>
        <Field label="Categoría">
          <select className="input" {...register("category")}>
            <option value="robo">Robo</option>
            <option value="daño">Daño</option>
            <option value="devolucion">Devolución</option>
            <option value="otro">Otro</option>
          </select>
        </Field>
        <Field label="Motivo" error={errors.reason?.message}>
          <input className="input" placeholder="Descripción…" {...register("reason")} />
        </Field>
        <div className="flex items-end lg:col-span-5">
          <Button type="submit" loading={isLoading}>Registrar pérdida</Button>
        </div>
      </form>

      <DataTable columns={columns} data={losses} searchPlaceholder="Buscar pérdida…" emptyText="Sin pérdidas registradas." />
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
}
