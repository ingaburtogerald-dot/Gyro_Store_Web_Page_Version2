import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RequireRole } from "~/components/admin/RequireRole";
import { cn } from "~/lib/utils";
import { useGetCatalogQuery } from "~/store/api/catalogApi";
import { useGetSearchAnalyticsQuery } from "~/store/api/searchAnalyticsApi";

import { Totals } from "~/components/admin/analytics/Totals";
import { TrafficVsSearchChart } from "~/components/admin/analytics/TrafficVsSearchChart";
import { TrafficByProductChart } from "~/components/admin/analytics/TrafficByProductChart";
import { TopSearchesPanel, ZeroResultsPanel } from "~/components/admin/analytics/Lists";
import { LoadingState } from "~/components/admin/analytics/shared";
import { SessionsDrawer } from "~/components/admin/analytics/SessionsDrawer";
import { SearchesLogDrawer } from "~/components/admin/analytics/SearchesLogDrawer";

const RANGES = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
];

export default function AdminBusquedas() {
  const [days, setDays] = useState(30);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const { data, isLoading, isFetching } = useGetSearchAnalyticsQuery({ days });
  const { data: products = [] } = useGetCatalogQuery();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const nameById = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);

  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text">Analíticas del Storefront</h1>
            <p className="text-muted">
              Tráfico real y comportamiento de búsqueda de tus clientes.
            </p>
          </div>
          <div className="flex gap-1 rounded-pill border border-border bg-surface p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setDays(r.days)}
                className={cn(
                  "rounded-pill px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  days === r.days ? "bg-accent text-bg" : "text-muted hover:text-text",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading || !data ? (
          <LoadingState />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            aria-busy={isFetching}
            className={cn("space-y-6 transition-opacity duration-200", isFetching && "pointer-events-none opacity-50")}
          >
            <Totals data={data} onOpenSessions={() => setDrawerOpen(true)} onOpenSearches={() => setSearchDrawerOpen(true)} />
            <TrafficVsSearchChart data={data} mounted={mounted} />
            <div className="grid gap-4 lg:grid-cols-2">
              <TopSearchesPanel data={data} />
              <ZeroResultsPanel data={data} />
            </div>
            <TrafficByProductChart data={data} nameById={nameById} mounted={mounted} />
            {data.totals.capped && (
              <p className="text-center text-xs text-muted">
                Mostrando una muestra de los eventos más recientes (hay más datos en el rango).
              </p>
            )}
          </motion.div>
        )}
        <SessionsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} days={days} />
        <SearchesLogDrawer open={searchDrawerOpen} onClose={() => setSearchDrawerOpen(false)} days={days} />
      </div>
    </RequireRole>
  );
}
