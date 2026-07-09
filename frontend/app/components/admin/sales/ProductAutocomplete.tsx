import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "~/lib/utils";

// Definimos una interfaz local que sea compatible con SellableProduct
interface ProductOption {
  id: string;
  code: string;
  name: string;
  stock: number;
  origin?: "native" | "migrated" | string;
}

export function ProductAutocomplete({
  products,
  value,
  onChange,
  invalid,
}: {
  products: ProductOption[];
  value: string;
  onChange: (productId: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Pequeño timeout para asegurar que el input ya se renderizó
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedProduct = useMemo(() => products.find((p) => p.id === value), [products, value]);

  const filtered = useMemo(() => {
    if (!search) return products;
    const lower = search.toLowerCase();
    return products.filter((p) => 
      p.name.toLowerCase().includes(lower) || 
      p.code.toLowerCase().includes(lower)
    );
  }, [products, search]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div
        className={cn(
          "input flex items-center justify-between cursor-text overflow-hidden min-h-[42px]",
          invalid && "border-danger focus:border-danger",
          open && "ring-2 ring-accent border-accent"
        )}
        onClick={() => setOpen(true)}
      >
        <div className="flex-1 flex items-center h-full">
          {selectedProduct && !open ? (
            <div className="flex items-center gap-2 text-sm w-full">
              <span className="font-mono text-xs text-muted bg-surface-2 px-1.5 py-0.5 rounded">[{selectedProduct.code}]</span>
              <span className="font-medium truncate">{selectedProduct.name}</span>
            </div>
          ) : (
            <input
              ref={inputRef}
              className="bg-transparent border-none outline-none w-full h-full text-sm placeholder:text-muted/50"
              placeholder={selectedProduct ? "Escribe para cambiar..." : "Buscar por código o nombre..."}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (!open) setOpen(true);
              }}
              onFocus={() => setOpen(true)}
            />
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted shrink-0 transition-transform", open && "rotate-180")} />
      </div>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 max-h-64 w-full overflow-auto rounded-card border border-border bg-surface-2 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-sm text-muted">No se encontraron productos.</div>
          ) : (
            <div className="p-1 flex flex-col gap-0.5">
              {filtered.map((pr) => (
                <button
                  key={pr.id}
                  type="button"
                  className={cn(
                    "w-full flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                    value === pr.id ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface hover:text-text"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(pr.id);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <div className="flex flex-col gap-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="font-mono text-xs opacity-70 shrink-0">[{pr.code}]</span>
                      <span className="font-semibold truncate">{pr.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs opacity-80">
                      <span className={cn(pr.stock <= 0 && "text-danger font-bold")}>Stock: {pr.stock}</span>
                      {pr.origin === "migrated" && (
                        <span className="rounded-pill bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                          Migrado
                        </span>
                      )}
                    </div>
                  </div>
                  {value === pr.id && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
