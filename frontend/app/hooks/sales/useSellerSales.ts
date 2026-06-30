// ─────────────────────────────────────────────────────────────────────────────
// Capa de Aplicación — Orquestador de la vista "Mis ventas" del vendedor.
//
// Encapsula RTK Query (lista paginada, ya limitada al vendedor por el backend), el
// estado en URL (filtro de estado + página) y el estado local del detalle. Expone un
// objeto `pagination` con el shape que consume el <Pagination/> compartido.
// El container resultante es 100% presentacional.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from "react";
import { useSearchParams } from "@remix-run/react";
import { useGetSalesPaginatedQuery, type Sale, type SaleStatus } from "~/store/api/salesApi";
import type { PaginationProps } from "~/components/shared/sales/Pagination";

export type SellerStatusFilter = "all" | SaleStatus;

const VALID_STATUSES: SellerStatusFilter[] = [
  "all", "pending_approval", "approved", "paid", "rejected",
];

const PAGE_SIZE = 50;

export function useSellerSales(selectedMonth: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [detail, setDetail] = useState<Sale | null>(null);

  const rawStatus = searchParams.get("status") ?? "";
  const status: SellerStatusFilter = VALID_STATUSES.includes(rawStatus as SellerStatusFilter)
    ? (rawStatus as SellerStatusFilter)
    : "all";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));

  function patch(updates: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(updates)) {
          if (v === null) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );
  }

  const { data, isLoading } = useGetSalesPaginatedQuery({
    page,
    limit: PAGE_SIZE,
    date: selectedMonth,
  });

  const sales = useMemo(() => {
    const list = data?.data ?? [];
    return status === "all" ? list : list.filter((s) => s.status === status);
  }, [data, status]);

  const pagination: PaginationProps = {
    page,
    totalPages: data?.totalPages ?? 1,
    onPageChange: (p) => patch({ page: String(p) }),
  };

  return {
    sales,
    isLoading,
    status,
    setStatus: (s: SellerStatusFilter) => patch({ status: s === "all" ? null : s, page: null }),
    detail,
    setDetail,
    pagination,
  };
}
