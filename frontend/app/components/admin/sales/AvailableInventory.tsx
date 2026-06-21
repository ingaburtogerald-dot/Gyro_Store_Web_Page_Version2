import { useState, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Settings, ChevronRight } from "lucide-react";
import { useGetAvailableInventoryQuery } from "~/store/api/inventoryApi";
import { useGetPricingConfigQuery, type Discount } from "~/store/api/salesApi";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin } from "~/store/slices/authSlice";
import { formatCordobas } from "~/lib/utils";
import { DataTable } from "~/components/ui/DataTable";
import { Modal } from "~/components/ui/Modal";
import { PricingConfigModal } from "./PricingConfigModal";

export function AvailableInventory() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const { data: inventory = [], isLoading: loadingInv } = useGetAvailableInventoryQuery();
  const { data: pricingConfig, isLoading: loadingPricing } = useGetPricingConfigQuery();
  const [configOpen, setConfigOpen] = useState(false);

  const discounts = pricingConfig?.wholesaleDiscounts || [
    { minQty: 2, maxQty: 2, discountPercent: 3 },
    { minQty: 3, maxQty: 5, discountPercent: 5 },
    { minQty: 6, maxQty: 11, discountPercent: 10 },
    { minQty: 12, maxQty: null, discountPercent: 15 }
  ];

  const columns = useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Código",
        sortingFn: "alphanumeric",
      },
      {
        accessorKey: "productName",
        header: "Nombre",
        cell: (c) => <span className="font-medium text-text">{c.getValue()}</span>,
      },
      {
        accessorKey: "available",
        header: "Cantidad disponible",
        cell: (c) => (
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            {c.getValue()} uds
          </span>
        )
      },
      {
        accessorKey: "suggestedPrice",
        header: "Precio sugerido (C$)",
        cell: (c) => (
          <span className="font-bold text-whatsapp">
            {formatCordobas(c.getValue() || 0)}
          </span>
        )
      },
      {
        id: "wholesale",
        header: "Precio por mayor",
        cell: (c) => {
          const row = c.row.original;
          return (
            <WholesaleCell
              suggested={row.suggestedPrice || 0}
              discounts={discounts}
              code={row.code}
              productName={row.productName}
            />
          );
        }
      }
    ],
    [discounts]
  );

  return (
    <div className="space-y-4 rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text">Inventario Disponible</h2>
          <p className="text-xs text-muted">Stock actual listo para entrega en bodega.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setConfigOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-accent-2/30 bg-accent-2/10 px-3 py-1.5 text-xs font-medium text-accent-2 transition-all hover:bg-accent-2/20"
            title="Configurar descuentos por mayor"
          >
            <Settings className="h-3.5 w-3.5" />
            Configuración
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={inventory}
        isLoading={loadingInv || loadingPricing}
        searchPlaceholder="Buscar productos en bodega…"
        emptyText="No hay inventario disponible en bodega."
        initialSorting={[{ id: "code", desc: false }]}
        mobileCard={(row) => (
          <div className="space-y-2 rounded-card border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">{row.code}</span>
                <p className="mt-1 font-medium text-text">{row.productName}</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                {row.available} uds
              </span>
            </div>
            <div className="flex items-end justify-between border-t border-border pt-2">
              <div>
                <span className="block text-[10px] uppercase text-muted">Precio sugerido</span>
                <span className="font-bold text-whatsapp">{formatCordobas(row.suggestedPrice || 0)}</span>
              </div>
              <WholesaleCell
                suggested={row.suggestedPrice || 0}
                discounts={discounts}
                code={row.code}
                productName={row.productName}
              />
            </div>
          </div>
        )}
      />

      {configOpen && (
        <PricingConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
      )}
    </div>
  );
}

function WholesaleCell({
  suggested,
  discounts,
  code,
  productName,
}: {
  suggested: number;
  discounts: Discount[];
  code?: string;
  productName?: string;
}) {
  const [open, setOpen] = useState(false);

  const maxDiscount = useMemo(() => {
    return discounts.length > 0 ? Math.max(...discounts.map((d) => d.discountPercent)) : 0;
  }, [discounts]);

  const minPrice = useMemo(() => {
    return Math.round(suggested * (1 - maxDiscount / 100));
  }, [suggested, maxDiscount]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-accent-2/30 bg-accent-2/5 px-2.5 py-1 text-xs font-bold text-accent-2 transition-all hover:bg-accent-2/15 active:scale-95 whitespace-nowrap"
      >
        <span>Desde {formatCordobas(minPrice)}</span>
        <ChevronRight className="h-3 w-3" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={code ? `Precios por mayor · [${code}]` : "Precios por mayor"}
      >
        <div className="space-y-4">
          {productName && <p className="text-sm font-medium text-text">{productName}</p>}

          <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <span className="text-muted">Precio sugerido (1 ud)</span>
            <span className="font-bold text-whatsapp">{formatCordobas(suggested)}</span>
          </div>

          <div>
            <div className="flex justify-between border-b border-border/50 pb-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted">
              <span>Rango</span>
              <span>Precio unitario</span>
            </div>
            <div className="mt-2 space-y-2.5">
              {discounts.map((d, i) => {
                const qtyText = d.maxQty ? `${d.minQty}–${d.maxQty} uds` : `${d.minQty}+ uds`;
                const price = Math.round(suggested * (1 - d.discountPercent / 100));
                return (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted">{qtyText}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text">{formatCordobas(price)}</span>
                      <span className="rounded-pill bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                        -{d.discountPercent}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
