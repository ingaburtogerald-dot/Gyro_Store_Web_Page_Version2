import { useMemo, useRef, useState, useCallback } from "react";
import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useParams, useLoaderData, useNavigate } from "@remix-run/react";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { PublicFooter } from "~/components/layout/PublicFooter";
import { VariantPicker, type VariantSelection } from "~/components/product/VariantPicker";
import { ProductGalleryGrid } from "~/components/catalog/ProductGalleryGrid";
import { MobileStoreActions } from "~/components/layout/MobileStoreActions";
import { SocialLinksStrip } from "~/components/catalog/SocialLinksStrip";
import { ProductCarousel } from "~/components/product/ProductCarousel";
import { ProductPurchasePanel } from "~/components/public/product/ProductPurchasePanel";
import { ProductSpecsPanel } from "~/components/public/product/ProductSpecsPanel";
import { DetailHeader } from "~/components/public/product/DetailHeader";
import { DetailPrice } from "~/components/public/product/DetailPrice";
import { StockIndicator, type StockTone } from "~/components/public/product/StockIndicator";
import { MobileBuyBar } from "~/components/public/product/MobileBuyBar";
import { useElementInView } from "~/hooks/useElementInView";
import { staggerContainer, itemFade } from "~/lib/detailMotion";
import {
  useGetConfigQuery,
  useGetCombosByProductQuery,
  type CatalogDetail,
  type CatalogProduct,
  type Category,
} from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { comboToCartItem } from "~/lib/combo";
import { formatCordobas, buildWhatsappUrl, cn } from "~/lib/utils";

export const headers: HeadersFunction = () => ({
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
});

export async function loader({ params, request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;
  const rawId = params.id || "";
  const idParts = rawId.split("--");
  const actualId = idParts[idParts.length - 1];

  let product: CatalogDetail | null = null;
  let catalog: CatalogProduct[] = [];
  let categories: Category[] = [];
  let branding: any = null;
  try {
    const [pRes, listRes, cRes] = await Promise.all([
      fetch(`${origin}/api/catalog/${actualId}`),
      fetch(`${origin}/api/catalog`),
      fetch(`${origin}/api/config`),
    ]);
    if (pRes.ok) product = (await pRes.json()) as CatalogDetail;
    if (listRes.ok) catalog = (await listRes.json()) as CatalogProduct[];
    if (cRes.ok) {
      const cData = await cRes.json() as any;
      categories = cData.categories ?? [];
      branding = cData.branding ?? null;
    }
  } catch {
  }
  return { product, catalog, categories, url: request.url, origin, branding };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const p = data?.product;
  if (!p) return [{ title: "Producto · Gyro Store" }];
  const img = p.images?.[0] || data?.branding?.ogImageUrl || `${data!.origin}/logo.jpg`;
  const title = `${p.name} · Gyro Store`;
  const description =
    (p.description && String(p.description).slice(0, 160)) ||
    `Comprá ${p.name} en Gyro Store, Managua. Envío local y pago contra entrega.`;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "product" },
    { property: "og:site_name", content: "Gyro Store" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: img },
    { property: "og:url", content: data!.url },
    { property: "product:price:amount", content: String(p.price ?? "") },
    { property: "product:price:currency", content: "NIO" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: img },
    {
      "script:ld+json": {
        "@context": "https://schema.org/",
        "@type": "Product",
        name: p.name,
        image: p.images ?? [],
        description,
        offers: {
          "@type": "Offer",
          priceCurrency: "NIO",
          price: p.price ?? 0,
          availability: (p.stock ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        },
      },
    },
  ];
};

type ProductTab = "detalles" | "specs";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { product, catalog, categories, url } = useLoaderData<typeof loader>();
  const dispatch = useAppDispatch();
  const { data: config } = useGetConfigQuery();

  const [selection, setSelection] = useState<VariantSelection | null>(null);
  const [activeTab, setActiveTab] = useState<ProductTab>("detalles");
  const [isAdded, setIsAdded] = useState(false);
  const footerVisible = useElementInView("public-footer");
  const tabRefs = useRef<Partial<Record<ProductTab, HTMLButtonElement | null>>>({});

  const selectedVariant = selection?.variant ?? product?.variants?.[0];
  const baseName = product?.name ?? "";
  const price = selectedVariant?.price ?? product?.price ?? 0;
  const inStock = selection ? selection.inStock : (product?.stock ?? 0) > 0;
  const stockCount = selectedVariant?.stock ?? product?.stock ?? 0;
  const compareAt = product?.compareAtPrice ?? 0;
  const onSale = compareAt > price;
  const stockTone: StockTone = !inStock ? "out" : stockCount <= 5 ? "low" : "ok";
  const stockLabel = !inStock
    ? "Agotado"
    : stockCount <= 5
      ? `Últimas ${stockCount} unidade${stockCount === 1 ? "" : "s"}`
      : `${stockCount} unidades disponibles`;

  const [qty, setQty] = useState(1);
  const discounts = useMemo(
    () => [...(config?.wholesaleDiscounts ?? [])].sort((a, b) => a.minQty - b.minQty),
    [config],
  );
  const tier = useMemo(
    () => discounts.find((d) => qty >= d.minQty && (d.maxQty == null || qty <= d.maxQty)) ?? null,
    [discounts, qty],
  );
  const unitPrice = Math.round(price * (1 - (tier?.discountPercent ?? 0) / 100));

  const bulkBundles = [
    { label: "Tercios", qty: 3 },
    { label: "Media docena", qty: 6 },
    { label: "Docena", qty: 12 },
  ];

  const gallery = useMemo(() => {
    const byColor = selection?.color ? product?.imagesByColor?.[selection.color] : undefined;
    return byColor && byColor.length ? byColor : product?.images ?? [];
  }, [selection?.color, product?.imagesByColor, product?.images]);

  const related = useMemo(() => {
    if (!product) return [];
    const others = catalog.filter((p) => p.id !== product.id);
    const sameCat = others.filter((p) => p.category === product.category);
    return (sameCat.length >= 4 ? sameCat : others).slice(0, 12);
  }, [catalog, product]);

  const { data: productCombos } = useGetCombosByProductQuery(product?.id ?? "", { skip: !product });
  const combo = productCombos?.[0] ?? null;

  const tabs = useMemo(() => {
    const t: { value: ProductTab; label: string }[] = [{ value: "detalles", label: "Detalles" }];
    const hasSpecs = (product?.specs?.length ?? 0) > 0;
    const hasDesc = !!product?.description;
    const hasTiktok = !!product?.tiktokUrl;
    if (hasSpecs || hasDesc || hasTiktok) {
      t.push({ value: "specs", label: "Especificaciones" });
    }
    return t;
  }, [product?.specs, product?.description, product?.tiktokUrl]);
  const effectiveTab: ProductTab = tabs.some((t) => t.value === activeTab) ? activeTab : "detalles";

  function handleTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (tabs.length < 2 || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    e.preventDefault();
    const idx = tabs.findIndex((t) => t.value === effectiveTab);
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(idx + dir + tabs.length) % tabs.length];
    setActiveTab(next.value);
    tabRefs.current[next.value]?.focus();
  }

  function add() {
    if (!product || !selectedVariant) return;
    dispatch(
      addItem({
        catalogId: product.id,
        variantId: selectedVariant.id,
        name: selectedVariant.name || baseName,
        variantName: selectedVariant.variantName || "Estándar",
        price: unitPrice,
        image: gallery[0] || product.images?.[0] || "",
        quantity: qty,
      }),
    );
    dispatch(openCart());
    toast.success(`Agregado al carrito (${qty} ud${qty > 1 ? "s" : ""})`);
    
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  }

  const pageUrl = url;
  const whatsappUrl = buildWhatsappUrl(
    config?.whatsapp ?? "50585944758",
    `Hola Gyro Store 👋, quiero: ${qty}x ${selectedVariant ? selectedVariant.name : baseName} — Total: ${formatCordobas(unitPrice * qty)}. ${pageUrl}`,
  );

  const share = useCallback(async () => {
    const titleToShare = selectedVariant ? selectedVariant.name : baseName;
    try {
      if (navigator.share) {
        await navigator.share({ title: titleToShare, text: `Mira este producto en Gyro Store: ${titleToShare}`, url: pageUrl });
      } else {
        await navigator.clipboard.writeText(pageUrl);
        toast.success("Enlace copiado al portapapeles");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        await navigator.clipboard.writeText(pageUrl);
        toast.success("Enlace copiado al portapapeles");
      }
    }
  }, [selectedVariant, baseName, pageUrl]);

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

        {!product ? (
          <p className="py-24 text-center text-muted">Producto no encontrado.</p>
        ) : (
          <div className="grid gap-4 md:gap-10 md:grid-cols-[1.1fr_1fr] lg:grid-cols-[1.3fr_1fr] items-start">
            <div className="flex flex-col gap-6 min-w-0">
              <ProductGalleryGrid
                gallery={gallery}
                baseName={baseName}
                inStock={inStock}
                productId={id!}
              />
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="flex flex-col md:sticky md:top-24 pb-0 md:pb-8 min-w-0"
            >
              <DetailHeader
                title={selectedVariant ? selectedVariant.name : baseName}
                onShare={share}
                shareLabel="Compartir producto"
                badges={
                  product.badges && product.badges.length > 0 ? (
                    <>
                      {product.badges.map((b) => (
                        <span key={b} className="rounded-pill bg-accent/15 px-3 py-1 text-xs font-bold tracking-wide text-accent-2 ring-1 ring-accent/20">
                          {b}
                        </span>
                      ))}
                    </>
                  ) : undefined
                }
              />

              <DetailPrice
                price={unitPrice}
                compareAt={tier ? price : onSale ? compareAt : null}
                pill={
                  tier
                    ? { text: `−${tier.discountPercent}% por ${qty} uds`, tone: "save" }
                    : onSale
                      ? { text: "En oferta", tone: "sale" }
                      : null
                }
              />

              {qty > 1 && (
                <motion.p variants={itemFade} className="mt-2 text-sm text-muted">
                  Total {qty} uds: <span className="font-bold text-text">{formatCordobas(unitPrice * qty)}</span>
                </motion.p>
              )}

              <StockIndicator tone={stockTone} label={stockLabel} />

              {product.variants?.length > 0 && (
                <motion.div variants={itemFade} className="mt-6">
                  <VariantPicker
                    variants={product.variants}
                    axisLabels={product.axisLabels}
                    colorAxisIndex={product.colorAxisIndex}
                    templateAxes={product.templateAxes}
                    onChange={(s) => {
                      setSelection(s);
                    }}
                  />
                </motion.div>
              )}

              {tabs.length > 1 && (
                <div
                  role="tablist"
                  aria-label="Navegación del producto"
                  className="mt-8 mb-2 flex items-center gap-6 border-b border-border/60"
                >
                  {tabs.map((t) => (
                    <button
                      key={t.value}
                      ref={(el) => {
                        tabRefs.current[t.value] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`pdp-tab-${t.value}`}
                      aria-selected={effectiveTab === t.value}
                      aria-controls={`pdp-panel-${t.value}`}
                      tabIndex={effectiveTab === t.value ? 0 : -1}
                      onClick={() => setActiveTab(t.value)}
                      onKeyDown={handleTabKeyDown}
                      className={cn(
                        "ease-expo relative pb-3 text-[12px] sm:text-sm font-semibold transition-colors focus-visible:outline-none",
                        effectiveTab === t.value ? "text-text" : "text-muted hover:text-text",
                      )}
                    >
                      {t.label}
                      {effectiveTab === t.value && (
                        <motion.span
                          layoutId="pdp-tab-indicator"
                          className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent"
                          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div
                id="pdp-panel-detalles"
                role="tabpanel"
                hidden={effectiveTab !== "detalles"}
                className="flex flex-col"
              >
                <ProductPurchasePanel
                  product={product}
                  qty={qty}
                  setQty={setQty}
                  price={price}
                  unitPrice={unitPrice}
                  inStock={inStock}
                  isAdded={isAdded}
                  discounts={discounts}
                  bulkBundles={bulkBundles}
                  whatsappUrl={whatsappUrl}
                  combo={combo}
                  add={add}
                  onAddCombo={() => {
                    if (combo) {
                      dispatch(addItem(comboToCartItem(combo)));
                      dispatch(openCart());
                      toast.success("Combo agregado al carrito");
                    }
                  }}
                />
              </div>

              <div
                id="pdp-panel-specs"
                role="tabpanel"
                hidden={effectiveTab !== "specs"}
                className="mt-6 flex flex-col"
              >
                <ProductSpecsPanel product={product} />
              </div>

            </motion.div>
          </div>
        )}

        {product && related.length > 0 && (
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

      {product && (
        <MobileBuyBar
          visible={!footerVisible}
          isAdded={isAdded}
          onAdd={add}
          addLabel={inStock ? "Agregar al carrito" : "Agotado"}
          disabled={!inStock}
          whatsappUrl={whatsappUrl}
        />
      )}

      <div className="[&>footer]:!mt-4 md:[&>footer]:!mt-8" id="public-footer">
        <PublicFooter />
      </div>
    </div>
  );
}
