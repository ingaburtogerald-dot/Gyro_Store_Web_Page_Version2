// Inventario del vendedor (móvil): lista compacta (sin cards). Cada producto se
// puede compartir al cliente por WhatsApp con un toque.
import { useState, useMemo } from "react";
import { Search, Share2 } from "lucide-react";
import {
  useGetAvailableInventoryQuery,
} from "~/store/api/inventoryApi";
import { useGetPricingConfigQuery } from "~/store/api/salesApi";
import { formatCordobas, buildWhatsappUrl, cn } from "~/lib/utils";

export function SellerInventory() {
  const [search, setSearch] = useState("");

  const { data: available = [], isLoading } = useGetAvailableInventoryQuery();
  const { data: pricing } = useGetPricingConfigQuery();

  const maxDiscount = useMemo(() => {
    const d = pricing?.wholesaleDiscounts ?? [];
    return d.length ? Math.max(...d.map((x) => x.discountPercent)) : 0;
  }, [pricing]);

  const q = search.trim().toLowerCase();
  const matches = (p: any) => !q || `${p.code} ${p.productName}`.toLowerCase().includes(q);
  const filteredAvailable = useMemo(() => available.filter(matches), [available, q]);

  const isEmpty = filteredAvailable.length === 0;

  return (
    <div className="space-y-4 rounded-card border border-border bg-surface shadow-premium p-4">
      {/* Búsqueda */}
      <div className="flex items-center gap-2 rounded-pill border border-border bg-bg/40 px-3">
        <Search className="h-4 w-4 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto…"
          className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted"
        />
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted">Cargando inventario…</p>
      ) : isEmpty ? (
        <p className="py-8 text-center text-sm text-muted">
          {q ? "Ningún producto coincide con tu búsqueda." : "No hay productos disponibles."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {filteredAvailable.map((p: any) => <AvailableRow key={p.id} p={p} maxDiscount={maxDiscount} />)}
        </ul>
      )}
    </div>
  );
}

function AvailableRow({ p, maxDiscount }: { p: any; maxDiscount: number }) {
  const suggested = p.suggestedPrice || 0;
  const minPrice = Math.round(suggested * (1 - maxDiscount / 100));
  const stock = p.available ?? 0;
  const shareMsg = `¡Hola! 👋 Te comparto desde Gyro Store:\n\n*${p.productName}*\nPrecio: ${formatCordobas(suggested)}${
    maxDiscount > 0 ? `\nPor mayor desde: ${formatCordobas(minPrice)}` : ""
  }`;

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">{p.code}</span>
          <span className="truncate text-sm font-medium text-text">{p.productName}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs">
          <span className="font-bold text-whatsapp">{formatCordobas(suggested)}</span>
          {maxDiscount > 0 && <span className="text-muted">· mayoreo desde {formatCordobas(minPrice)}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            stock === 0
              ? "bg-red-500/15 text-red-400"
              : stock <= 3
                ? "bg-amber-500/15 text-amber-400"
                : "bg-emerald-500/15 text-emerald-400",
          )}
        >
          {stock === 0 ? "Agotado" : stock <= 3 ? `¡Últimas ${stock}!` : `${stock} uds`}
        </span>
        <a
          href={buildWhatsappUrl("", shareMsg)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg p-1.5 text-whatsapp transition-colors hover:bg-whatsapp/10"
          title="Compartir por WhatsApp"
          aria-label="Compartir por WhatsApp"
        >
          <Share2 className="h-4 w-4" />
        </a>
      </div>
    </li>
  );
}

