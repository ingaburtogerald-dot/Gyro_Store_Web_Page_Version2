// Portal de Gestión de Catálogo: Reordenación y administración de productos.
import { RequireRole } from "~/components/admin/RequireRole";
import { SortableCatalogGrid } from "~/components/catalog/SortableCatalogGrid";

export default function AdminCatalogo() {
  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Catálogo</h1>
          <p className="text-muted">Arrastra productos para reordenar el catálogo público, edítalos o agrega nuevos.</p>
        </div>

        <SortableCatalogGrid />
      </div>
    </RequireRole>
  );
}
