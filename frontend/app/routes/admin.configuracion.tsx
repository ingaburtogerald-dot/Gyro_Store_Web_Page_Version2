// Portal de Configuración — admin puede editar costos fijos, descuentos por mayor,
// tipo de cambio, WhatsApp, dirección y redes sociales.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Save, RefreshCw } from "lucide-react";
import { RequireRole } from "~/components/admin/RequireRole";
import { Button } from "~/components/ui/Button";
import {
  useGetFullConfigQuery,
  useUpdateBusinessConfigMutation,
  useUpdateCostosFijosMutation,
  useUpdatePricingConfigMutation,
  type Discount,
  type CostosFijos,
} from "~/store/api/salesApi";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 space-y-4">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export default function Configuracion() {
  const { data: config, isLoading } = useGetFullConfigQuery();
  const [updateBiz, { isLoading: savingBiz }] = useUpdateBusinessConfigMutation();
  const [updateCF, { isLoading: savingCF }] = useUpdateCostosFijosMutation();
  const [updatePricing, { isLoading: savingPricing }] = useUpdatePricingConfigMutation();

  // Tienda
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [exchangeRate, setExchangeRate] = useState<number | "">(37);
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");

  // Costos fijos
  const [publicidad, setPublicidad] = useState<number | "">(10);
  const [utiles, setUtiles] = useState<number | "">(5);
  const [servicios, setServicios] = useState<number | "">(5);
  const [garantias, setGarantias] = useState<number | "">(5);

  // Descuentos por mayor
  const [discounts, setDiscounts] = useState<Discount[]>([]);

  useEffect(() => {
    if (!config) return;
    setStoreName(config.storeName || "");
    setStoreAddress(config.storeAddress || "");
    setWhatsapp(config.whatsapp || "");
    setExchangeRate(config.exchangeRate || 37);
    setInstagram(config.socialLinks?.instagram || "");
    setFacebook(config.socialLinks?.facebook || "");
    setTiktok(config.socialLinks?.tiktok || "");
    setPublicidad(config.costosFijos?.publicidad ?? 10);
    setUtiles(config.costosFijos?.utiles ?? 5);
    setServicios(config.costosFijos?.servicios ?? 5);
    setGarantias(config.costosFijos?.garantias ?? 5);
    setDiscounts(config.wholesaleDiscounts || []);
  }, [config]);

  async function saveBiz(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateBiz({
        storeName,
        storeAddress,
        whatsapp,
        exchangeRate: Number(exchangeRate),
        socialLinks: { instagram, facebook, tiktok },
      }).unwrap();
      toast.success("Datos de la tienda actualizados.");
    } catch {
      toast.error("No se pudo guardar.");
    }
  }

  async function saveCF(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateCF({ publicidad: Number(publicidad), utiles: Number(utiles), servicios: Number(servicios), garantias: Number(garantias) }).unwrap();
      toast.success("Costos fijos actualizados.");
    } catch {
      toast.error("No se pudo guardar.");
    }
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

  function updateDiscount(i: number, field: keyof Discount, value: string) {
    setDiscounts((prev) =>
      prev.map((d, idx) =>
        idx === i ? { ...d, [field]: field === "maxQty" && value === "" ? null : Number(value) } : d
      )
    );
  }

  const isBizChanged = useMemo(() => {
    if (!config) return false;
    return (
      storeName !== (config.storeName || "") ||
      storeAddress !== (config.storeAddress || "") ||
      whatsapp !== (config.whatsapp || "") ||
      Number(exchangeRate) !== (config.exchangeRate || 37) ||
      instagram !== (config.socialLinks?.instagram || "") ||
      facebook !== (config.socialLinks?.facebook || "") ||
      tiktok !== (config.socialLinks?.tiktok || "")
    );
  }, [config, storeName, storeAddress, whatsapp, exchangeRate, instagram, facebook, tiktok]);

  const isCFChanged = useMemo(() => {
    if (!config) return false;
    return (
      Number(publicidad) !== (config.costosFijos?.publicidad ?? 10) ||
      Number(utiles) !== (config.costosFijos?.utiles ?? 5) ||
      Number(servicios) !== (config.costosFijos?.servicios ?? 5) ||
      Number(garantias) !== (config.costosFijos?.garantias ?? 5)
    );
  }, [config, publicidad, utiles, servicios, garantias]);

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

  const totalCF = Number(publicidad) + Number(utiles) + Number(servicios) + Number(garantias);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-card bg-surface" />
        ))}
      </div>
    );
  }

  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-xl font-bold text-text">Configuración</h1>
          <p className="text-sm text-muted mt-0.5">Parámetros del negocio editables desde la UI</p>
        </div>

        {/* Datos de la tienda */}
        <Section title="Datos de la tienda">
          <form onSubmit={saveBiz} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre de la tienda">
                <input className="input" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
              </Field>
              <Field label="WhatsApp (con código de país)">
                <input className="input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="50585944758" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Dirección">
                  <input className="input" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} />
                </Field>
              </div>
              <Field label="Tipo de cambio (USD → C$)">
                <input type="number" step="0.01" min={1} className="input" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value === "" ? "" : Number(e.target.value))} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Instagram URL">
                <input className="input" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
              </Field>
              <Field label="Facebook URL">
                <input className="input" value={facebook} onChange={(e) => setFacebook(e.target.value)} />
              </Field>
              <Field label="TikTok URL">
                <input className="input" value={tiktok} onChange={(e) => setTiktok(e.target.value)} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={savingBiz} disabled={!isBizChanged} className="flex items-center gap-2">
                <Save className="h-4 w-4" /> Guardar tienda
              </Button>
            </div>
          </form>
        </Section>

        {/* Costos fijos */}
        <Section title="Costos fijos (%)">
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
                Total costos fijos: <strong className={`${totalCF > 40 ? "text-red-400" : "text-accent-2"}`}>{totalCF}%</strong>
              </p>
              <Button type="submit" loading={savingCF} disabled={!isCFChanged} className="flex items-center gap-2">
                <Save className="h-4 w-4" /> Guardar costos
              </Button>
            </div>
          </form>
        </Section>

        {/* Descuentos por mayor */}
        <Section title="Descuentos por mayor">
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
        </Section>
      </div>
    </RequireRole>
  );
}
