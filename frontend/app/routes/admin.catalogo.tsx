// Portal de Gestión de Catálogo: Reordenación y administración de productos.
import { useState } from "react";
import { RequireRole } from "~/components/admin/RequireRole";
import { SortableCatalogGrid } from "~/components/catalog/SortableCatalogGrid";
import { TemplateGrid } from "~/components/catalog/TemplateGrid";
import { ComboGrid } from "~/components/catalog/ComboGrid";
import { CategoryGrid } from "~/components/catalog/CategoryGrid";
import { AnimatedTabs } from "~/components/ui/AnimatedTabs";

export default function AdminCatalogo() {
  const [activeTab, setActiveTab] = useState("catalog");

  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">Gestión de Catálogo</h1>
            <p className="text-muted">Arrastra productos para reordenar, edítalos, o administra las plantillas y categorías.</p>
          </div>
          <AnimatedTabs
            layoutId="catalog-tabs"
            value={activeTab}
            onChange={setActiveTab}
            items={[
              { id: "catalog", label: "Artículos" },
              { id: "categories", label: "Categorías" },
              { id: "templates", label: "Templates" },
              { id: "combos", label: "Combos" },
            ]}
          />
        </div>

        {activeTab === "catalog" && <SortableCatalogGrid />}
        {activeTab === "categories" && <CategoryGrid />}
        {activeTab === "templates" && <TemplateGrid />}
        {activeTab === "combos" && <ComboGrid />}
      </div>
    </RequireRole>
  );
}
