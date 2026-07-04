// Formulario de gasto (alta y edición comparten campos). Consume useExpenseActions; el
// pozo de presupuesto y las subcategorías salen de getExpenseCategories.
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "~/components/ui/Button";
import { DateField } from "~/components/ui/DatePicker";
import { Autocomplete } from "~/components/ui/Autocomplete";
import { Field } from "~/components/admin/reports/_shared/Field";
import { useGetExpenseCategoriesQuery, type LossRecord } from "~/store/api/reportsApi";
import { useExpenseActions } from "~/hooks/reports/useExpenseActions";
import { expenseSchema, type ExpenseInput } from "~/schemas/expenses";
import { cn } from "~/lib/utils";

const today = () => new Date().toISOString().split("T")[0];

export function ExpenseForm({ expense, onDone }: { expense?: LossRecord; onDone?: () => void }) {
  const isEdit = !!expense;
  const { data: cats } = useGetExpenseCategoriesQuery();
  const { createExpense, updateExpense, creating, updating } = useExpenseActions();
  const groups = cats?.groups ?? [];

  const { register, control, handleSubmit, reset, watch, formState: { errors } } = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: expense
      ? {
          date: expense.date,
          currency: expense.currency,
          group: expense.group || "",
          subcategory: expense.subcategory || "",
          amount: expense.amount,
          reason: expense.reason || "",
        }
      : { date: today(), currency: "C$", group: "", subcategory: "" },
  });

  const group = watch("group");
  const subOptions = (group && cats?.subcategoriesByGroup?.[group]) || [];

  async function onSubmit(data: ExpenseInput) {
    const ok = isEdit ? await updateExpense(expense.id, data) : await createExpense(data);
    if (!ok) return;
    if (!isEdit) reset({ date: today(), currency: "C$", group: "", subcategory: "", amount: undefined as any, reason: "" });
    onDone?.();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-6", !isEdit && "rounded-card border border-border bg-surface p-4")}
    >
      <Field label="Fecha" error={errors.date?.message}>
        <DateField control={control} name="date" invalid={!!errors.date} />
      </Field>
      <Field label="Grupo" error={errors.group?.message}>
        <select className="input" {...register("group")}>
          <option value="">Selecciona…</option>
          {groups.map((g) => (
            <option key={g.key} value={g.key}>{g.label}{g.budgeted ? "" : " (sin pozo)"}</option>
          ))}
        </select>
      </Field>
      <Field label="Subcategoría" className="lg:col-span-2">
        <Controller
          control={control}
          name="subcategory"
          render={({ field }) => (
            <Autocomplete options={subOptions} value={field.value || ""} onChange={field.onChange} placeholder="Ej. Internet, Energía, Bolsas…" />
          )}
        />
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
      <Field label="Nota (opcional)" className="lg:col-span-5">
        <input className="input" placeholder="Descripción…" {...register("reason")} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" loading={creating || updating}>
          {isEdit ? "Guardar cambios" : "Registrar gasto"}
        </Button>
      </div>
      {!isEdit && (
        <p className="text-xs text-muted lg:col-span-6">
          Mientras el gasto del grupo no supere su pozo de presupuesto del mes, no afecta la ganancia. Solo el excedente la reduce. Los grupos "sin pozo" la reducen por completo.
        </p>
      )}
    </form>
  );
}
