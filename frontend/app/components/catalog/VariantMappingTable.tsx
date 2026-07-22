// Tabla de variantes 1-a-1. Genera TODAS las combinaciones de la plantilla y por
// cada una: un SKU canónico (autocomplete contra inventario real), un precio
// override opcional, y el stock actual en solo-lectura. La disponibilidad
// («Disponible»/«Agotado») se DERIVA del stock — no hay toggles.
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Package, X, AlertCircle, Plus } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  variantSku, variantSkus, variantPrice,
  type VariantMappings, type InventorySku,
} from "~/store/api/catalogApi";

interface TemplateAxis { key: string; label: string; options: string[]; isColor?: boolean; }

interface Props {
  axes: TemplateAxis[];
  variantMappings: VariantMappings;
  onChange: (m: VariantMappings) => void;
  inventory: InventorySku[];
  basePrice: number;
  isLoading?: boolean;
}

// Producto cartesiano de TODAS las opciones (sin filtrar por disponibilidad).
function buildCombinations(axes: TemplateAxis[]): string[] {
  let combos: string[][] = [[]];
  for (const axis of axes) {
    const next: string[][] = [];
    for (const c of combos) for (const o of axis.options) next.push([...c, o]);
    combos = next;
  }
  return combos.map((c) => c.join(" / "));
}

export function VariantMappingTable({ axes, variantMappings, onChange, inventory, basePrice, isLoading }: Props) {
  const combinations = useMemo(() => buildCombinations(axes), [axes]);
  const stockBySku = useMemo(() => {
    const m = new Map<string, InventorySku>();
    for (const it of inventory) m.set(it.sku, it);
    return m;
  }, [inventory]);

  // Identificar variantes personalizadas (las que están en mappings pero no en combinaciones generadas)
  const customVariants = Object.keys(variantMappings).filter((c) => !combinations.includes(c));
  const allVariants = [...combinations, ...customVariants];

  const mapped = allVariants.filter((c) => variantSkus(variantMappings[c]).length > 0).length;

  // Calculamos todos los SKUs que ya están mapeados en alguna variante para no mostrarlos repetidos en la búsqueda
  const allMappedSkus = useMemo(() => {
    const set = new Set<string>();
    Object.values(variantMappings).forEach((mapping) => {
      variantSkus(mapping).forEach(s => {
        if (s) set.add(s);
      });
    });
    return set;
  }, [variantMappings]);

  return (
    <div className="space-y-3 pb-64">
      {combinations.length === 0 && customVariants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">
          La plantilla no tiene opciones.
        </div>
      ) : (
        <p className="text-xs text-muted">
          <span className="font-semibold text-text">{mapped}</span>/{allVariants.length} variantes con SKU · el resto se mostrará <span className="font-semibold text-warning">Agotado</span>.
        </p>
      )}

      {/* Grid de filas (cada fila puede tener múltiples SKUs) */}
      {allVariants.length > 0 && (
        <div className="space-y-2">
          {allVariants.map((combo) => {
            const mappedSkus = variantSkus(variantMappings[combo]);
            // Calculamos el stock sumando el stock de todos los SKUs mapeados
            const totalStock = mappedSkus.reduce((sum, s) => sum + (stockBySku.get(s)?.stock ?? 0), 0);
            return (
              <VariantRow
                key={combo}
                combo={combo}
                skus={mappedSkus}
                price={variantMappings[combo]?.price}
                inventory={inventory}
                stock={totalStock}
                basePrice={basePrice}
                isLoading={isLoading}
                onUpdate={(newSkus, newPrice) => {
                  const next = { ...variantMappings };
                  if (newSkus.every((s) => !s) && newPrice === undefined) {
                    delete next[combo];
                  } else {
                    next[combo] = { ...next[combo], skus: newSkus, sku: newSkus.find((s) => !!s) || "" };
                    if (newPrice !== undefined) next[combo].price = newPrice;
                    else delete next[combo].price;
                  }
                  onChange(next);
                }}
                excludeSkus={allMappedSkus}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Fila: chips de la combinación | Lista de SKUs | stock total ──
function VariantRow({
  combo, skus, price, inventory, stock, isLoading, basePrice, onUpdate, excludeSkus
}: {
  combo: string; skus: string[]; price?: number;
  inventory: InventorySku[]; stock: number; isLoading?: boolean; basePrice: number;
  onUpdate: (skus: string[], price?: number) => void;
  excludeSkus?: Set<string>;
}) {
  const parts = useMemo(() => combo.split(/\s*\/\s*/).filter(Boolean), [combo]);
  const validSkusCount = skus.filter(s => !!s).length;
  const hasSku = validSkusCount > 0;
  const inStock = hasSku && stock > 0;
  
  // Siempre mostrar al menos un selector, aunque esté vacío.
  const displaySkus = skus.length === 0 ? [""] : skus;

  return (
    <div className={cn(
      "flex flex-col gap-3 rounded-lg border bg-surface-2/40 p-3 transition-colors",
      hasSku ? "border-accent/20" : "border-border/50",
    )}>
      {/* Cabecera de la fila: Variante y Stock */}
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", inStock ? "bg-accent shadow-sm shadow-accent/50" : "bg-warning shadow-sm shadow-warning/50")}
            title={inStock ? `Disponible · ${stock} uds` : hasSku ? "SKU sin stock" : "Sin SKU (agotado)"} />
          <div className="flex min-w-0 flex-wrap gap-1">
            {parts.map((p, i) => (
              <span key={i} className="inline-flex shrink-0 items-center rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-text">{p}</span>
            ))}
          </div>
        </div>

        <div className="flex justify-start sm:justify-end">
          <span className={cn(
            "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold",
            inStock ? "bg-accent/15 text-accent-2" : "bg-warning/15 text-warning",
          )}>
            {!hasSku ? "Sin artículos" : inStock ? `${stock} uds` : "Agotado"}
          </span>
        </div>
      </div>

      {/* Lista de selectores de SKU */}
      <div className="space-y-2 border-l-2 border-border/40 pl-4 mt-1">
        {displaySkus.map((sku, index) => (
          <div key={index} className="flex items-center gap-2 w-full sm:max-w-md">
            <div className="flex-1 min-w-0">
              <SkuAutocomplete 
                value={sku} 
                inventory={inventory} 
                isLoading={isLoading} 
                excludeSkus={excludeSkus}
                onSelect={(newSku) => {
                  const copy = [...displaySkus];
                  copy[index] = newSku;
                  onUpdate(copy, price);
                }} 
                onClear={() => {
                  const copy = [...displaySkus];
                  copy[index] = "";
                  const cleaned = copy.filter(s => !!s);
                  onUpdate(cleaned.length > 0 ? cleaned : [], price);
                }} 
              />
            </div>
            {!sku && displaySkus.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const copy = [...displaySkus];
                  copy.splice(index, 1);
                  onUpdate(copy, price);
                }}
                className="shrink-0 rounded p-1 text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                title="Cancelar adición"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        
        {/* Precio individual de variante */}
        {hasSku && (
          <div className="flex items-start gap-3 mt-2">
            <input
              type="number"
              min={0}
              className="input h-8 w-32 text-xs"
              placeholder={`C$ ${basePrice}`}
              value={price !== undefined ? price : ""}
              onChange={(e) => {
                const val = e.target.value;
                onUpdate(displaySkus, val ? Number(val) : undefined);
              }}
            />
            <div className="flex flex-col justify-center mt-1">
              <span className="text-[10px] text-muted">Precio individual (opcional)</span>
              {(() => {
                const skuItem = inventory.find(i => i.sku === displaySkus[0]);
                if (skuItem?.price) {
                  return <span className="text-[10px] text-accent/90 font-medium">Ref. inventario: C$ {skuItem.price}</span>;
                }
                return null;
              })()}
            </div>
          </div>
        )}

        {/* Botón para vincular otro artículo (otro código de producto) */}
        {hasSku && displaySkus.every(s => !!s) && (
          <button
            type="button"
            onClick={() => onUpdate([...displaySkus, ""], price)}
            className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5 hover:text-accent-2 transition-colors mt-2"
          >
            <Plus className="h-3 w-3" /> Vincular otro artículo
          </button>
        )}
      </div>
    </div>
  );
}

// Combobox rápido contra el inventario real (SKU + nombre + stock).
function SkuAutocomplete({ value, inventory, isLoading, excludeSkus, onSelect, onClear }: {
  value: string; inventory: InventorySku[]; isLoading?: boolean;
  excludeSkus?: Set<string>;
  onSelect: (sku: string) => void; onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => inventory.find((i) => i.sku === value), [inventory, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(""); } };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    // Filtrar solo artículos con stock > 0 por petición del usuario
    let base = inventory.filter((i) => i.stock > 0);
    if (excludeSkus) {
      base = base.filter((i) => !excludeSkus.has(i.sku));
    }
    base = q ? base.filter((i) => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)) : base;
    return base.slice(0, 40);
  }, [inventory, query, excludeSkus]);

  // SKU ya asignado → chip con botón de limpiar.
  if (value) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-accent/25 bg-accent/5 px-2 py-1.5">
        <Package className="h-3 w-3 shrink-0 text-accent-2" />
        <span className="min-w-0 flex-1 truncate text-[11px] text-text">
          <span className="font-bold text-accent-2">[{selected?.sku ?? value}]</span> {selected?.name ?? "—"}
        </span>
        <button type="button" onClick={onClear} className="rounded p-0.5 text-muted hover:bg-danger/10 hover:text-danger" aria-label="Quitar SKU">
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted/60" />
      <input
        className="input h-8 w-full pl-8 text-xs"
        placeholder={isLoading ? "Cargando inventario…" : "Buscar SKU o nombre…"}
        value={query}
        disabled={isLoading}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-60 w-full min-w-[340px] overflow-y-auto rounded-xl border border-border/80 bg-surface shadow-2xl shadow-black/30">
          {results.length === 0 ? (
            <div className="flex items-center gap-2 p-3 text-xs text-muted">
              <AlertCircle className="h-3.5 w-3.5" /> {query ? "Sin resultados." : "Inventario vacío."}
            </div>
          ) : results.map((it) => (
            <button
              key={it.sku} type="button"
              onClick={() => { onSelect(it.sku); setOpen(false); setQuery(""); }}
              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-xs transition-colors hover:bg-accent/10"
            >
              <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted/60" />
              <span className="flex-1 whitespace-normal leading-relaxed">
                <span className="font-bold text-accent">[{it.sku}]</span> <span className="text-text">{it.name}</span>
              </span>
              <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold", it.stock > 0 ? "bg-accent/15 text-accent-2" : "bg-danger/15 text-danger")}>
                {it.stock > 0 ? `${it.stock} uds` : "Agotado"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
