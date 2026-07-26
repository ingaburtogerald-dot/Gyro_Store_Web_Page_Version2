// Detalle de un combo (/combo/:id). SSR para que el preview al compartir tenga
// foto/título/precio. Muestra los productos del paquete, el ahorro frente a
// comprarlos por separado, y "Agregar combo" (línea atómica en el carrito).
// Comparte el sistema de detalle (DetailHeader/Price/Stock, PurchaseCard, botones,
// TrustBox, MobileBuyBar) con la página de producto para verse idénticos.
import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useState, useMemo, useCallback } from "react";
import { Link, useLoaderData, useNavigate } from "@remix-run/react";
import { motion } from "framer-motion";
import { ChevronLeft, ImageOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PublicFooter } from "~/components/layout/PublicFooter";
import { ProductCarousel } from "~/components/product/ProductCarousel";
import { MobileStoreActions } from "~/components/layout/MobileStoreActions";
import { SocialLinksStrip } from "~/components/catalog/SocialLinksStrip";
import { DetailHeader } from "~/components/public/product/DetailHeader";
import { DetailPrice } from "~/components/public/product/DetailPrice";
import { StockIndicator } from "~/components/public/product/StockIndicator";
import { PurchaseCard } from "~/components/public/product/PurchaseCard";
import { AddToCartButton } from "~/components/public/product/AddToCartButton";
import { WhatsAppButton } from "~/components/public/product/WhatsAppButton";
import { MobileBuyBar } from "~/components/public/product/MobileBuyBar";
import { TrustBox } from "~/components/public/product/TrustBox";
import { useElementInView } from "~/hooks/useElementInView";
import { staggerContainer } from "~/lib/detailMotion";
import type { Combo, CatalogProduct, Category } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { comboToCartItem } from "~/lib/combo";
import { formatCordobas, buildWhatsappUrl } from "~/lib/utils";

export const headers: HeadersFunction = () => ({
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
});

export async function loader({ params, request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;
  const rawId = params.id || "";
  const idParts = rawId.split("--");
  const actualId = idParts[idParts.length - 1];

  let combo: Combo | null = null;
  let catalog: CatalogProduct[] = [];
  let categories: Category[] = [];
  let config: any = null;
  try {
    const [cRes, listRes, confRes] = await Promise.all([
      fetch(`${origin}/api/combos/${actualId}`),
      fetch(`${origin}/api/catalog`),
      fetch(`${origin}/api/config`),
    ]);
    if (cRes.ok) combo = (await cRes.json()) as Combo;
    if (listRes.ok) catalog = (await listRes.json()) as CatalogProduct[];
    if (confRes.ok) {
      config = await confRes.json();
      categories = config.categories ?? [];
    }
  } catch {
    /* combo queda null → el componente muestra "no encontrado" */
  }
  return { combo, catalog, categories, config, url: request.url, origin };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const c = data?.combo;
  if (!c) return [{ title: "Combo · Gyro Store" }];
  const img = c.image || c.products?.[0]?.image || data?.config?.branding?.ogImageUrl || `${data!.origin}/logo.jpg`;
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
  const { combo, catalog, categories, config, url } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [isAdded, setIsAdded] = useState(false);
  const footerVisible = useElementInView("public-footer");

  const whatsappUrl = buildWhatsappUrl(
    config?.whatsapp ?? "50585944758",
    `Hola Gyro Store 👋, quiero comprar el combo: ${combo?.name} — Total: ${formatCordobas(combo?.price || 0)}. ${url}`,
  );

  const share = useCallback(async () => {
    if (!combo) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: combo.name, text: `Mira este combo en Gyro Store: ${combo.name}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Enlace copiado al portapapeles");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        await navigator.clipboard.writeText(url);
        toast.success("Enlace copiado al portapapeles");
      }
    }
  }, [combo, url]);

  const related = useMemo(() => {
    if (!combo) return [];
    const others = catalog.filter((p) => !combo.products.some((cp) => cp.id === p.id));
    return others.slice(0, 12);
  }, [catalog, combo]);

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
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  }

  return (
    <div className="flex flex-col font-sans text-text">
      <main className="mx-auto w-full max-w-6xl flex-1 px-0 md:px-4 pt-6 pb-0 md:pb-4">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 ml-4 md:ml-0 self-start inline-flex items-center gap-1.5 text-[13px] font-semibold text-text transition-all bg-surface-2/60 hover:bg-surface-2 border border-white/5 rounded-full px-3 py-1.5 shadow-sm hover:shadow-md hover:border-white/10"
        >
          <ChevronLeft className="h-4 w-4 text-accent" />
          Atrás
        </button>

        <div className="grid gap-4 md:gap-10 md:grid-cols-[1.1fr_1fr] lg:grid-cols-[1.3fr_1fr] items-start">
          {/* Columna Izquierda: Galería/Productos */}
          <div className="flex flex-col gap-6 min-w-0">
            {combo.image ? (
              <div className="product-stage w-full overflow-hidden rounded-2xl bg-surface-2/40 aspect-square md:aspect-auto md:h-[500px]">
                <img src={combo.image} alt={combo.name} className="h-full w-full object-contain p-8 md:p-12 drop-shadow-2xl" />
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
                {combo.products.map((p, i) => (
                  <div key={p.id} className="flex flex-1 flex-col sm:flex-row sm:items-center">
                    <div className="card-premium flex flex-1 flex-col overflow-hidden rounded-2xl p-4">
                      <Link
                        to={`/producto/${p.id}`}
                        prefetch="intent"
                        className="product-stage aspect-square w-full overflow-hidden rounded-xl"
                      >
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="h-full w-full object-contain p-6 hover:scale-105 transition-transform duration-500 ease-out" />
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
                          <p className="mt-2 line-clamp-2 text-sm font-light leading-relaxed text-muted">
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
            )}
          </div>

          {/* Columna Derecha: Info y Compra */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="flex flex-col md:sticky md:top-24 pb-0 md:pb-8 min-w-0"
          >
            <DetailHeader
              title={combo.name}
              onShare={share}
              shareLabel="Compartir combo"
              badges={
                <span className="rounded-pill bg-accent/15 px-3 py-1 text-xs font-bold tracking-wide text-accent-2 ring-1 ring-accent/20 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Combo
                </span>
              }
            />

            <DetailPrice
              price={combo.price}
              compareAt={combo.savings > 0 ? combo.normalTotal : null}
              pill={combo.savings > 0 ? { text: `Ahorras ${formatCordobas(combo.savings)}`, tone: "save" } : null}
            />

            <StockIndicator tone="ok" label="Disponible para entrega inmediata" />

            <PurchaseCard>
              <div className="flex flex-col focus:outline-none">
                <div className="mb-6 sm:mb-8">
                  <p className="mb-3 text-[12px] sm:text-sm font-semibold text-text">Incluye:</p>
                  <ul className="space-y-2 text-[12px] sm:text-sm">
                    {combo.products.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                        <span className="min-w-0 flex-1 truncate text-muted">{p.name}</span>
                        <span className="tabular-nums text-muted">{formatCordobas(p.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mb-6 sm:mb-8 flex flex-col gap-3">
                  <AddToCartButton isAdded={isAdded} onClick={addToCart} idleLabel="Agregar combo" />
                  <WhatsAppButton href={whatsappUrl} label="Comprar combo por WhatsApp" />
                </div>

                <TrustBox />
              </div>
            </PurchaseCard>
          </motion.div>
        </div>

        {related.length > 0 && (
          <div className="border-t border-white/5 md:mt-8 -mb-4">
            <div className="md:hidden mt-6 mb-[-1rem]">
              <SocialLinksStrip />
            </div>
            <MobileStoreActions />
            <ProductCarousel
              title="Tal vez te pueda interesar"
              products={related}
              categories={categories}
              variant="showcase"
            />
          </div>
        )}
      </main>

      {/* Barra de compra flotante en móvil (compartida con la página de producto) */}
      <MobileBuyBar
        visible={!footerVisible}
        isAdded={isAdded}
        onAdd={addToCart}
        addLabel="Agregar combo"
        whatsappUrl={whatsappUrl}
      />

      <div className="[&>footer]:!mt-4 md:[&>footer]:!mt-8" id="public-footer">
        <PublicFooter />
      </div>
    </div>
  );
}
