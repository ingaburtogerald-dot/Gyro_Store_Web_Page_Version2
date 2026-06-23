// Tabla Presupuesto vs Gasto por grupo. El "pozo" sale de la reserva de costos fijos
// del periodo; el saldo positivo es ahorro y el negativo (excedente) reduce la ganancia.
import type { BudgetRow } from "~/store/api/reportsApi";
import { formatCordobas } from "~/lib/utils";
import { cn } from "~/lib/utils";

export function BudgetTable({ rows }: { rows: BudgetRow[] }) {
  if (!rows?.length) return null;

  const totals = rows.reduce(
    (acc, r) => ({
      pool: acc.pool + r.pool,
      spent: acc.spent + r.spent,
      excedente: acc.excedente + r.excedente,
    }),
    { pool: 0, spent: 0, excedente: 0 },
  );

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <h3 className="mb-3 font-semibold">Presupuesto vs. Gasto (C$)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="py-2 pr-3 font-medium">Grupo</th>
              <th className="py-2 px-3 text-right font-medium">Presupuesto</th>
              <th className="py-2 px-3 text-right font-medium">Gastado</th>
              <th className="py-2 px-3 text-right font-medium">Saldo</th>
              <th className="py-2 pl-3 text-right font-medium">Afecta ganancia</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.group} className="border-b border-border/50">
                <td className="py-2 pr-3">
                  {r.label}
                  {!r.budgeted && <span className="ml-2 rounded-pill bg-white/5 px-2 py-0.5 text-[10px] text-muted">sin pozo</span>}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-muted">{r.budgeted ? formatCordobas(r.pool) : "—"}</td>
                <td className="py-2 px-3 text-right tabular-nums">{formatCordobas(r.spent)}</td>
                <td className={cn("py-2 px-3 text-right tabular-nums", r.budgeted && (r.saldo < 0 ? "text-rose-400" : "text-emerald-400"))}>
                  {r.budgeted ? formatCordobas(r.saldo) : "—"}
                </td>
                <td className={cn("py-2 pl-3 text-right tabular-nums", r.excedente > 0 ? "text-rose-400" : "text-muted")}>
                  {r.excedente > 0 ? `−${formatCordobas(r.excedente)}` : formatCordobas(0)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-2 pr-3">Total</td>
              <td className="py-2 px-3 text-right tabular-nums text-muted">{formatCordobas(totals.pool)}</td>
              <td className="py-2 px-3 text-right tabular-nums">{formatCordobas(totals.spent)}</td>
              <td className="py-2 px-3 text-right tabular-nums">{formatCordobas(totals.pool - totals.spent)}</td>
              <td className={cn("py-2 pl-3 text-right tabular-nums", totals.excedente > 0 ? "text-rose-400" : "text-muted")}>
                {totals.excedente > 0 ? `−${formatCordobas(totals.excedente)}` : formatCordobas(0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
