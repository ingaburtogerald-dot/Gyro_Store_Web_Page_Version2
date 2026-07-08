import { useEffect } from "react";
import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { PublicHeader } from "~/components/layout/PublicHeader";
import { PublicFooter } from "~/components/layout/PublicFooter";
import { Hero } from "~/components/catalog/Hero";
import { ProductGrid } from "~/components/catalog/ProductGrid";
import { SortableCatalogGrid } from "~/components/catalog/SortableCatalogGrid";
import { MegaSearchBar } from "~/components/catalog/MegaSearchBar";
import { CategoryChips } from "~/components/catalog/CategoryChips";
import { FilterSidebar } from "~/components/catalog/FilterSidebar";
import { FilterFab } from "~/components/catalog/FilterFab";
import { FilterSheet } from "~/components/catalog/FilterSheet";
import { CartFab } from "~/components/cart/CartFab";
import { CartDrawer } from "~/components/cart/CartDrawer";
import type { CatalogProduct, Category } from "~/store/api/catalogApi";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { selectEditMode, selectIsAdmin, setEditMode } from "~/store/slices/authSlice";

// SSR: catálogo Y categorías se obtienen en el servidor (no en el cliente) para
// mejorar SEO y FCP, y evitar el parpadeo de carga. /api/catalog y /api/config son
// PÚBLICOS (no necesitan el token de Firebase). Express sirve el SSR en el mismo
// proceso, por lo que estos fetch al origin propio son locales (la API cachea).
// Cache HTTP del catálogo público: 60s frescos + 5min de stale-while-revalidate.
// El HTML SSR nunca contiene contenido de admin (el modo edición hidrata en cliente),
// así que es seguro cachearlo en navegador/CDN.
export const headers: HeadersFunction = () => ({
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
});

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;
  let products: CatalogProduct[] = [];
  let categories: Category[] = [];
  try {
    const [pRes, cRes] = await Promise.all([
      fetch(`${origin}/api/catalog`),
      fetch(`${origin}/api/config`),
    ]);
    if (pRes.ok) products = (await pRes.json()) as CatalogProduct[];
    if (cRes.ok) categories = ((await cRes.json()) as { categories?: Category[] }).categories ?? [];
  } catch {
    // Si la API falla, la página igual renderiza (grilla vacía con su estado vacío).
  }
  return { origin, products, categories };
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
  const { products, categories } = useLoaderData<typeof loader>();
  const dispatch = useAppDispatch();
  const isAdmin = useAppSelector(selectIsAdmin);
  const editMode = useAppSelector(selectEditMode);
  const editing = isAdmin && editMode;
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep-link desde el menú del admin: /?edit=1 activa el modo edición UNA vez y
  // limpia el query param. Es Redux (no la URL) la fuente de verdad del modo edición,
  // porque el botón del header también lo alterna; por eso sincronizamos el deep-link
  // con un efecto (uso correcto de useEffect: sincronizar con un sistema externo, la
  // URL) en vez de derivarlo en render, lo que crearía dos fuentes de verdad.
  useEffect(() => {
    if (isAdmin && searchParams.get("edit") === "1") {
      dispatch(setEditMode(true));
      const next = new URLSearchParams(searchParams);
      next.delete("edit");
      setSearchParams(next, { replace: true });
    }
  }, [isAdmin, searchParams, setSearchParams, dispatch]);

  return (
    // data-skin="store": activa la piel "Midnight Neon" (tokens con scope en
    // tailwind.css) solo en el storefront; el admin conserva Obsidian/Esmeralda.
    <div data-skin="store" className="flex min-h-dvh flex-col bg-bg font-sans text-text">
      <PublicHeader />
      <Hero productCount={products.length} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4">
        {/* Búsqueda + chips de categorías (se ocultan en modo edición del catálogo).
            Los chips solo viven en móvil: en escritorio las categorías están en el
            sidebar de filtros. */}
        {!editing && (
          <>
            <MegaSearchBar />
            <div className="lg:hidden">
              <CategoryChips categories={categories} />
            </div>
          </>
        )}

        {editing ? (
          <SortableCatalogGrid />
        ) : (
          <div className="flex items-start gap-8 pt-3 lg:pt-5">
            <FilterSidebar categories={categories} products={products} />
            <div className="min-w-0 flex-1">
              <ProductGrid products={products} categories={categories} />
            </div>
          </div>
        )}
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
