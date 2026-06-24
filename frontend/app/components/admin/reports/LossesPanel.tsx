// Registro de pérdidas de inventario y gastos operativos.
//   - Pérdida: se elige un producto; su costo real (FIFO/migrado) es la pérdida y se
//     descuenta del stock.
//   - Gasto: monto + grupo (con pozo de presupuesto) + subcategoría libre con autocompletado.
// Ambos se reflejan en los KPIs y en la tabla Presupuesto vs Gasto del dashboard.
import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { DataTable } from "~/components/ui/DataTable";
import { Modal } from "~/components/ui/Modal";
import { DateField } from "~/components/ui/DatePicker";
import { Autocomplete } from "~/components/ui/Autocomplete";
import {
  useGetLossesQuery,
  useGetLossProductsQuery,
  useGetExpenseCategoriesQuery,
  useCreateLossMutation,
  useUpdateLossMutation,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  type LossRecord,
  type LossCategory,
} from "~/store/api/reportsApi";
import { cn, formatCordobas } from "~/lib/utils";

const LOSS_CATEGORY_LABEL: Record<LossCategory, string> = {
  robo: "Robo", daño: "Daño", devolucion: "Devolución",
};

const today = () => new Date().toISOString().split("T")[0];
const money = (r: LossRecord) => `${r.currency === "USD" ? "$" : "C$"}${r.amount}`;

export function LossesPanel() {
  const [tab, setTab] = useState<"loss" | "expense">("loss");
  const { data: records = [] } = useGetLossesQuery();

  const { inventoryLosses, expenses } = useMemo(() => {
    const inventoryLosses = records.filter((r) => r.kind !== "expense");
    const expenses = records.filter((r) => r.kind === "expense");
    return { inventoryLosses, expenses };
  }, [records]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-pill border border-border bg-surface p-1 sm:w-fit">
        <SubTab active={tab === "loss"} onClick={() => setTab("loss")}>Pérdida de producto</SubTab>
        <SubTab active={tab === "expense"} onClick={() => setTab("expense")}>Gasto</SubTab>
      </div>

      {tab === "loss" ? <LossForm /> : <ExpenseForm />}

      {tab === "loss" ? (
        <LossTable data={inventoryLosses} />
      ) : (
        <ExpenseTable data={expenses} />
      )}
    </div>
  );
}

// ── Pérdida de producto ─────────────────────────────────────────────────────
const lossSchema = z.object({
  date: z.string().min(1, "Fecha requerida"),
  product: z.string().min(1, "Producto requerido"), // "origin:productId"
  quantity: z.coerce.number().int().positive("Cantidad inválida"),
  category: z.enum(["robo", "daño", "devolucion"]),
  reason: z.string().optional(),
});
type LossInput = z.infer<typeof lossSchema>;

// Extrae el número del código ("IN12" → 12, "M-IN58" → 58) para ordenar.
function codeNum(code?: string): number {
  const m = code?.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

function LossForm() {
  const { data: products = [] } = useGetLossProductsQuery();
  const [createLoss, { isLoading }] = useCreateLossMutation();

  // Ordenar por código (IN1, IN2, …); nativos antes que migrados.
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      if (a.origin !== b.origin) return a.origin === "migrated" ? 1 : -1;
      return codeNum(a.code) - codeNum(b.code);
    });
  }, [products]);
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<LossInput>({
    resolver: zodResolver(lossSchema),
    defaultValues: { date: today(), category: "daño", quantity: 1 },
  });

  async function onSubmit(data: LossInput) {
    const [origin, productId] = data.product.split(":") as ["native" | "migrated", string];
    try {
      await createLoss({ date: data.date, origin, productId, quantity: data.quantity, category: data.category, reason: data.reason }).unwrap();
      toast.success("Pérdida registrada y stock descontado.");
      reset({ date: today(), category: "daño", quantity: 1, product: "", reason: "" });
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo registrar.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
      <Field label="Fecha" error={errors.date?.message}>
        <DateField control={control} name="date" invalid={!!errors.date} />
      </Field>
      <Field label="Producto" error={errors.product?.message} className="lg:col-span-2">
        <select className="input" {...register("product")}>
          <option value="">Selecciona…</option>
          {sortedProducts.map((p) => (
            <option key={`${p.origin}:${p.id}`} value={`${p.origin}:${p.id}`}>
              {p.code} — {p.name} · stock {p.stock}{p.origin === "migrated" ? " · migrado" : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Cantidad" error={errors.quantity?.message}>
        <input type="number" min={1} step={1} className="input" {...register("quantity")} />
      </Field>
      <Field label="Tipo">
        <select className="input" {...register("category")}>
          <option value="daño">Daño</option>
          <option value="robo">Robo</option>
          <option value="devolucion">Devolución</option>
        </select>
      </Field>
      <Field label="Nota (opcional)" className="lg:col-span-4">
        <input className="input" placeholder="Descripción…" {...register("reason")} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" loading={isLoading}>Registrar pérdida</Button>
      </div>
      <p className="text-xs text-muted lg:col-span-5">
        El monto de la pérdida es el costo real del producto (no el precio de venta) y se descuenta del inventario.
      </p>
    </form>
  );
}

function LossTable({ data }: { data: LossRecord[] }) {
  const [editFor, setEditFor] = useState<LossRecord | null>(null);
  const columns = useMemo<ColumnDef<LossRecord, any>[]>(() => [
    { accessorKey: "date", header: "Fecha" },
    { accessorKey: "productName", header: "Producto", cell: (c) => `${c.row.original.productName ?? ""}${c.row.original.productCode ? ` (${c.row.original.productCode})` : ""}` },
    { accessorKey: "quantity", header: "Cant." },
    { accessorKey: "category", header: "Tipo", cell: (c) => LOSS_CATEGORY_LABEL[c.getValue() as LossCategory] ?? c.getValue() },
    { accessorKey: "amount", header: "Costo real", cell: (c) => money(c.row.original) },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: (c) => (
        <button
          type="button"
          onClick={() => setEditFor(c.row.original)}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-hover hover:text-text"
          title="Editar pérdida"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ),
    },
  ], []);
  return (
    <>
      <DataTable columns={columns} data={data} searchPlaceholder="Buscar pérdida…" emptyText="Sin pérdidas registradas." />
      {editFor && (
        <Modal open={!!editFor} onClose={() => setEditFor(null)} title="Editar pérdida">
          <LossEditForm loss={editFor} onDone={() => setEditFor(null)} />
        </Modal>
      )}
    </>
  );
}

// Edición de metadatos de una pérdida: fecha, tipo y nota (producto/cantidad son de solo lectura).
const lossEditSchema = z.object({
  date: z.string().min(1, "Fecha requerida"),
  category: z.enum(["robo", "daño", "devolucion"]),
  reason: z.string().optional(),
});
type LossEditInput = z.infer<typeof lossEditSchema>;

function LossEditForm({ loss, onDone }: { loss: LossRecord; onDone: () => void }) {
  const [updateLoss, { isLoading }] = useUpdateLossMutation();
  const { register, control, handleSubmit, formState: { errors } } = useForm<LossEditInput>({
    resolver: zodResolver(lossEditSchema),
    defaultValues: { date: loss.date, category: (loss.category as LossCategory) ?? "daño", reason: loss.reason || "" },
  });

  async function onSubmit(data: LossEditInput) {
    try {
      await updateLoss({ id: loss.id, ...data }).unwrap();
      toast.success("Pérdida actualizada.");
      onDone();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo actualizar.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2">
      <Field label="Producto" className="sm:col-span-2">
        <input
          className="input opacity-60"
          value={`${loss.productCode ? `${loss.productCode} — ` : ""}${loss.productName ?? ""}`}
          disabled
          readOnly
        />
      </Field>
      <Field label="Fecha" error={errors.date?.message}>
        <DateField control={control} name="date" invalid={!!errors.date} />
      </Field>
      <Field label="Cantidad">
        <input className="input opacity-60" value={loss.quantity ?? ""} disabled readOnly />
      </Field>
      <Field label="Tipo">
        <select className="input" {...register("category")}>
          <option value="daño">Daño</option>
          <option value="robo">Robo</option>
          <option value="devolucion">Devolución</option>
        </select>
      </Field>
      <Field label="Nota (opcional)" className="sm:col-span-2">
        <input className="input" placeholder="Descripción…" {...register("reason")} />
      </Field>
      <p className="text-xs text-muted sm:col-span-2">
        El producto y la cantidad no se editan aquí: afectan el stock y el costo real. Para corregirlos, registra una nueva pérdida.
      </p>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" loading={isLoading}>Guardar cambios</Button>
      </div>
    </form>
  );
}

// ── Gasto operativo ─────────────────────────────────────────────────────────
const expenseSchema = z.object({
  date: z.string().min(1, "Fecha requerida"),
  amount: z.coerce.number().positive("Monto inválido"),
  currency: z.enum(["C$", "USD"]),
  group: z.string().min(1, "Grupo requerido"),
  subcategory: z.string().optional(),
  reason: z.string().optional(),
});
type ExpenseInput = z.infer<typeof expenseSchema>;

function ExpenseForm({ expense, onDone }: { expense?: LossRecord; onDone?: () => void }) {
  const isEdit = !!expense;
  const { data: cats } = useGetExpenseCategoriesQuery();
  const [createExpense, { isLoading: creating }] = useCreateExpenseMutation();
  const [updateExpense, { isLoading: updating }] = useUpdateExpenseMutation();
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
    try {
      if (isEdit) {
        await updateExpense({ id: expense.id, ...data }).unwrap();
        toast.success("Gasto actualizado.");
      } else {
        await createExpense(data).unwrap();
        toast.success("Gasto registrado.");
        reset({ date: today(), currency: "C$", group: "", subcategory: "", amount: undefined as any, reason: "" });
      }
      onDone?.();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo registrar.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn(
        "grid gap-3 sm:grid-cols-2 lg:grid-cols-6",
        !isEdit && "rounded-card border border-border bg-surface p-4",
      )}
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

function ExpenseTable({ data }: { data: LossRecord[] }) {
  const { data: cats } = useGetExpenseCategoriesQuery();
  const [editFor, setEditFor] = useState<LossRecord | null>(null);
  const groupLabel = useMemo(() => {
    const map: Record<string, string> = {};
    (cats?.groups ?? []).forEach((g) => { map[g.key] = g.label; });
    return map;
  }, [cats]);

  const columns = useMemo<ColumnDef<LossRecord, any>[]>(() => [
    { accessorKey: "date", header: "Fecha" },
    { accessorKey: "group", header: "Grupo", cell: (c) => groupLabel[c.getValue() as string] ?? c.getValue() },
    { accessorKey: "subcategory", header: "Subcategoría" },
    { accessorKey: "amount", header: "Monto", cell: (c) => money(c.row.original) },
    { accessorKey: "reason", header: "Nota" },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: (c) => (
        <button
          type="button"
          onClick={() => setEditFor(c.row.original)}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-hover hover:text-text"
          title="Editar gasto"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ),
    },
  ], [groupLabel]);

  return (
    <>
      <DataTable columns={columns} data={data} searchPlaceholder="Buscar gasto…" emptyText="Sin gastos registrados." />
      {editFor && (
        <Modal open={!!editFor} onClose={() => setEditFor(null)} title="Editar gasto">
          <ExpenseForm expense={editFor} onDone={() => setEditFor(null)} />
        </Modal>
      )}
    </>
  );
}

// ── UI helpers ──────────────────────────────────────────────────────────────
function SubTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-pill px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
        active ? "bg-gradient-accent text-white" : "text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
}
