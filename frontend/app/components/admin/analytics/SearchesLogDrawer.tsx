import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { X, Smartphone, Monitor, Bot, MousePointerClick, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Skeleton } from "~/components/ui/Skeleton";
import { cn } from "~/lib/utils";
import { useGetRawSearchesQuery } from "~/store/api/searchAnalyticsApi";
import { EmptyRows } from "./shared";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

interface SearchLogItem {
  id: string;
  query: string;
  resultsCount: number;
  clickedProductId: string | null;
  timestamp: string;
  ip: string;
  deviceType: string;
}

export function SearchesLogDrawer({ open, onClose, days }: { open: boolean; onClose: () => void; days: number }) {
  const { data, isLoading } = useGetRawSearchesQuery({ days }, { skip: !open });
  const [sorting, setSorting] = useState<SortingState>([]);

  const searchesData = useMemo(() => data?.searches || [], [data?.searches]);

  const columns = useMemo<ColumnDef<SearchLogItem>[]>(
    () => [
      {
        accessorKey: "query",
        header: "Término de Búsqueda",
        cell: (info) => {
          const query = info.getValue() as string;
          const clicked = info.row.original.clickedProductId;
          return (
            <div className="flex items-center gap-2 max-w-[200px] sm:max-w-none">
              <span className="font-semibold text-text truncate block">
                "{query}"
              </span>
              {clicked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold text-accent shrink-0" title="Clic en producto (CTR)">
                  <MousePointerClick className="h-3 w-3" /> CTR
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "resultsCount",
        header: "Resultados",
        cell: (info) => {
          const count = info.getValue() as number;
          const isZero = count === 0;
          return (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
              isZero ? "bg-danger/15 text-danger border border-danger/20 animate-pulse" : "bg-badge/15 text-badge"
            )}>
              {count} res
            </span>
          );
        },
      },
      {
        accessorKey: "clickedProductId",
        header: "Clics (CTR)",
        cell: (info) => {
          const clicked = Boolean(info.getValue());
          return (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              clicked ? "bg-accent/15 text-accent border border-accent/20" : "bg-surface-2 border border-border/50 text-muted"
            )}>
              {clicked ? "Sí" : "No"}
            </span>
          );
        },
      },
      {
        accessorKey: "timestamp",
        header: "Fecha/Hora",
        cell: (info) => {
          const val = info.getValue() as string;
          return (
            <div className="flex flex-col text-[11px] text-muted">
              <span className="font-semibold text-text/80">
                {new Date(val).toLocaleDateString("es-NI", { month: "short", day: "numeric" })}
              </span>
              <span className="text-[10px]">
                {new Date(val).toLocaleTimeString("es-NI", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "deviceType",
        header: "Dispositivo",
        cell: (info) => {
          const dev = info.getValue() as string;
          return (
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted uppercase tracking-wider">
              {dev === 'Mobile' ? <Smartphone className="h-3.5 w-3.5 text-accent-2" /> :
               dev === 'Desktop' ? <Monitor className="h-3.5 w-3.5 text-accent-2" /> :
               <Bot className="h-3.5 w-3.5 text-warning" />}
              <span className="hidden sm:inline">{dev}</span>
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: searchesData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="flex h-full w-full max-w-4xl flex-col bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4 bg-surface/50 backdrop-blur-md">
          <div>
            <h2 className="text-xl font-bold text-text">Historial de Búsquedas</h2>
            <p className="text-xs text-muted">Auditoría en tabla interactiva para marketing y CTR</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-surface-2 p-2 text-muted hover:text-text hover:bg-border transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          ) : searchesData.length === 0 ? (
            <EmptyRows text="No hay búsquedas registradas en este rango." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-premium">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b border-border/80 bg-surface-2/40">
                      {headerGroup.headers.map((header) => {
                        const isSorted = header.column.getIsSorted();
                        return (
                          <th
                            key={header.id}
                            className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted select-none cursor-pointer hover:text-text hover:bg-surface-2 transition-colors"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <div className="flex items-center gap-1.5">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getCanSort() && (
                                isSorted === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5 text-accent shrink-0" />
                                ) : isSorted === "desc" ? (
                                  <ArrowDown className="h-3.5 w-3.5 text-accent shrink-0" />
                                ) : (
                                  <ArrowUpDown className="h-3.5 w-3.5 opacity-30 hover:opacity-100 shrink-0" />
                                )
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row, idx) => {
                    const isZero = row.original.resultsCount === 0;
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "border-b border-border/40 hover:bg-surface-hover/70 transition-colors",
                          idx % 2 === 1 ? "bg-surface-2/20" : "",
                          isZero ? "bg-danger/5 hover:bg-danger/10 border-l-2 border-l-danger" : ""
                        )}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3.5 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
