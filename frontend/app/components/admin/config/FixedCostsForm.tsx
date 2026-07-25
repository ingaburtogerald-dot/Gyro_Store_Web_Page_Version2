import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { ConfigSection, Field } from "./shared";
import { useUpdateCostosFijosMutation } from "~/store/api/salesApi";

export function FixedCostsForm({ config }: { config: any }) {
  const [updateCF, { isLoading: savingCF }] = useUpdateCostosFijosMutation();

  const [publicidad, setPublicidad] = useState<number | "">(10);
  const [utiles, setUtiles] = useState<number | "">(5);
  const [servicios, setServicios] = useState<number | "">(5);
  const [garantias, setGarantias] = useState<number | "">(5);

  useEffect(() => {
    if (!config) return;
    setPublicidad(config.costosFijos?.publicidad ?? 10);
    setUtiles(config.costosFijos?.utiles ?? 5);
    setServicios(config.costosFijos?.servicios ?? 5);
    setGarantias(config.costosFijos?.garantias ?? 5);
  }, [config]);

  const isCFChanged = useMemo(() => {
    if (!config) return false;
    return (
      Number(publicidad) !== (config.costosFijos?.publicidad ?? 10) ||
      Number(utiles) !== (config.costosFijos?.utiles ?? 5) ||
      Number(servicios) !== (config.costosFijos?.servicios ?? 5) ||
      Number(garantias) !== (config.costosFijos?.garantias ?? 5)
    );
  }, [config, publicidad, utiles, servicios, garantias]);

  const totalCF = Number(publicidad) + Number(utiles) + Number(servicios) + Number(garantias);

  async function saveCF(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateCF({ publicidad: Number(publicidad), utiles: Number(utiles), servicios: Number(servicios), garantias: Number(garantias) }).unwrap();
      toast.success("Costos fijos actualizados.");
    } catch {
      toast.error("No se pudo guardar.");
    }
  }

  return (
    <ConfigSection
      title="Costos fijos (%)"
      description="Porcentajes que cada venta aparta para gastos operativos (publicidad, útiles, servicios, garantías). El total se descuenta antes de calcular la utilidad neta."
    >
      <form onSubmit={saveCF} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Publicidad (%)">
            <input type="number" step="0.1" min={0} max={100} className="input" value={publicidad} onChange={(e) => setPublicidad(e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field label="Útiles (%)">
            <input type="number" step="0.1" min={0} max={100} className="input" value={utiles} onChange={(e) => setUtiles(e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field label="Servicios (%)">
            <input type="number" step="0.1" min={0} max={100} className="input" value={servicios} onChange={(e) => setServicios(e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field label="Garantías (%)">
            <input type="number" step="0.1" min={0} max={100} className="input" value={garantias} onChange={(e) => setGarantias(e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Total costos fijos: <strong className={`${totalCF > 40 ? "text-danger" : "text-accent-2"}`}>{totalCF}%</strong>
          </p>
          <Button type="submit" loading={savingCF} disabled={!isCFChanged} className="flex items-center gap-2">
            <Save className="h-4 w-4" /> Guardar costos
          </Button>
        </div>
      </form>
    </ConfigSection>
  );
}
