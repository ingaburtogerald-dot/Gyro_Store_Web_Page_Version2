import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { ConfigSection } from "./shared";
import { useUpdatePricingConfigMutation } from "~/store/api/salesApi";
import type { Discount } from "~/store/api/salesApi";

export function WholesaleDiscountsForm({ config }: { config: any }) {
  const [updatePricing, { isLoading: savingPricing }] = useUpdatePricingConfigMutation();
  const [discounts, setDiscounts] = useState<Discount[]>([]);

  useEffect(() => {
    if (!config) return;
    setDiscounts(config.wholesaleDiscounts || []);
  }, [config]);

  const isPricingChanged = useMemo(() => {
    if (!config) return false;
    const original = config.wholesaleDiscounts || [];
    if (discounts.length !== original.length) return true;
    return discounts.some((d, i) => {
      const orig = original[i];
      if (!orig) return true;
      return (
        d.minQty !== orig.minQty ||
        d.maxQty !== orig.maxQty ||
        d.discountPercent !== orig.discountPercent
      );
    });
  }, [config, discounts]);

  function updateDiscount(i: number, field: keyof Discount, value: string) {
    setDiscounts((prev) =>
      prev.map((d, idx) =>
        idx === i ? { ...d, [field]: field === "maxQty" && value === "" ? null : Number(value) } : d
      )
    );
  }

  async function savePricing(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updatePricing({ wholesaleDiscounts: discounts }).unwrap();
      toast.success("Descuentos por mayor actualizados.");
    } catch {
      toast.error("No se pudo guardar.");
    }
  }

  return (
    <ConfigSection
      title="Descuentos por mayor"
      description="Rangos de cantidad con su descuento automático. Se aplican al cotizar y al registrar ventas cuando el cliente compra por volumen."
    >
      <form onSubmit={savePricing} className="space-y-3">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted">Mín. unidades</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted">Máx. unidades</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted">Descuento (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {discounts.map((d, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      className="input py-1 text-sm"
                      value={d.minQty}
                      onChange={(e) => updateDiscount(i, "minQty", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      placeholder="Sin límite"
                      className="input py-1 text-sm"
                      value={d.maxQty ?? ""}
                      onChange={(e) => updateDiscount(i, "maxQty", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      className="input py-1 text-sm"
                      value={d.discountPercent}
                      onChange={(e) => updateDiscount(i, "discountPercent", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={savingPricing} disabled={!isPricingChanged} className="flex items-center gap-2">
            <Save className="h-4 w-4" /> Guardar descuentos
          </Button>
        </div>
      </form>
    </ConfigSection>
  );
}
