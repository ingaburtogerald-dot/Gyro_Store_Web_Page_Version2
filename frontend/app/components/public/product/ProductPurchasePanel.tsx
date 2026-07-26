import { ShieldCheck } from "lucide-react";
import { VolumePriceCard } from "~/components/product/VolumePriceCard";
import { FrequentlyBoughtTogetherCard } from "~/components/product/FrequentlyBoughtTogetherCard";
import { TrustBox } from "./TrustBox";
import { PurchaseCard } from "./PurchaseCard";
import { AddToCartButton } from "./AddToCartButton";
import { WhatsAppButton } from "./WhatsAppButton";
import type { CatalogDetail, Combo } from "~/store/api/catalogApi";

interface ProductPurchasePanelProps {
  product: CatalogDetail;
  qty: number;
  setQty: (qty: number | ((q: number) => number)) => void;
  price: number;
  unitPrice: number;
  inStock: boolean;
  isAdded: boolean;
  discounts: any[];
  bulkBundles: { label: string; qty: number }[];
  whatsappUrl: string;
  combo: Combo | null;
  add: () => void;
  onAddCombo: () => void;
}

export function ProductPurchasePanel({
  product,
  qty,
  setQty,
  price,
  unitPrice,
  inStock,
  isAdded,
  discounts,
  bulkBundles,
  whatsappUrl,
  combo,
  add,
  onAddCombo
}: ProductPurchasePanelProps) {
  return (
    <PurchaseCard>
      <div className="flex flex-col focus:outline-none">
        {/* Selector de cantidad y Agregar al carrito */}
        <div className="mb-6 sm:mb-8">
          <p className="mb-3 text-[12px] sm:text-sm font-semibold text-text">Cantidad</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-border bg-surface-2 p-1 w-fit shadow-sm shrink-0">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-8 w-10 sm:h-10 sm:w-12 items-center justify-center rounded-md text-base sm:text-lg text-muted transition-colors hover:bg-surface hover:text-text active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Quitar uno"
              >
                −
              </button>
              <span className="w-10 sm:w-12 text-center text-sm sm:text-base font-bold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="flex h-8 w-10 sm:h-10 sm:w-12 items-center justify-center rounded-md text-base sm:text-lg text-muted transition-colors hover:bg-surface hover:text-text active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Agregar uno"
              >
                +
              </button>
            </div>

            <div className="flex-1">
              <AddToCartButton
                isAdded={isAdded}
                onClick={add}
                disabled={!inStock}
                idleLabel={inStock ? "Agregar al carrito" : "Agotado"}
              />
            </div>
          </div>
        </div>

        {/* Bundles de mayoreo */}
        {discounts.length > 0 && (
          <div className="mb-6 sm:mb-8 flex flex-col gap-3">
            <p className="text-[12px] sm:text-sm font-semibold flex items-center gap-2 text-text">
              <ShieldCheck className="h-4 w-4 text-accent" /> Ahorra comprando más
            </p>
            
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {bulkBundles.map((b) => {
                const t = discounts.find((d) => b.qty >= d.minQty && (d.maxQty == null || b.qty <= d.maxQty)) ?? null;
                return (
                  <div key={b.qty}>
                    <VolumePriceCard
                      label={b.label}
                      qty={b.qty}
                      active={qty === b.qty}
                      basePrice={price}
                      tier={t}
                      onClick={() => setQty(b.qty)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA secundario (WhatsApp) */}
        <div className="mb-0 flex">
          <WhatsAppButton href={whatsappUrl} label="Comprar al por mayor por WhatsApp" />
        </div>

        {/* Venta cruzada */}
        {combo && (
          <div className="mb-0">
            <FrequentlyBoughtTogetherCard
              combo={combo}
              mainProductId={product.id}
              onAdd={onAddCombo}
            />
          </div>
        )}

        {/* Trust Box */}
        <TrustBox />
      </div>
    </PurchaseCard>
  );
}
