// Portal de Configuración — admin puede editar costos fijos, descuentos por mayor,
// tipo de cambio, WhatsApp, dirección y redes sociales.
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Save, Upload, Trash2 } from "lucide-react";
import { RequireRole } from "~/components/admin/RequireRole";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import {
  useGetFullConfigQuery,
  useUpdateBusinessConfigMutation,
  useUpdateCostosFijosMutation,
  useUpdatePricingConfigMutation,
  useUploadLogoMutation,
  useRemoveLogoMutation,
  type Discount,
  type CostosFijos,
} from "~/store/api/salesApi";

// Layout de dos columnas (patrón "settings page"): a la izquierda el título y
// una descripción de qué controla la sección; a la derecha la card con los
// campos. En pantallas angostas se apila.
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
      <div>
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {description && <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      <Card className="space-y-4 p-5">{children}</Card>
    </section>
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

// Una fila de logo (estático o animado). PRESENTACIONAL: solo prepara el cambio
// (vista previa local del archivo elegido / marca "quitar"); no sube nada hasta que
// el padre pulse "Guardar cambios".
function LogoRow({
  label,
  hint,
  accept,
  currentUrl,
  staged,
  onSelect,
  onRemove,
  onUndo,
}: {
  label: string;
  hint: string;
  accept: string;
  currentUrl?: string;
  staged: File | "remove" | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onUndo: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localUrl, setLocalUrl] = useState("");

  // Vista previa local del archivo staged (se revoca al cambiar/desmontar).
  useEffect(() => {
    if (staged instanceof File) {
      const u = URL.createObjectURL(staged);
      setLocalUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setLocalUrl("");
  }, [staged]);

  const changed = staged !== null;
  const hasCurrent = Boolean(currentUrl);
  // Qué mostrar: archivo nuevo (local) → quitar (nada) → logo actual.
  const src = staged instanceof File ? localUrl : staged === "remove" ? "" : currentUrl || "";

  const isVideo = staged instanceof File 
    ? staged.type.startsWith('video/')
    : (src && src.match(/\.(mp4|webm|ogg|mov)$/i));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        {changed && (
          <span className="text-[11px] font-medium text-accent-2">
            {staged === "remove" ? "Se quitará al guardar" : "Nuevo · sin guardar"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {/* Vista previa sobre negro, como el header real */}
        <div className="grid h-16 w-32 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-black">
          {src ? (
            isVideo ? (
              <video key="video" src={src} autoPlay muted loop playsInline className="max-h-full max-w-full object-contain" />
            ) : (
              <img key="img" src={src} alt="" className="max-h-full max-w-full object-contain" />
            )
          ) : (
            <span className="text-[11px] text-muted">Sin logo</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs leading-relaxed text-muted">{hint}</p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onSelect(f);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {hasCurrent || staged instanceof File ? "Cambiar imagen" : "Elegir imagen"}
            </Button>
            {changed ? (
              <button
                type="button"
                onClick={onUndo}
                className="text-xs font-medium text-muted underline-offset-2 transition-colors hover:text-text hover:underline"
              >
                Deshacer
              </button>
            ) : hasCurrent ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onRemove}
                className="flex items-center gap-2 text-danger"
              >
                <Trash2 className="h-4 w-4" /> Quitar
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// Sección "Logo del header": dos filas (estático + animado) con staging y UN solo
// botón "Guardar cambios" que aplica todo (sube los archivos nuevos y/o quita).
function LogoSection({ branding }: { branding?: { logoStaticUrl?: string; logoAnimatedUrl?: string } }) {
  const [uploadLogo] = useUploadLogoMutation();
  const [removeLogo] = useRemoveLogoMutation();
  const [saving, setSaving] = useState(false);
  // Cambio pendiente por tipo: File (nuevo) | "remove" (quitar) | null (sin cambio).
  const [staged, setStaged] = useState<{
    static: File | "remove" | null;
    animated: File | "remove" | null;
  }>({ static: null, animated: null });

  const hasChanges = staged.static !== null || staged.animated !== null;
  const setKind = (kind: "static" | "animated", value: File | "remove" | null) =>
    setStaged((s) => ({ ...s, [kind]: value }));

  async function save() {
    setSaving(true);
    try {
      for (const kind of ["static", "animated"] as const) {
        const change = staged[kind];
        if (change instanceof File) {
          const fd = new FormData();
          fd.append("file", change);
          fd.append("kind", kind);
          await uploadLogo(fd).unwrap();
        } else if (change === "remove") {
          await removeLogo(kind).unwrap();
        }
      }
      setStaged({ static: null, animated: null });
      toast.success("Logo del header guardado.");
    } catch (e) {
      const msg = (e as { data?: { error?: string } })?.data?.error;
      toast.error(msg || "No se pudo guardar el logo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <LogoRow
        label="Logo estático"
        accept="image/jpeg,image/png,image/webp"
        hint="Imagen (JPG, PNG o WebP). Se recomienda proporción 2:1 y fondo negro."
        currentUrl={branding?.logoStaticUrl}
        staged={staged.static}
        onSelect={(f) => setKind("static", f)}
        onRemove={() => setKind("static", "remove")}
        onUndo={() => setKind("static", null)}
      />
      <LogoRow
        label="Logo animado (GIF/Video)"
        accept="image/gif,video/mp4,video/webm,video/ogg,video/quicktime"
        hint="GIF animado o Video corto. Debe coincidir en tamaño/proporción con el estático."
        currentUrl={branding?.logoAnimatedUrl}
        staged={staged.animated}
        onSelect={(f) => setKind("animated", f)}
        onRemove={() => setKind("animated", "remove")}
        onUndo={() => setKind("animated", null)}
      />
      <div className="flex justify-end border-t border-border pt-4">
        <Button
          type="button"
          onClick={save}
          loading={saving}
          disabled={!hasChanges}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" /> Guardar cambios
        </Button>
      </div>
    </div>
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
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [facebookReviewUrl, setFacebookReviewUrl] = useState("");

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
    setGoogleReviewUrl(config.reviewLinks?.google || "");
    setFacebookReviewUrl(config.reviewLinks?.facebook || "");
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
        reviewLinks: { google: googleReviewUrl, facebook: facebookReviewUrl },
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
      tiktok !== (config.socialLinks?.tiktok || "") ||
      googleReviewUrl !== (config.reviewLinks?.google || "") ||
      facebookReviewUrl !== (config.reviewLinks?.facebook || "")
    );
  }, [config, storeName, storeAddress, whatsapp, exchangeRate, instagram, facebook, tiktok, googleReviewUrl, facebookReviewUrl]);

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
      <div className="max-w-5xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Configuración</h1>
          <p className="mt-1 text-sm text-muted">Parámetros del negocio editables desde la UI</p>
        </div>

        {/* Datos de la tienda */}
        <Section
          title="Datos de la tienda"
          description="Identidad y contacto que ven tus clientes: nombre, WhatsApp, dirección y redes. El tipo de cambio alimenta todos los cálculos de precios en córdobas."
        >
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
            <div className="border-t border-border/40 pt-4">
              <h3 className="mb-3 text-xs font-semibold text-text uppercase tracking-wider">Enlaces de Reseñas / Feedback</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Google Review URL (Feedback)">
                  <input className="input" value={googleReviewUrl} onChange={(e) => setGoogleReviewUrl(e.target.value)} placeholder="https://g.page/r/.../review" />
                </Field>
                <Field label="Facebook Review URL (Feedback)">
                  <input className="input" value={facebookReviewUrl} onChange={(e) => setFacebookReviewUrl(e.target.value)} placeholder="https://facebook.com/.../reviews" />
                </Field>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={savingBiz} disabled={!isBizChanged} className="flex items-center gap-2">
                <Save className="h-4 w-4" /> Guardar tienda
              </Button>
            </div>
          </form>
        </Section>

        {/* Logo del header (identidad de marca) */}
        <Section
          title="Logo del header"
          description="El logo que aparece arriba a la izquierda en toda la tienda. El estático se muestra por defecto; el animado (GIF) aparece al pasar el mouse o hacer clic. Elige los archivos y pulsa Guardar cambios para aplicarlos."
        >
          <LogoSection branding={config?.branding} />
        </Section>

        {/* Costos fijos */}
        <Section
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
        </Section>

        {/* Descuentos por mayor */}
        <Section
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
        </Section>
      </div>
    </RequireRole>
  );
}
