import { useEffect } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useSearchParams } from "@remix-run/react";
import { PublicHeader } from "~/components/layout/PublicHeader";
import { PublicFooter } from "~/components/layout/PublicFooter";
import { Hero } from "~/components/catalog/Hero";
import { ProductGrid } from "~/components/catalog/ProductGrid";
import { SortableCatalogGrid } from "~/components/catalog/SortableCatalogGrid";
import { CatalogSearchBar } from "~/components/catalog/CatalogSearchBar";
import { CategoryChips } from "~/components/catalog/CategoryChips";
import { FilterFab } from "~/components/catalog/FilterFab";
import { FilterSheet } from "~/components/catalog/FilterSheet";
import { CartFab } from "~/components/cart/CartFab";
import { CartDrawer } from "~/components/cart/CartDrawer";
import { useGetCatalogQuery } from "~/store/api/catalogApi";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { selectEditMode, selectIsAdmin, setEditMode } from "~/store/slices/authSlice";

// Origen absoluto (para construir URLs absolutas de Open Graph desde el servidor).
export async function loader({ request }: LoaderFunctionArgs) {
  return { origin: new URL(request.url).origin };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const origin = data?.origin ?? "";
  const img = `${origin}/logo.jpg`;
  const title = "Gyro Store · Electrónica importada en Managua";
  const description = "Audífonos KZ, adaptadores Bluetooth y accesorios para PC en Managua, Nicaragua.";
  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Gyro Store" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: img },
    { property: "og:url", content: `${origin}/` },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: img },
  ];
};

export default function Index() {
  const { data: products } = useGetCatalogQuery();
  const dispatch = useAppDispatch();
  const isAdmin = useAppSelector(selectIsAdmin);
  const editMode = useAppSelector(selectEditMode);
  const editing = isAdmin && editMode;
  const [searchParams, setSearchParams] = useSearchParams();

  // Entrada directa desde el menú del admin: /?edit=1 activa el modo edición.
  useEffect(() => {
    if (isAdmin && searchParams.get("edit") === "1") {
      dispatch(setEditMode(true));
      searchParams.delete("edit");
      setSearchParams(searchParams, { replace: true });
    }
  }, [isAdmin, searchParams, setSearchParams, dispatch]);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <Hero productCount={products?.length ?? 0} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4">
        {/* Búsqueda + chips de categorías (se ocultan en modo edición del catálogo) */}
        {!editing && (
          <>
            <CatalogSearchBar />
            <CategoryChips />
          </>
        )}

        {editing ? <SortableCatalogGrid /> : <ProductGrid />}
      </main>

      <PublicFooter />
      <CartFab />
      <CartDrawer />

      {/* Filtros móviles: FAB + bottom sheet (ocultos en modo edición) */}
      {!editing && (
        <>
          <FilterFab />
          <FilterSheet />
        </>
      )}
    </div>
  );
}
