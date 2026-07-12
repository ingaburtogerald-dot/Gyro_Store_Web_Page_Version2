import { useMemo } from "react";

export interface CalculatorLine {
  quantity: number | "";
  salePrice?: number | "";
  unitPrice?: string | number; // Support for TicketFormModal format
  catalogPrice?: number; // Needed for autoDiscount in tickets
}

export function useOrderCalculator(
  lines: CalculatorLine[],
  wholesaleDiscounts: { minQty: number; maxQty: number | null; discountPercent: number }[] = []
) {
  return useMemo(() => {
    let subtotal = 0;
    let autoDiscount = 0;
    let catalogSubtotal = 0;

    for (const l of lines) {
      const qty = Number(l.quantity) || 0;
      
      // Determine the price based on what's available
      let price = 0;
      if (typeof l.salePrice === "number") price = l.salePrice;
      else if (typeof l.unitPrice === "number") price = l.unitPrice;
      else if (typeof l.unitPrice === "string") price = parseFloat(l.unitPrice) || 0;
      
      subtotal += qty * price;

      if (l.catalogPrice && l.catalogPrice > 0) {
        if (price > 0 && price < l.catalogPrice) {
          autoDiscount += (l.catalogPrice - price) * qty;
        }
        const catPrice = l.catalogPrice > 0 ? l.catalogPrice : price;
        catalogSubtotal += catPrice * qty;
      }
    }

    const total = subtotal; // Currently simple, but can expand with delivery/tax logic later if needed

    // Helper for suggested price logic
    const getSuggestedPrice = (basePrice: number, qty: number, isMigrated: boolean = false) => {
      if (isMigrated || wholesaleDiscounts.length === 0 || qty <= 0) {
        return { suggestedPrice: basePrice, discountPercent: 0 };
      }
      
      const applicableTiers = wholesaleDiscounts.filter(
        (d) => qty >= d.minQty && (d.maxQty == null || qty <= d.maxQty)
      );
      
      if (applicableTiers.length > 0) {
        const bestTier = applicableTiers.reduce((prev, current) =>
          (prev.discountPercent > current.discountPercent) ? prev : current
        );
        const discountPercent = bestTier.discountPercent;
        return {
          suggestedPrice: Math.round((basePrice * (1 - discountPercent / 100)) / 10) * 10,
          discountPercent
        };
      }
      return { suggestedPrice: basePrice, discountPercent: 0 };
    };

    return {
      subtotal,
      autoDiscount,
      catalogSubtotal,
      total,
      getSuggestedPrice,
    };
  }, [lines, wholesaleDiscounts]);
}
