import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { Plus, Trash2 } from "lucide-react";
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
    <Modal open={open} onClose={onClose} title="⚙️ Configuración del Portal" maxWidth="max-w-xl">
      <div className="space-y-4">
        {/* Navigation tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("pricing")}
            className={`flex-1 pb-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "pricing" 
                ? "border-accent-2 text-accent-2" 
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            Descuentos por Mayor
          </button>
          <button
            onClick={() => setActiveTab("business")}
            className={`flex-1 pb-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "business" 
                ? "border-accent-2 text-accent-2" 
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            Costos Fijos
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "pricing" ? (
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Define los porcentajes de descuento sugeridos según la cantidad de unidades en una sola compra.
            </p>

            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-semibold text-muted pl-1">
                <span>Cant. Mínima</span>
                <span>Cant. Máxima (vacío = ∞)</span>
                <span>Descuento (%)</span>
                <span className="w-8"></span>
              </div>

              {discounts.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={row.minQty}
                    onChange={(e) => handleDiscountChange(i, "minQty", e.target.value)}
                  />
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={row.maxQty ?? ""}
                    onChange={(e) => handleDiscountChange(i, "maxQty", e.target.value)}
                    placeholder="Sin límite"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="input"
                    value={row.discountPercent}
                    onChange={(e) => handleDiscountChange(i, "discountPercent", e.target.value)}
                  />
                  <button
                    onClick={() => removeDiscountRow(i)}
                    className="p-2 text-muted hover:text-red-400"
                    title="Eliminar regla"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addDiscountRow}
              className="inline-flex items-center gap-1.5 text-xs text-accent-2 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar regla de descuento
            </button>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancelar
              </Button>
              <Button size="sm" onClick={savePricing} loading={savingPricing}>
                Guardar Cambios
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Especifica la retención en porcentaje aplicada sobre el costo real del producto al momento de aprobar cada venta.
            </p>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Publicidad (%)</span>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={costosFijos.publicidad}
                  onChange={(e) => setCostosFijos((prev) => ({ ...prev, publicidad: Number(e.target.value) }))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Útiles de tienda (%)</span>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={costosFijos.utiles}
                  onChange={(e) => setCostosFijos((prev) => ({ ...prev, utiles: Number(e.target.value) }))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Servicios básicos (%)</span>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={costosFijos.servicios}
                  onChange={(e) => setCostosFijos((prev) => ({ ...prev, servicios: Number(e.target.value) }))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Producción de contenido (%)</span>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={costosFijos.garantias}
                  onChange={(e) => setCostosFijos((prev) => ({ ...prev, garantias: Number(e.target.value) }))}
                />
              </label>

              <div className="rounded-lg bg-background/50 border border-border p-3 flex justify-between items-center text-sm font-semibold">
                <span className="text-muted">Total retenido:</span>
                <span className="text-accent-2 text-base">{totalCostosFijos}%</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancelar
              </Button>
              <Button size="sm" onClick={saveBusiness} loading={savingBusiness}>
                Guardar Configuración
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
