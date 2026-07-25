import { Sparkles } from "lucide-react";
import { TikTokButton } from "~/components/product/TikTokButton";
import { ProductSpecs } from "~/components/catalog/ProductSpecs";
import type { CatalogDetail } from "~/store/api/catalogApi";

export function ProductSpecsPanel({ product }: { product: CatalogDetail }) {
  return (
    <div className="mt-6 flex flex-col">
      {product?.description && (
        <div className="mb-10">
          <h3 className="text-lg font-bold mb-6 text-text flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Acerca del producto
          </h3>
          <div className="max-w-[65ch] space-y-6">
            {(Array.isArray(product.description) ? product.description : String(product.description).split(/\n+/)).filter(Boolean).map((paragraph: string, idx: number) => (
              <div
                key={idx}
                className="text-pretty text-sm sm:text-base font-medium leading-relaxed text-muted [&>p]:mb-4 last:[&>p]:mb-0"
                dangerouslySetInnerHTML={{ __html: paragraph }}
              />
            ))}
          </div>
        </div>
      )}

      {product?.tiktokUrl && (
        <div className="mb-10 pt-2 border-t border-border/50">
          <p className="mb-4 text-xs font-bold text-text uppercase tracking-wider flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" /> Ver en acción
          </p>
          <TikTokButton url={product.tiktokUrl} />
        </div>
      )}

      {(product?.specs?.length ?? 0) > 0 && (
        <div>
          <ProductSpecs specs={product.specs} />
        </div>
      )}
    </div>
  );
}
