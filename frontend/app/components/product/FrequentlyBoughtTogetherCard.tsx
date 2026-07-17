import { Sparkles, Plus } from "lucide-react";
import { formatCordobas } from "~/lib/utils";
import { Button } from "./../ui/Button";

interface FrequentlyBoughtTogetherCardProps {
  mainProduct: any;
  mainVariant: any;
  mainUnitPrice: number;
  mainQty: number;
  crossProduct: any;
  onAddBoth: () => void;
}

export function FrequentlyBoughtTogetherCard({
  mainProduct,
  mainVariant,
  mainUnitPrice,
  mainQty,
  crossProduct,
  onAddBoth,
}: FrequentlyBoughtTogetherCardProps) {
  const crossPrice = crossProduct.price;
  const totalPrice = mainUnitPrice * mainQty + crossPrice;

  return (
    <div className="mb-8 rounded-none border border-border bg-surface-2 p-5 transition-shadow duration-300 ease-out hover:shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
      <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold text-text">
        <Sparkles className="h-4 w-4 text-accent" />
        Comprados juntos frecuentemente
      </h3>

      <div className="mb-5 flex items-center justify-center gap-2 sm:gap-4">
        {/* Main Product */}
        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="h-20 w-20 rounded-none border border-border bg-surface p-2">
            <img
              src={mainProduct.images?.[0] || ""}
              alt=""
              className="h-full w-full object-contain"
            />
          </div>
          <span className="line-clamp-2 text-center text-xs text-muted">
            {mainQty > 1 ? `${mainQty}x ` : ""}
            {mainVariant ? mainVariant.name : mainProduct.name}
          </span>
          <span className="text-base font-semibold text-text">
            {formatCordobas(mainUnitPrice * mainQty)}
          </span>
        </div>

        {/* Separator + */}
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-surface text-muted">
          <Plus className="h-4 w-4" />
        </div>

        {/* Cross Product */}
        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="h-20 w-20 rounded-none border border-border bg-surface p-2">
            <img
              src={crossProduct.images?.[0] || ""}
              alt=""
              className="h-full w-full object-contain"
            />
          </div>
          <span className="line-clamp-2 text-center text-xs text-muted">
            {crossProduct.name}
          </span>
          <span className="text-base font-semibold text-text">
            {formatCordobas(crossPrice)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-0.5 text-xs text-muted">Precio total del paquete:</p>
          <p className="text-xl font-bold tabular-nums leading-none text-accent">
            {formatCordobas(totalPrice)}
          </p>
        </div>
        <Button size="md" variant="primary" onClick={onAddBoth} className="w-full sm:w-auto">
          Agregar al carrito
        </Button>
      </div>
    </div>
  );
}
