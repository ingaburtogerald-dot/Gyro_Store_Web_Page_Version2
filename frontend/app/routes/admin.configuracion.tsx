import { useState } from "react";
import { ImageIcon, Store } from "lucide-react";
import { RequireRole } from "~/components/admin/RequireRole";
import { SiteImagesPanel } from "~/components/admin/config/SiteImagesPanel";
import { StoreSettingsForm } from "~/components/admin/config/StoreSettingsForm";
import { FixedCostsForm } from "~/components/admin/config/FixedCostsForm";
import { WholesaleDiscountsForm } from "~/components/admin/config/WholesaleDiscountsForm";
import { ConfigSection } from "~/components/admin/config/shared";
import { useGetFullConfigQuery } from "~/store/api/salesApi";

export default function Configuracion() {
  const { data: config, isLoading } = useGetFullConfigQuery();

  const [tab, setTab] = useState<"general" | "images">("general");

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

        <div className="flex gap-1 border-b border-border">
          {([
            { id: "general", label: "General", icon: Store },
            { id: "images", label: "Recursos de imágenes", icon: ImageIcon },
          ] as const).map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-accent text-text"
                    : "border-transparent text-muted hover:text-text"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "general" && (
          <>
            <StoreSettingsForm config={config} />
            <FixedCostsForm config={config} />
            <WholesaleDiscountsForm config={config} />
          </>
        )}

        {tab === "images" && (
          <ConfigSection
            title="Recursos de imágenes"
            description="Todas las imágenes de la tienda en un solo lugar. Sube una nueva y pulsa “Guardar cambios”: se reemplaza la anterior (también en Cloudflare). Cada ranura indica para qué se usa y las medidas recomendadas."
          >
            <SiteImagesPanel branding={config?.branding} />
          </ConfigSection>
        )}
      </div>
    </RequireRole>
  );
}
