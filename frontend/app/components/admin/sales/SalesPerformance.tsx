// Panel comparativo de performance por vendedor.
import { useMemo } from "react";
import { useGetPerformanceQuery } from "~/store/api/salesApi";
import { SellerPerformanceCard } from "./SellerPerformanceCard";

export function SalesPerformance({ selectedMonth }: { selectedMonth: string }) {
  const isAll = selectedMonth === "all";
  const [y, m] = isAll ? [0, 0] : selectedMonth.split("-").map(Number);
  const { data: queryData, isLoading } = useGetPerformanceQuery(isAll ? { allTime: true } : { year: y, month: m - 1 });
  
  const data = queryData?.data || [];
  const companyTotalSales = queryData?.companyTotalSales || 0;

  // Ordenar de mayor a menor por Total Vendido
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.totalVendido - a.totalVendido);
  }, [data]);

  if (isLoading) return <div className="h-40 animate-pulse rounded-card border border-border bg-surface" />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">Desempeño de Vendedores</h2>
        <p className="text-sm text-muted">Comparativa del volumen de ventas y comisiones para el mes actual.</p>
      </div>
      
      {sortedData.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted">
          No hay datos de rendimiento para el período seleccionado.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sortedData.map((performance, index) => (
            <SellerPerformanceCard 
              key={performance.sellerEmail} 
              performance={performance}
              companyTotalSales={companyTotalSales}
              rank={index + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
