// Tabla de datos genérica sobre TanStack Table v8: ordenable, con búsqueda
// global y paginación. Se reutiliza en todos los portales del admin.
import { useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { Search, Check, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { TableSkeleton } from "./Skeleton";
import { cn } from "~/lib/utils";

// Alineación por columna vía `meta` (texto a la izquierda, números a la derecha).
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "left" | "right" | "center";
  }
}

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  searchPlaceholder?: string;
  pageSize?: number;
  emptyText?: ReactNode;
  isLoading?: boolean;
  initialSorting?: SortingState;
  onRowClick?: (row: T) => void;
  selectedRowId?: string | number | null;
  selectedRowIds?: Set<string | number>;
  onSelectAll?: (selectAll: boolean) => void;
  allSelected?: boolean;
  hideSearch?: boolean;
  globalFilterValue?: string;
  onGlobalFilterChange?: (value: string) => void;
  // Si se provee, en móvil se renderiza cada fila como tarjeta (la tabla queda solo en desktop).
  mobileCard?: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder = "Buscar…",
  emptyText = "Sin registros.",
  isLoading = false,
  initialSorting = [],
  onRowClick,
  selectedRowId,
  selectedRowIds,
  onSelectAll,
  allSelected,
  hideSearch = false,
  globalFilterValue,
  onGlobalFilterChange,
  mobileCard,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [internalGlobalFilter, setInternalGlobalFilter] = useState("");

  const globalFilter = globalFilterValue !== undefined ? globalFilterValue : internalGlobalFilter;
  const setGlobalFilter = onGlobalFilterChange || setInternalGlobalFilter;

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // Sin paginación: se muestran TODAS las filas (la tabla scrollea dentro de su contenedor).
  });

  return (
    <div className="space-y-3">
      {!hideSearch && (
        <div className="flex items-center gap-2 rounded-pill border border-border bg-surface px-3 sm:max-w-xs">
          <Search className="h-4 w-4 text-muted" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted"
          />
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={6} cols={onRowClick ? columns.length + 1 : columns.length} />
      ) : (
      <>
      <div className="hidden md:block overflow-auto max-h-[75vh] rounded-card border border-border bg-surface shadow-premium relative">
        <table className="w-full text-sm">
          <thead className="table-header-brand text-left sticky top-0 z-20 shadow-sm">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {onRowClick && (
                  <th className="w-10 px-3 py-2.5">
                    {onSelectAll && (
                      <div
                        onClick={() => onSelectAll(!allSelected)}
                        className={`flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded border transition-colors ${
                          allSelected
                            ? "border-accent-2 bg-accent-2 text-white"
                            : "border-border bg-surface hover:bg-surface-2"
                        }`}
                      >
                        {allSelected && <Check className="h-3.5 w-3.5" />}
                      </div>
                    )}
                  </th>
                )}
                {hg.headers.map((header) => {
                  const align = header.column.columnDef.meta?.align;
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className={cn(
                        "whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted",
                        align === "right" && "text-right",
                        align === "center" && "text-center",
                      )}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          className={cn(
                            "group/sort flex w-full items-center gap-1 cursor-pointer select-none hover:text-text",
                            align === "right" && "justify-end",
                            align === "center" && "justify-center",
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="h-3 w-3 shrink-0 text-accent-2" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="h-3 w-3 shrink-0 text-accent-2" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/sort:opacity-50" />
                          )}
                        </button>
                      ) : (
                        <div
                          className={cn(
                            "flex items-center gap-1",
                            align === "right" && "justify-end",
                            align === "center" && "justify-center",
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={onRowClick ? columns.length + 1 : columns.length} className="px-3 py-10 text-center text-muted">
                  {emptyText}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, idx) => {
                const rowId = (row.original as any).id;
                const isSelected =
                  (selectedRowIds && selectedRowIds.has(rowId)) ||
                  (selectedRowId && rowId === selectedRowId);
                return (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick?.(row.original)}
                    className={`border-t border-border/50 transition-colors ${
                      onRowClick ? "cursor-pointer" : ""
                    } ${
                      isSelected
                        ? "bg-accent-2/10 hover:bg-accent-2/20"
                        : `${idx % 2 === 1 ? "bg-surface-2/50" : ""} hover:bg-surface-2/80`
                    }`}
                  >
                    {onRowClick && (
                      <td className="w-10 px-3 py-2.5">
                        <div
                          className={`flex h-[18px] w-[18px] items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? "border-accent-2 bg-accent-2 text-white"
                              : "border-border bg-surface"
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </div>
                      </td>
                    )}
                    {row.getVisibleCells().map((cell) => {
                      const align = cell.column.columnDef.meta?.align;
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "nums whitespace-nowrap px-3 py-2.5",
                            align === "right" && "text-right",
                            align === "center" && "text-center",
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
          {table.getFooterGroups().some(fg => fg.headers.some(h => h.column.columnDef.footer)) && (
            <tfoot className="sticky bottom-0 z-20 bg-bg/80 backdrop-blur-md border-t border-border shadow-[0_-5px_20px_rgba(0,0,0,0.25)] font-bold">
              {table.getFooterGroups().map((fg) => (
                <tr key={fg.id}>
                  {onRowClick && <td className="px-3 py-2.5"></td>}
                  {fg.headers.map((header) => {
                    const align = header.column.columnDef.meta?.align;
                    return (
                      <td
                        key={header.id}
                        className={cn(
                          "nums whitespace-nowrap px-3 py-2.5",
                          align === "right" && "text-right",
                          align === "center" && "text-center",
                        )}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tfoot>
          )}
        </table>
      </div>
      {/* Vista móvil: tarjetas (bonitas si el panel define mobileCard; genéricas si no). */}
      <div className="space-y-3 md:hidden">
        {table.getRowModel().rows.length === 0 ? (
          <p className="rounded-card border border-border bg-surface shadow-premium py-8 text-center text-muted">{emptyText}</p>
        ) : (
          table.getRowModel().rows.map((row) => {
            const rowId = (row.original as any).id;
            const isSelected =
              (selectedRowIds && selectedRowIds.has(rowId)) || (selectedRowId && rowId === selectedRowId);
            return (
              <div
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={`${onRowClick ? "cursor-pointer " : ""}${isSelected ? "rounded-card ring-2 ring-accent-2" : ""}`}
              >
                {mobileCard ? (
                  mobileCard(row.original)
                ) : (
                  <div className="space-y-1.5 rounded-card border border-border bg-surface shadow-premium p-4">
                    {row.getVisibleCells().map((cell) => {
                      const header = cell.column.columnDef.header;
                      const label = typeof header === "string" ? header : "";
                      return (
                        <div key={cell.id} className="flex items-start justify-between gap-3 text-sm">
                          {label ? <span className="shrink-0 pt-0.5 text-xs text-muted">{label}</span> : <span />}
                          <div className="min-w-0 text-right">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      </>
      )}
    </div>
  );
}
