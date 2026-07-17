// Detalle de un combo (/combo/:id). SSR para que el preview al compartir tenga
// foto/título/precio. Muestra los 2 productos del paquete, el ahorro frente a
// comprarlos por separado, y "Agregar combo" (línea atómica en el carrito).
import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { motion } from "framer-motion";
import { ChevronRight, ImageOff, Sparkles, ShoppingCart, Check } from "lucide-react";
import { toast } from "sonner";
import { PublicFooter } from "~/components/layout/PublicFooter";
import { Button } from "~/components/ui/Button";
import type { Combo } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { comboToCartItem } from "~/lib/combo";
import { formatCordobas } from "~/lib/utils";

export const headers: HeadersFunction = () => ({
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
});

export async function loader({ params, request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;
  let combo: Combo | null = null;
  try {
    const res = await fetch(`${origin}/api/combos/${params.id}`);
    if (res.ok) combo = (await res.json()) as Combo;
  } catch {
    /* combo queda null → el componente muestra "no encontrado" */
  }
  return { combo, url: request.url, origin };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const c = data?.combo;
  if (!c) return [{ title: "Combo · Gyro Store" }];
  const img = c.products?.[0]?.image || `${data!.origin}/logo.jpg`;
  const title = `${c.name} · Gyro Store`;
  const description = `Combo: ${c.products.map((p) => p.name).join(" + ")} por ${formatCordobas(c.price)} en Gyro Store, Managua.`;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "product" },
    { property: "og:site_name", content: "Gyro Store" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: img },
    { property: "og:url", content: data!.url },
    { property: "product:price:amount", content: String(c.price ?? "") },
    { property: "product:price:currency", content: "NIO" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:image", content: img },
  ];
};

export default function ComboDetail() {
  const { combo } = useLoaderData<typeof loader>();
  const dispatch = useAppDispatch();

  if (!combo) {
    return (
      <div className="flex min-h-dvh flex-col bg-bg font-sans text-text">
        <main className="grid flex-1 place-items-center px-4 py-20 text-center">
          <div>
            <p className="text-lg font-semibold">Combo no encontrado</p>
            <p className="mt-1 text-sm text-muted">Puede que ya no esté disponible.</p>
            <Link to="/" className="mt-4 inline-block text-accent hover:underline">
              Volver a la tienda
            </Link>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  function addToCart() {
    dispatch(addItem(comboToCartItem(combo!)));
    dispatch(openCart());
    toast.success("Combo agregado al carrito");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg font-sans text-text">

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8">
        {/* Migas */}
        <nav className="mb-5 flex items-center gap-1 text-xs text-muted">
          <Link to="/" className="hover:text-text">Tienda</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-text">Combo</span>
        </nav>

        <span className="inline-flex items-center gap-1 rounded-none bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent ring-1 ring-accent/30">
          <Sparkles className="h-3.5 w-3.5" /> Combo
        </span>
        <h1 className="mt-3 font-heading text-2xl font-bold sm:text-3xl">{combo.name}</h1>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Los 2 productos */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
            {combo.products.map((p, i) => (
              <div key={p.id} className="flex flex-1 flex-col sm:flex-row sm:items-center">
                <div className="card-premium flex flex-1 flex-col overflow-hidden rounded-none p-4">
                  <Link
                    to={`/producto/${p.id}`}
                    prefetch="intent"
                    className="aspect-square w-full overflow-hidden rounded-none bg-surface-2/40"
                  >
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="h-full w-full object-contain p-6" />
                    ) : (
                      <div className="grid h-full place-items-center text-muted">
                        <ImageOff className="h-8 w-8" />
                      </div>
                    )}
                  </Link>
                  <div className="mt-3">
                    <Link to={`/producto/${p.id}`} prefetch="intent" className="font-bold leading-snug hover:text-accent-2">
                      {p.name}
                    </Link>
                    <p className="mt-1 text-sm text-muted tabular-nums">{formatCordobas(p.price)}</p>
                    {p.description && (
                      <p className="mt-2 line-clamp-3 text-sm font-light leading-relaxed text-muted">
                        {String(p.description).replace(/<[^>]*>?/gm, "")}
                      </p>
                    )}
                  </div>
                </div>
                {i === 0 && (
                  <div className="grid shrink-0 place-items-center py-2 text-3xl font-light text-muted sm:px-3">+</div>
                )}
              </div>
            ))}
          </div>

          {/* Resumen del paquete */}
          <motion.aside
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-premium h-fit rounded-none p-5 lg:sticky lg:top-24"
          >
            <p className="text-sm font-medium text-muted">Precio del paquete</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-heading text-3xl font-extrabold tabular-nums text-accent">
                {formatCordobas(combo.price)}
              </span>
              {combo.savings > 0 && (
                <span className="text-sm font-light text-muted line-through tabular-nums">
                  {formatCordobas(combo.normalTotal)}
                </span>
              )}
            </div>
            {combo.savings > 0 && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-none border border-whatsapp/20 bg-whatsapp/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-whatsapp">
                <Check className="h-3.5 w-3.5" /> Ahorras {formatCordobas(combo.savings)}
              </p>
            )}

            <ul className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
              {combo.products.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-muted">{p.name}</span>
                  <span className="tabular-nums text-muted">{formatCordobas(p.price)}</span>
                </li>
              ))}
            </ul>

            <Button onClick={addToCart} className="mt-5 w-full">
              <ShoppingCart className="h-4 w-4" /> Agregar combo
            </Button>
          </motion.aside>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
