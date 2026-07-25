import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { ConfigSection, Field } from "./shared";
import { useUpdateBusinessConfigMutation } from "~/store/api/salesApi";
import type { BusinessConfig } from "~/types/catalog"; // Actually the type is in API or just use any/unknown if not available.

export function StoreSettingsForm({ config }: { config: any }) {
  const [updateBiz, { isLoading: savingBiz }] = useUpdateBusinessConfigMutation();

  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [exchangeRate, setExchangeRate] = useState<number | "">(37);
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [facebookReviewUrl, setFacebookReviewUrl] = useState("");

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
  }, [config]);

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

  return (
    <ConfigSection
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
    </ConfigSection>
  );
}
