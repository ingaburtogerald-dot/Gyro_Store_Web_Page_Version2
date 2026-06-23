// Card de producto del catálogo: imagen, nombre, precio C$, badge de categoría,
// "Ver detalles" y agregar al carrito. Hover con scale + glow (Framer Motion).
import { Link } from "@remix-run/react";
import { motion } from "framer-motion";
import { ShoppingBag, ImageOff } from "lucide-react";
import { toast } from "sonner";
import type { CatalogProduct, Category } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { formatCordobas, cn } from "~/lib/utils";

export function ProductCard({
  product,
  categories,
  index = 0,
}: {
  product: CatalogProduct;
  categories: Category[];
  index?: number;
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
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.35, ease: "easeOut", delay: Math.min(index, 8) * 0.05 }}
      whileHover={{ scale: 1.02, transition: { type: "spring", stiffness: 300, damping: 20 } }}
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

      <Link
        to={`/producto/${product.id}`}
        prefetch="intent"
        viewTransition
        className="relative block aspect-square overflow-hidden bg-surface-2 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {image ? (
          <img
            src={image}
            alt={baseName}
            loading="lazy"
            className={`h-full w-full object-contain transition-transform duration-300 group-hover:scale-105 ${soldOut ? "opacity-50" : ""}`}
            style={{ viewTransitionName: `vt-product-${product.id}` } as React.CSSProperties}
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
          prefetch="intent"
          viewTransition
          className="mt-1 line-clamp-2 rounded font-medium leading-snug hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {baseName}
        </Link>
        <div className="mt-auto pt-3">
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-lg font-bold">{formatCordobas(product.price)}</span>
            {onSale && (
              <span className="text-xs text-muted line-through">{formatCordobas(compareAt)}</span>
            )}
          </div>
          <button
            onClick={quickAdd}
            disabled={soldOut}
            className={cn(
              "mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              soldOut
                ? "cursor-not-allowed bg-surface-2 text-muted"
                : "bg-gradient-accent text-white sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100",
            )}
          >
            <ShoppingBag className="h-4 w-4" /> {soldOut ? "Agotado" : "Agregar"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
