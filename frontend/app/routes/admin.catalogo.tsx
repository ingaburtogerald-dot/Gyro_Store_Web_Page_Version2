// Portal de Gestión de Catálogo: Reordenación y administración de productos.
import { useState } from "react";
import { RequireRole } from "~/components/admin/RequireRole";
import { SortableCatalogGrid } from "~/components/catalog/SortableCatalogGrid";
import { TemplateGrid } from "~/components/catalog/TemplateGrid";
import { AnimatedTabs } from "~/components/ui/AnimatedTabs";

export default function AdminCatalogo() {
  const [activeTab, setActiveTab] = useState("catalog");

  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="gradient-text text-2xl font-bold">Gestión de Catálogo</h1>
            <p className="text-muted">Arrastra productos para reordenar, edítalos, o administra las plantillas.</p>
          </div>
          <AnimatedTabs
            layoutId="catalog-tabs"
            value={activeTab}
            onChange={setActiveTab}
            items={[
              { id: "catalog", label: "Artículos" },
              { id: "templates", label: "Templates" },
            ]}
          />
        </div>

        {activeTab === "catalog" ? <SortableCatalogGrid /> : <TemplateGrid />}
      </div>
    </RequireRole>
  );
}
