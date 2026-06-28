import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { Plus, Trash2, Save } from "lucide-react";
import {
  useGetPricingConfigQuery,
  useGetBusinessConfigQuery,
  useUpdatePricingConfigMutation,
  useUpdateCostosFijosMutation,
  type Discount,
  type CostosFijos
} from "~/store/api/salesApi";

interface PricingConfigModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: "pricing" | "business";
}

export function PricingConfigModal({ open, onClose, initialTab = "pricing" }: PricingConfigModalProps) {
  const [activeTab, setActiveTab] = useState<"pricing" | "business">(initialTab);

  // Queries
  const { data: pricingData } = useGetPricingConfigQuery(undefined, { skip: !open });
  const { data: businessData } = useGetBusinessConfigQuery(undefined, { skip: !open });

  // Mutations
  const [updatePricing, { isLoading: savingPricing }] = useUpdatePricingConfigMutation();
  const [updateBusiness, { isLoading: savingBusiness }] = useUpdateCostosFijosMutation();

  // Local states
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [costosFijos, setCostosFijos] = useState<CostosFijos>({
    publicidad: 0,
    utiles: 0,
    servicios: 0,
    garantias: 0
  });

  // Load queries data into state
  useEffect(() => {
    if (pricingData?.wholesaleDiscounts) {
      setDiscounts(pricingData.wholesaleDiscounts);
    }
  }, [pricingData]);

  useEffect(() => {
    if (businessData?.costosFijos) {
      setCostosFijos(businessData.costosFijos);
    }
  }, [businessData]);

  // Calculate sum of costos fijos
  const totalCostosFijos = 
    (Number(costosFijos.publicidad) || 0) +
    (Number(costosFijos.utiles) || 0) +
    (Number(costosFijos.servicios) || 0) +
    (Number(costosFijos.garantias) || 0);

  // Discount handlers
  function handleDiscountChange(index: number, field: keyof Discount, value: any) {
    setDiscounts((prev) =>
      prev.map((d, i) => {
        if (i === index) {
          if (field === "maxQty" && value === "") {
            return { ...d, [field]: null };
          }
          return { ...d, [field]: value === null ? null : Number(value) };
        }
        return d;
      })
    );
  }

  function addDiscountRow() {
    setDiscounts((prev) => [...prev, { minQty: 1, maxQty: null, discountPercent: 0 }]);
  }

  function removeDiscountRow(index: number) {
    setDiscounts((prev) => prev.filter((_, i) => i !== index));
  }

  // Save handlers
  async function savePricing() {
    try {
      await updatePricing({ wholesaleDiscounts: discounts }).unwrap();
      toast.success("Descuentos por mayor actualizados correctamente.");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "Error al actualizar los descuentos.");
    }
  }

  async function saveBusiness() {
    try {
      await updateBusiness(costosFijos).unwrap();
      toast.success("Costos fijos actualizados correctamente.");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "Error al actualizar los costos fijos.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Configuración del Portal" maxWidth="max-w-xl">
      <div className="space-y-4">
        {/* Tabs pill style */}
        <div className="flex gap-1 rounded-pill border border-border bg-surface p-1">
          {(["pricing", "business"] as const).map((id) => {
            const active = activeTab === id;
            const label = id === "pricing" ? "Descuentos por Mayor" : "Costos Fijos";
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`relative flex-1 rounded-pill px-4 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-gradient-accent text-white shadow-sm" : "text-muted hover:text-text"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Descuentos por mayor ── */}
        {activeTab === "pricing" && (
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Define los porcentajes de descuento sugeridos según la cantidad de unidades en una sola compra.
            </p>

            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-semibold text-muted pl-1">
                <span>Cant. Mínima</span>
                <span>Cant. Máxima (vacío = ∞)</span>
                <span>Descuento (%)</span>
                <span className="w-8" />
              </div>

              {discounts.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                  <input
                    type="number"
                    min={1}
                    className="input bg-surface-2/30 hover:bg-surface-2 focus:ring-1 focus:ring-accent"
                    value={row.minQty}
                    onChange={(e) => handleDiscountChange(i, "minQty", e.target.value)}
                  />
                  <input
                    type="number"
                    min={1}
                    className="input bg-surface-2/30 hover:bg-surface-2 focus:ring-1 focus:ring-accent"
                    value={row.maxQty ?? ""}
                    onChange={(e) => handleDiscountChange(i, "maxQty", e.target.value)}
                    placeholder="Sin límite"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="input bg-surface-2/30 hover:bg-surface-2 focus:ring-1 focus:ring-accent"
                    value={row.discountPercent}
                    onChange={(e) => handleDiscountChange(i, "discountPercent", e.target.value)}
                  />
                  <button
                    onClick={() => removeDiscountRow(i)}
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="Eliminar regla"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addDiscountRow}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-dashed border-accent-2/40 px-3 py-2 text-xs font-semibold text-accent-2 transition-colors hover:bg-accent-2/5"
            >
              <Plus className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-90" />
              Agregar regla de descuento
            </button>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={savePricing} loading={savingPricing} className="group gap-2 shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30">
                <Save className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5" />
                Guardar Cambios
              </Button>
            </div>
          </div>
        )}

        {/* ── Costos fijos (Bento 2×2) ── */}
        {activeTab === "business" && (
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Retención porcentual aplicada sobre el costo real del producto al aprobar cada venta.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { key: "publicidad", label: "Publicidad" },
                  { key: "utiles", label: "Útiles de tienda" },
                  { key: "servicios", label: "Servicios básicos" },
                  { key: "garantias", label: "Prod. de contenido" },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="rounded-xl border border-border bg-surface-2/40 p-3">
                  <span className="mb-2 block text-xs font-medium text-muted">{label} (%)</span>
                  <input
                    type="number"
                    min={0}
                    className="input bg-surface-2/30 hover:bg-surface-2 focus:ring-1 focus:ring-accent"
                    value={costosFijos[key]}
                    onChange={(e) => setCostosFijos((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                  />
                </div>
              ))}
            </div>

            {/* Ticket de total */}
            <div className="flex flex-col gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <span className="text-xs text-muted/70">Total retenido sobre costo</span>
              <span className="font-heading text-3xl font-bold text-emerald-400">{totalCostosFijos}%</span>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={saveBusiness} loading={savingBusiness} className="group gap-2 shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30">
                <Save className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5" />
                Guardar Configuración
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
