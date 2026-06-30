// ───────────────────────────────────────────────────────────────────────────
// useSalesDashboard — cerebro del Dashboard de Ventas (Separation of Concerns).
//
// Centraliza el ESTADO compartido del dashboard (filtros en URL: fecha + vendedor)
// y lo expone vía Context para que CADA widget se auto-fetchee con esos filtros,
// en lugar de que un componente padre cargue todo y haga prop-drilling.
//
// El layout (AdminSalesDashboard) y los widgets quedan puramente presentacionales:
//   - leen filtros con useSalesDashboard()
//   - disparan su propia query de RTK Query (skip/cache la maneja RTK)
//
// NO toca PendingSales / AdminSalesHistory (siguen funcionando como antes).
// ───────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSearchParams } from "@remix-run/react";
import { useGetUsersQuery } from "~/store/api/usersApi";
import { useGetSalesTimeseriesQuery, type TimeseriesPoint } from "~/store/api/salesApi";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin } from "~/store/slices/authSlice";
import type { FilterSelectOption } from "~/components/ui/FilterSelect";

/** Filtros globales del dashboard. Reusa los MISMOS params del resto del módulo. */
export interface SalesFilters {
  /** "all" | ISO date | token de mes — igual que AdminSales. */
  date: string;
  /** "all" | email del vendedor. */
  seller: string;
}

interface SalesDashboardValue {
  filters: SalesFilters;
  setDate: (value: string) => void;
  setSeller: (value: string) => void;
  /** Opciones listas para <FilterSelect> (incluye "Todos los vendedores"). */
  sellerOptions: FilterSelectOption[];
  /** true = admin/global_admin; false = vendedor (vista enfocada a sí mismo). */
  isAdmin: boolean;
}

const SalesDashboardContext = createContext<SalesDashboardValue | null>(null);

/**
 * Provider: dueño ÚNICO del estado de filtros (lo persiste en la URL con replace,
 * para que recargar / compartir el link conserve la vista sin ensuciar el historial).
 */
export function SalesDashboardProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<SalesFilters>(
    () => ({
      date: searchParams.get("date") || "all",
      seller: searchParams.get("seller") || "all",
    }),
    [searchParams],
  );

  function patchParam(key: string, value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (!value || value === "all") next.delete(key);
        else next.set(key, value);
        next.delete("page"); // cualquier cambio de filtro reinicia la paginación
        return next;
      },
      { replace: true },
    );
  }

  const isAdmin = useAppSelector(selectIsAdmin);

  // Los vendedores no necesitan el catálogo de usuarios (solo se ven a sí mismos).
  const { data: users = [] } = useGetUsersQuery(undefined, { skip: !isAdmin });

  const sellerOptions = useMemo<FilterSelectOption[]>(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      const canSell =
        u.roles.includes("seller") || u.roles.includes("admin") || u.roles.includes("global_admin");
      if (u.email && u.displayName && canSell) map.set(u.email, u.displayName);
    }
    return [
      { value: "all", label: "Todos los vendedores" },
      ...Array.from(map.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [users]);

  const value = useMemo<SalesDashboardValue>(
    () => ({
      filters,
      setDate: (v) => patchParam("date", v),
      setSeller: (v) => patchParam("seller", v),
      sellerOptions,
      isAdmin,
    }),
    // patchParam es estable salvo por setSearchParams; filters/sellerOptions/isAdmin cubren los cambios
    [filters, sellerOptions, isAdmin], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return <SalesDashboardContext.Provider value={value}>{children}</SalesDashboardContext.Provider>;
}

/** Hook de consumo. Falla rápido si se usa fuera del Provider (evita bugs silenciosos). */
export function useSalesDashboard(): SalesDashboardValue {
  const ctx = useContext(SalesDashboardContext);
  if (!ctx) {
    throw new Error("useSalesDashboard debe usarse dentro de <SalesDashboardProvider>.");
  }
  return ctx;
}

// ───────────────────────────────────────────────────────────────────────────
// Serie temporal del gráfico de rendimiento.
//
// Datos REALES vía GET /sales/timeseries (agregado por día en el backend, con
// relleno de ceros y alcance por rol). Thin wrapper sobre la query de RTK para
// mantener un contrato estable hacia el widget.
// ───────────────────────────────────────────────────────────────────────────
export type { TimeseriesPoint };

export interface TimeseriesResult {
  data: TimeseriesPoint[];
  /** "month" cuando no hay filtro (vista anual); "day" para un mes/día concreto. */
  granularity: "day" | "month";
  isLoading: boolean;
  isMock: boolean;
}

export function useSalesTimeseries(filters: SalesFilters): TimeseriesResult {
  const { data, isLoading } = useGetSalesTimeseriesQuery({
    date: filters.date,
    sellerEmail: filters.seller,
  });
  return {
    data: data?.data ?? [],
    granularity: data?.granularity ?? "day",
    isLoading,
    isMock: data?.isMock ?? false,
  };
}
