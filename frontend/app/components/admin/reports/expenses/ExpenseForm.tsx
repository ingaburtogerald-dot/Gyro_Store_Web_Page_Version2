// Formulario de gasto (alta y edición comparten campos). Consume useExpenseActions; el
// pozo de presupuesto y las subcategorías salen de getExpenseCategories.
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Wallet, Coins } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { DateField } from "~/components/ui/DatePicker";
import { Autocomplete } from "~/components/ui/Autocomplete";
import { Field } from "~/components/ui/Field";
import { Select } from "~/components/admin/reports/_shared/Select";
import { formStagger, fieldItem } from "~/components/admin/reports/_shared/motion";
import { useGetExpenseCategoriesQuery, type LossRecord } from "~/store/api/reportsApi";
import { useExpenseActions } from "~/hooks/reports/useExpenseActions";
import { expenseSchema, type ExpenseInput } from "~/schemas/expenses";
import { cn } from "~/lib/utils";

const today = () => new Date().toISOString().split("T")[0];

export function ExpenseForm({ expense, onDone, bare }: { expense?: LossRecord; onDone?: () => void; bare?: boolean }) {
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
    <motion.form
      variants={formStagger}
      initial="hidden"
      animate="show"
      onSubmit={handleSubmit(onSubmit)}
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2",
        !isEdit && !bare &&
          "rounded-card border border-border bg-surface p-5 transition-all duration-300 focus-within:border-accent/30 focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.06)]",
      )}
    >
      <motion.div variants={fieldItem}>
        <Field label="Fecha" error={errors.date?.message}>
          <DateField control={control} name="date" invalid={!!errors.date} />
        </Field>
      </motion.div>

      <motion.div variants={fieldItem}>
        <Field label="Grupo" error={errors.group?.message}>
          <Select icon={Wallet} {...register("group")}>
            <option value="">Selecciona…</option>
            {groups.map((g) => (
              <option key={g.key} value={g.key}>{g.label}{g.budgeted ? "" : " (sin pozo)"}</option>
            ))}
          </Select>
        </Field>
      </motion.div>

      <motion.div variants={fieldItem} className="sm:col-span-2">
        <Field label="Subcategoría">
          <Controller
            control={control}
            name="subcategory"
            render={({ field }) => (
              <Autocomplete options={subOptions} value={field.value || ""} onChange={field.onChange} placeholder="Ej. Internet, Energía, Bolsas…" />
            )}
          />
        </Field>
      </motion.div>

      <motion.div variants={fieldItem}>
        <Field label="Monto" error={errors.amount?.message}>
          <input type="number" step="0.01" min={0} className="input" {...register("amount")} />
        </Field>
      </motion.div>

      <motion.div variants={fieldItem}>
        <Field label="Moneda">
          <Select icon={Coins} {...register("currency")}>
            <option value="C$">C$</option>
            <option value="USD">USD</option>
          </Select>
        </Field>
      </motion.div>

      <motion.div variants={fieldItem} className="sm:col-span-2">
        <Field label="Nota (opcional)">
          <input className="input" placeholder="Descripción…" {...register("reason")} />
        </Field>
      </motion.div>

      <motion.div variants={fieldItem} className="sm:col-span-2 flex justify-end pt-1">
        <Button type="submit" loading={creating || updating}>
          {isEdit ? "Guardar cambios" : "Registrar gasto"}
        </Button>
      </motion.div>

      {!isEdit && (
        <motion.p variants={fieldItem} className="sm:col-span-2 text-xs text-muted">
          Mientras el gasto del grupo no supere su pozo de presupuesto del mes, no afecta la ganancia. Solo el excedente la reduce. Los grupos "sin pozo" la reducen por completo.
        </motion.p>
      )}
    </motion.form>
  );
}
