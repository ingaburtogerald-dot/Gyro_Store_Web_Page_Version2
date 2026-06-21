// Card de producto del catálogo: imagen, nombre, precio C$, badge de categoría,
// "Ver detalles" y agregar al carrito. Hover con scale + glow (Framer Motion).
import { Link } from "@remix-run/react";
import { motion } from "framer-motion";
import { Plus, ImageOff } from "lucide-react";
import { toast } from "sonner";
import type { CatalogProduct, Category } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { formatCordobas } from "~/lib/utils";

export function ProductCard({
  product,
  categories,
}: {
  product: CatalogProduct;
  categories: Category[];
}) {
  const dispatch = useAppDispatch();
  const category = categories.find((c) => c.id === product.category);
  const image = product.images?.[0];
  const baseName = product.name;
  const soldOut = (product.stock ?? 0) <= 0;
  const compareAt = product.compareAtPrice ?? 0;
  const onSale = compareAt > product.price;

  function quickAdd() {
    if (soldOut) return;
    dispatch(
      addItem({
        catalogId: product.id,
        name: baseName,
        variantName: "Estándar",
        price: product.price,
        image: image || "",
        quantity: 1,
      }),
    );
    dispatch(openCart());
    toast.success("Agregado al carrito");
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group relative flex flex-col overflow-hidden rounded-card border border-border bg-surface transition-shadow hover:shadow-xl hover:shadow-accent/10"
    >
      <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1">
        {onSale && (
          <span className="rounded-pill bg-red-500 px-2.5 py-1 text-xs font-semibold text-white">
            En oferta
          </span>
        )}
        {(product.badges ?? []).slice(0, 2).map((b) => (
          <span key={b} className="rounded-pill bg-gradient-accent px-2.5 py-1 text-xs font-semibold text-white">
            {b}
          </span>
        ))}
        {!onSale && (product.badges ?? []).length === 0 && product.isPromo && (
          <span className="rounded-pill bg-gradient-accent px-2.5 py-1 text-xs font-semibold text-white">
            Promoción
          </span>
        )}
      </div>

      <Link to={`/producto/${product.id}`} className="relative block aspect-square overflow-hidden bg-surface-2">
        {image ? (
          <img
            src={image}
            alt={baseName}
            loading="lazy"
            className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${soldOut ? "opacity-50" : ""}`}
          />
        ) : (
          <div className="grid h-full place-items-center text-muted">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        {soldOut && (
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-pill bg-black/70 px-3 py-1 text-xs font-semibold text-white">
            Agotado
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3">
        {category && <span className="text-xs text-muted">{category.icon} {category.name}</span>}
        <Link
          to={`/producto/${product.id}`}
          className="mt-1 line-clamp-2 font-medium leading-snug hover:text-accent-2"
        >
          {baseName}
        </Link>
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex flex-col">
            <span className="font-heading text-lg font-bold">{formatCordobas(product.price)}</span>
            {onSale && (
              <span className="text-xs text-muted line-through">{formatCordobas(compareAt)}</span>
            )}
          </div>
          <button
            onClick={quickAdd}
            disabled={soldOut}
            aria-label="Agregar al carrito"
            className="grid h-9 w-9 place-items-center rounded-full bg-gradient-accent text-white transition-transform active:scale-90 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
