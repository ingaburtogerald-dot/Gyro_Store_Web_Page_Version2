import { formatCordobas } from "~/lib/utils";
import type { SellerPerformance } from "~/store/api/salesApi";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function SellerPerformanceCard({
  performance,
  companyTotalSales,
  isSellerView = false,
  rank = 0,
}: {
  performance: SellerPerformance;
  companyTotalSales: number;
  isSellerView?: boolean;
  rank?: number; // 1, 2, 3 for medals
}) {
  const percent = companyTotalSales > 0 ? (performance.totalVendido / companyTotalSales) * 100 : 0;
  
  // Anillo SVG
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_4px_20px_rgba(0,0,0,0.1)] transition-transform hover:scale-[1.01]">
      <div className="flex items-center justify-between border-b border-border/50 bg-surface-2/40 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-accent text-sm font-bold text-white shadow-inner">
              {isSellerView ? "Tú" : initials(performance.sellerName)}
            </span>
            {!isSellerView && rank === 1 && (
              <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 text-xs shadow-md">🥇</span>
            )}
            {!isSellerView && rank === 2 && (
              <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-xs shadow-md">🥈</span>
            )}
            {!isSellerView && rank === 3 && (
              <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-600 text-xs shadow-md">🥉</span>
            )}
          </div>
          <div>
            <h3 className="font-bold text-text">{isSellerView ? "Mi Desempeño" : performance.sellerName}</h3>
            <p className="text-xs text-muted">{performance.ventas} ventas completadas</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 p-5">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
          <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 80 80">
            <circle
              className="text-border"
              strokeWidth="6"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="40"
              cy="40"
            />
            <circle
              className="text-accent drop-shadow-[0_0_6px_rgba(139,92,246,0.5)] transition-all duration-1000 ease-out"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="40"
              cy="40"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-lg font-bold text-text">{Math.round(percent)}%</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-4">
          <div>
            <p className="text-xs font-semibold text-muted">Total Vendido</p>
            <p className="text-xl font-bold text-text">{formatCordobas(performance.totalVendido)}</p>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Comisión</p>
              <p className="font-bold text-whatsapp drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]">{formatCordobas(performance.comisiones)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Ticket Prom.</p>
              <p className="font-bold text-text">{formatCordobas(performance.ticketPromedio)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
