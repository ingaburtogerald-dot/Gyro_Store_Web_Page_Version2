// Tabla de datos genérica sobre TanStack Table v8: ordenable, con búsqueda
// global y paginación. Se reutiliza en todos los portales del admin.
import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, Check } from "lucide-react";
import { TableSkeleton } from "./Skeleton";

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  searchPlaceholder?: string;
  pageSize?: number;
  emptyText?: string;
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
}

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder = "Buscar…",
  pageSize = 50,
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
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
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
      <div className="overflow-auto max-h-[75vh] rounded-card border border-border bg-surface relative">
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
                {hg.headers.map((header) => (
                  <th key={header.id} className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {header.isPlaceholder ? null : (
                      <button
                        className={`flex items-center gap-1 ${header.column.getCanSort() ? "cursor-pointer select-none hover:text-text" : ""}`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                      </button>
                    )}
                  </th>
                ))}
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
                    className={`border-t border-border transition-colors ${
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
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="nums whitespace-nowrap px-3 py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
          {table.getFooterGroups().some(fg => fg.headers.some(h => h.column.columnDef.footer)) && (
            <tfoot className="sticky bottom-0 z-20 bg-background/60 backdrop-blur-md border-t border-white/10 shadow-[0_-5px_20px_rgba(0,0,0,0.25)] font-bold">
              {table.getFooterGroups().map((fg) => (
                <tr key={fg.id}>
                  {onRowClick && <td className="px-3 py-2.5"></td>}
                  {fg.headers.map((header) => (
                    <td key={header.id} className="whitespace-nowrap px-3 py-2.5">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tfoot>
          )}
        </table>
      </div>
      )}

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-lg border border-border p-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-lg border border-border p-1.5 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
