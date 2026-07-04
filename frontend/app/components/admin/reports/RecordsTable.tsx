// Tabla unificada de movimientos (pérdidas + gastos) con chips de filtro y un único
// modal de edición que renderiza el form correcto según el tipo del registro.
import { useMemo, useState } from "react";
import { DataTable } from "~/components/ui/DataTable";
import { Modal } from "~/components/ui/Modal";
import { cn } from "~/lib/utils";
import { useGetExpenseCategoriesQuery, type LossRecord } from "~/store/api/reportsApi";
import { createRecordColumns } from "./recordsColumns";
import { LossEditForm } from "./losses/LossEditForm";
import { ExpenseForm } from "./expenses/ExpenseForm";

type Filter = "all" | "loss" | "expense";

const CHIPS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "loss", label: "Pérdidas" },
  { id: "expense", label: "Gastos" },
];

export function RecordsTable({ records }: { records: LossRecord[] }) {
  const { data: cats } = useGetExpenseCategoriesQuery();
  const [filter, setFilter] = useState<Filter>("all");
  const [editFor, setEditFor] = useState<LossRecord | null>(null);

  const groupLabel = useMemo(() => {
    const map: Record<string, string> = {};
    (cats?.groups ?? []).forEach((g) => { map[g.key] = g.label; });
    return map;
  }, [cats]);

  const filtered = useMemo(() => {
    if (filter === "all") return records;
    if (filter === "expense") return records.filter((r) => r.kind === "expense");
    return records.filter((r) => r.kind !== "expense");
  }, [records, filter]);

  const columns = useMemo(() => createRecordColumns(setEditFor, groupLabel), [groupLabel]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((c) => {
          const active = filter === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={cn(
                "rounded-pill border px-3 py-1.5 text-xs font-semibold transition-colors",
                active ? "border-accent-2 bg-accent-2/10 text-accent-2" : "border-border text-muted hover:text-text",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <DataTable columns={columns} data={filtered} searchPlaceholder="Buscar movimiento…" emptyText="Sin movimientos registrados." />

      {editFor && (
        <Modal open={!!editFor} onClose={() => setEditFor(null)} title={editFor.kind === "expense" ? "Editar gasto" : "Editar pérdida"}>
          {editFor.kind === "expense" ? (
            <ExpenseForm expense={editFor} onDone={() => setEditFor(null)} />
          ) : (
            <LossEditForm loss={editFor} onDone={() => setEditFor(null)} />
          )}
        </Modal>
      )}
    </div>
  );
}
