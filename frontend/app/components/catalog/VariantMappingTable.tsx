// Tabla de Combinaciones con Combobox Inteligente para asignar SKUs de bodega.
// Genera el producto cartesiano de las opciones ENCENDIDAS de cada eje y muestra
// una fila por combinación. Cada combinación puede mapear a VARIOS códigos de
// bodega que son la misma variante en distintas tandas (ej: IN13 e IN98); el stock
// mostrado al cliente es la suma de todos. Un filtro de "pool" acota la bodega al
// producto actual (prellenado con su nombre) y el botón "Auto-mapear todas" asigna
// todos los matches difusos de cada combinación de golpe.
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Package, AlertCircle, Zap, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { variantSkus, type Availability, type VariantMappings, type WarehouseProduct } from "~/store/api/catalogApi";

interface TemplateAxis {
  key: string;
  label: string;
  options: string[];
}

interface Props {
  axes: TemplateAxis[];
  availability: Availability;
  variantMappings: VariantMappings;
  onChange: (mappings: VariantMappings) => void;
  warehouseProducts: WarehouseProduct[];
  productName: string;
  isLoading?: boolean;
}

// Genera las combinaciones (producto cartesiano) de las opciones encendidas.
function buildCombinations(axes: TemplateAxis[], availability: Availability): string[] {
  let combos: string[][] = [[]];

  for (const axis of axes) {
    const enabledOpts = axis.options.filter((opt) => {
      const val = availability[axis.key]?.[opt];
      if (val === undefined) return true; // si no hay dato, se asume encendido
      if (typeof val === "object" && val !== null) return val.enabled !== false;
      return val !== false;
    });

    const next: string[][] = [];
    for (const combo of combos) {
      for (const opt of enabledOpts) {
        next.push([...combo, opt]);
      }
    }
    combos = next;
  }

  return combos.map((c) => c.join(" / "));
}
// Stopwords que se ignoran al extraer keywords (preposiciones, artículos, conectores).
const STOPWORDS = new Set([
  "con", "sin", "de", "del", "para", "por", "la", "el", "los", "las",
  "un", "una", "y", "o", "en", "a", "al", "e", "que", "se",
]);

// Extrae palabras clave significativas de un string, ignorando stopwords y tokens cortos.
function extractKeywords(text: string): string[] {
  return text
    .split(/[\s/|·\-–—,]+/)
    .map((w) => w.toLowerCase().trim().replace(/[()\[\]]/g, ""))
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

// Cuenta cuántas keywords aparecen en el texto (code + name de un producto).
function scoreFor(text: string, keywords: string[]): number {
  const haystack = text.toLowerCase();
  let score = 0;
  for (const kw of keywords) if (haystack.includes(kw)) score++;
  return score;
}

export function VariantMappingTable({ axes, availability, variantMappings, onChange, warehouseProducts, productName, isLoading }: Props) {
  const combinations = useMemo(
    () => buildCombinations(axes, availability),
    [axes, availability],
  );

  // Pool: acota la bodega al producto actual. Si el campo está vacío, usa el
  // nombre del producto en vivo; si el admin escribe, ese override manda.
  const [poolQuery, setPoolQuery] = useState("");
  const effectiveQuery = poolQuery.trim() || productName;

  const pool = useMemo(() => {
    // Solo se ofrecen artículos CON stock disponible (los agotados no se mapean).
    const inStock = warehouseProducts.filter((p) => (p.stock || 0) > 0);
    const keywords = extractKeywords(effectiveQuery);
    if (keywords.length === 0) return inStock;
    const threshold = Math.max(1, Math.ceil(keywords.length * 0.5));
    return inStock
      .map((p) => ({ p, score: scoreFor(`${p.code || ""} ${p.name || ""}`, keywords) }))
      .filter((e) => e.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .map((e) => e.p);
  }, [warehouseProducts, effectiveQuery]);

  // Agrega un código a una combinación (sin duplicar). Guarda en formato { skus: [...] }.
  function addSku(comboName: string, sku: string) {
    const current = variantSkus(variantMappings[comboName]);
    if (current.includes(sku)) return;
    onChange({ ...variantMappings, [comboName]: { skus: [...current, sku] } });
  }

  // Quita un código de una combinación. Si queda vacía, borra la entrada.
  function removeSku(comboName: string, sku: string) {
    const current = variantSkus(variantMappings[comboName]).filter((s) => s !== sku);
    const next = { ...variantMappings };
    if (current.length) next[comboName] = { skus: current };
    else delete next[comboName];
    onChange(next);
  }

  // Asigna TODOS los matches difusos del pool a cada combinación que cumpla la
  // condición de variante (>= umbral de keywords). No duplica lo ya asignado.
  function autoMapAll() {
    const next: VariantMappings = { ...variantMappings };
    let added = 0;
    for (const combo of combinations) {
      const keywords = extractKeywords(`${productName} ${combo}`);
      const threshold = Math.max(2, Math.ceil(keywords.length * 0.5));
      const existing = new Set(variantSkus(next[combo]));
      const matches = pool
        .map((p) => ({ p, score: scoreFor(`${p.code || ""} ${p.name || ""}`, keywords) }))
        .filter((e) => e.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .map((e) => e.p.code)
        .filter((code) => code && !existing.has(code));
      if (matches.length) {
        next[combo] = { skus: [...existing, ...matches] };
        added += matches.length;
      }
    }
    onChange(next);
    const pending = combinations.filter((c) => variantSkus(next[c]).length === 0).length;
    if (added === 0) {
      toast.info("No se encontraron coincidencias claras. Asigná manualmente o ajustá el filtro de bodega.");
    } else {
      toast.success(
        `${added} código${added === 1 ? "" : "s"} asignado${added === 1 ? "" : "s"} automáticamente.` +
        (pending ? ` Quedan ${pending} combinación${pending === 1 ? "" : "es"} sin mapear.` : ""),
      );
    }
  }

  if (combinations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">
        No hay combinaciones disponibles. Enciende al menos una opción por eje.
      </div>
    );
  }

  const mappedCount = combinations.filter((c) => variantSkus(variantMappings[c]).length > 0).length;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-2/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Package className="h-4 w-4 text-accent shrink-0" />
          <p className="text-sm font-semibold text-text">Mapeo de variantes a bodega</p>
        </div>
        <span className={cn(
          "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide",
          mappedCount === combinations.length
            ? "bg-accent/15 text-accent-2"
            : mappedCount > 0
              ? "bg-warning/15 text-warning"
              : "bg-surface-2 text-muted",
        )}>
          {mappedCount}/{combinations.length} mapeadas
        </span>
      </div>

      {/* Filtro de pool (prellenado con el nombre) + auto-mapeo en bloque */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted/60 pointer-events-none" />
          <input
            className="input h-8 w-full pl-8 text-xs"
            placeholder={productName ? `Bodega: ${productName}` : "Filtrar bodega por nombre…"}
            value={poolQuery}
            onChange={(e) => setPoolQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={autoMapAll}
          disabled={isLoading || pool.length === 0}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg transition-colors hover:bg-accent/85 disabled:cursor-not-allowed disabled:opacity-40"
          title="Asigna todos los códigos de bodega que coincidan con cada combinación"
        >
          <Zap className="h-3.5 w-3.5" />
          Auto-mapear todas
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-muted">
        {pool.length} artículo{pool.length === 1 ? "" : "s"} de bodega coinciden. Podés asignar <span className="font-semibold text-text">varios códigos</span> a una misma combinación (ej: tandas distintas de la misma variante); el stock se suma. Las que queden sin asignar se mostrarán como <span className="font-semibold text-warning/80">Agotado</span>.
      </p>

      <div className="space-y-1.5 pr-0.5 pb-32">
        {combinations.map((combo) => (
          <VariantRow
            key={combo}
            comboName={combo}
            productName={productName}
            skus={variantSkus(variantMappings[combo])}
            pool={pool}
            allProducts={warehouseProducts}
            isLoading={isLoading}
            onAdd={(sku) => addSku(combo, sku)}
            onRemove={(sku) => removeSku(combo, sku)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Fila individual con chips de códigos asignados + combobox para agregar ──

function VariantRow({
  comboName,
  productName,
  skus,
  pool,
  allProducts,
  isLoading,
  onAdd,
  onRemove,
}: {
  comboName: string;
  productName: string;
  skus: string[];
  pool: WarehouseProduct[];
  allProducts: WarehouseProduct[];
  isLoading?: boolean;
  onAdd: (sku: string) => void;
  onRemove: (sku: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasSkus = skus.length > 0;

  // Productos asignados (se buscan en TODA la bodega para que resuelvan aunque
  // hayan quedado fuera del pool filtrado), y stock total sumado.
  const assignedProducts = useMemo(
    () => skus.map((code) => allProducts.find((p) => p.code === code) ?? { id: code, code, name: "—", stock: 0 }),
    [skus, allProducts],
  );
  const totalStock = useMemo(() => assignedProducts.reduce((s, p) => s + (p.stock || 0), 0), [assignedProducts]);

  // Keywords del producto + variante combinadas (ej: ["kz", "edx", "pro", "jack", "3.5mm", "negro"])
  const allKeywords = useMemo(
    () => extractKeywords(`${productName} ${comboName}`),
    [productName, comboName],
  );

  // Filtro estricto sobre el POOL ya acotado al producto: solo los que coincidan
  // con >=50% de keywords (mínimo 2). Excluye los ya asignados.
  const strictMatches = useMemo(() => {
    const base = allKeywords.length === 0
      ? pool
      : pool
          .map((p) => ({ product: p, score: scoreFor(`${p.code || ""} ${p.name || ""}`, allKeywords) }))
          .filter((entry) => entry.score >= Math.max(2, Math.ceil(allKeywords.length * 0.5)))
          .sort((a, b) => b.score - a.score)
          .map((entry) => entry.product);
    return base.filter((p) => !skus.includes(p.code));
  }, [pool, allKeywords, skus]);

  // Sin búsqueda → strictMatches (del pool). Con búsqueda → toda la bodega (escape manual).
  const filtered = useMemo(() => {
    if (!search.trim()) return strictMatches;
    const q = search.toLowerCase().trim();
    return allProducts.filter(
      (p) =>
        !skus.includes(p.code) &&
        (p.stock || 0) > 0 &&
        ((p.code || "").toLowerCase().includes(q) || (p.name || "").toLowerCase().includes(q)),
    );
  }, [allProducts, strictMatches, search, skus]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleSelect(product: WarehouseProduct) {
    onAdd(product.code);
    setSearch("");
    inputRef.current?.focus(); // permite agregar varios seguidos
  }

  // Badges: separa el nombre de la combinación por "/" en chips individuales.
  const comboParts = useMemo(
    () => comboName.split(/\s*\/\s*/).filter(Boolean),
    [comboName],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "group/row relative rounded-lg border bg-surface-2/40 p-2.5 transition-all duration-200",
        "hover:bg-surface-2/60 focus-within:bg-surface-2/80",
        hasSkus ? "border-accent/20" : "border-border/50",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Semáforo + Badges de la combinación */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5 pt-1">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full transition-colors",
              hasSkus ? "bg-accent shadow-sm shadow-accent/50" : "bg-warning shadow-sm shadow-warning/50",
            )}
            title={hasSkus ? `${skus.length} código(s) · stock ${totalStock}` : "Sin asignar (agotado)"}
          />
          <div className="flex min-w-0 flex-wrap gap-1">
            {comboParts.map((part, i) => (
              <span
                key={i}
                className="inline-flex shrink-0 items-center rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-text"
              >
                {part}
              </span>
            ))}
          </div>
        </div>

        {/* Columna de asignación: chips de códigos + combobox para agregar */}
        <div className="relative w-full sm:w-64 shrink-0 space-y-1.5">
          {/* Chips de códigos ya asignados */}
          {assignedProducts.map((p) => (
            <div key={p.code} className="flex items-center gap-1.5 rounded-lg border border-accent/25 bg-accent/5 px-2.5 py-1.5">
              <Package className="h-3 w-3 shrink-0 text-accent-2" />
              <span className="flex-1 text-[11px] text-text leading-tight">
                <span className="font-bold text-accent-2">[{p.code}]</span>{" "}
                {p.name}
                <span className="ml-1 text-muted">({p.stock})</span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(p.code)}
                className="rounded p-0.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                aria-label={`Quitar ${p.code}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Stock total cuando hay más de un código */}
          {skus.length > 1 && (
            <p className="px-1 text-right text-[10px] font-semibold text-accent-2/80">
              Stock total: {totalStock} uds
            </p>
          )}

          {/* Input para agregar otro código */}
          <div className="relative">
            <Plus className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted/60 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              className="input h-7 w-full rounded-lg pl-7 text-[11px]"
              placeholder={isLoading ? "Cargando..." : hasSkus ? "Agregar otro código…" : "Asignar código…"}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (!open) setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              disabled={isLoading}
            />

            {/* Dropdown de resultados */}
            {open && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border/80 bg-surface shadow-2xl shadow-black/30 backdrop-blur-sm">
                {filtered.length === 0 ? (
                  <div className="p-3 space-y-1">
                    <div className="flex items-center gap-2 text-[11px] text-muted">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {search ? "Sin resultados para tu búsqueda" : "No hay más coincidencias para esta variante"}
                    </div>
                    {!search && (
                      <p className="pl-5.5 text-[10px] text-muted/70">
                        Escribí para buscar manualmente en toda la bodega.
                      </p>
                    )}
                  </div>
                ) : (
                  filtered.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleSelect(product)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] transition-colors hover:bg-accent/10"
                    >
                      <Package className="h-3 w-3 shrink-0 text-muted/60" />
                      <span className="flex-1 leading-tight">
                        <span className="font-bold text-accent">[{product.code}]</span>{" "}
                        <span className="text-text">{product.name}</span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold",
                          product.stock > 0 ? "bg-accent/15 text-accent-2" : "bg-danger/15 text-danger",
                        )}
                      >
                        {product.stock > 0 ? `${product.stock} uds` : "Agotado"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
