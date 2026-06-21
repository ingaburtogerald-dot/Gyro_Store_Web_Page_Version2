import { useEffect } from "react";
import type { MetaFunction } from "@remix-run/node";
import { useSearchParams } from "@remix-run/react";
import { PublicHeader } from "~/components/layout/PublicHeader";
import { PublicFooter } from "~/components/layout/PublicFooter";
import { Hero } from "~/components/catalog/Hero";
import { ProductGrid } from "~/components/catalog/ProductGrid";
import { SortableCatalogGrid } from "~/components/catalog/SortableCatalogGrid";
import { CartFab } from "~/components/cart/CartFab";
import { CartDrawer } from "~/components/cart/CartDrawer";
import { useGetCatalogQuery, useGetConfigQuery } from "~/store/api/catalogApi";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { selectEditMode, selectIsAdmin, setEditMode } from "~/store/slices/authSlice";
import { setCategory } from "~/store/slices/uiSlice";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => [
  { title: "Gyro Store · Electrónica importada en Managua" },
  {
    name: "description",
    content: "Audífonos KZ, adaptadores Bluetooth y accesorios para PC en Managua, Nicaragua.",
  },
];

export default function Index() {
  const { data: config } = useGetConfigQuery();
  const { data: products } = useGetCatalogQuery();
  const dispatch = useAppDispatch();
  const activeCategory = useAppSelector((s) => s.ui.activeCategory);
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
        {/* Chips de categorías filtrables (se ocultan en modo edición) */}
        {!editing && (
          <div className="flex flex-wrap gap-2 pb-6">
            <CategoryChip
              label="Todo"
              active={activeCategory === null}
              onClick={() => dispatch(setCategory(null))}
            />
            {config?.categories.map((c) => (
              <CategoryChip
                key={c.id}
                label={`${c.icon} ${c.name}`}
                active={activeCategory === c.id}
                onClick={() => dispatch(setCategory(c.id))}
              />
            ))}
          </div>
        )}

        {editing ? <SortableCatalogGrid /> : <ProductGrid />}
      </main>

      <PublicFooter />
      <CartFab />
      <CartDrawer />
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-pill border px-4 py-1.5 text-sm transition-colors",
        active
          ? "border-transparent bg-gradient-accent text-white"
          : "border-border bg-surface text-muted hover:text-text",
      )}
    >
      {label}
    </button>
  );
}
