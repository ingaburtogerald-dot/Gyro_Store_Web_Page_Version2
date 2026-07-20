// Crear/editar un combo: se siente como agregar "otro producto más" — foto
// (opcional), los 2 productos que lo componen, nombre, precio del paquete y un
// toggle de estado. Una vista previa en vivo (mismo patrón que
// HeroSlideEditorModal) muestra exactamente cómo se va a ver la card en la
// tienda antes de guardar. El backend valida 2 productos distintos y precio > 0.
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Check, Upload, Eye, EyeOff, Loader2, Sparkles, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { formatCordobas } from "~/lib/utils";
import {
  useGetAdminCatalogQuery,
  useCreateComboMutation,
  useUpdateComboMutation,
  useUploadComboImageMutation,
  type CatalogProduct,
  type Combo,
} from "~/store/api/catalogApi";

export function ComboEditorModal({
  open,
  onClose,
  combo,
}: {
  open: boolean;
  onClose: () => void;
  combo: Combo | null;
}) {
  const { data: products = [] } = useGetAdminCatalogQuery();
  const [createCombo, { isLoading: creating }] = useCreateComboMutation();
  const [updateCombo, { isLoading: updating }] = useUpdateComboMutation();
  const [uploadComboImage, { isLoading: uploading }] = useUploadComboImageMutation();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [active, setActive] = useState(true);
  const [ids, setIds] = useState<[string | null, string | null]>([null, null]);
  const [image, setImage] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rellena el formulario al abrir (edición) o lo limpia (creación).
  useEffect(() => {
    if (!open) return;
    if (combo) {
      setName(combo.name || "");
      setPrice(String(combo.price || ""));
      setActive(combo.active);
      setIds([combo.productIds[0] ?? null, combo.productIds[1] ?? null]);
      setImage(combo.image || "");
    } else {
      setName("");
      setPrice("");
      setActive(true);
      setIds([null, null]);
      setImage("");
    }
  }, [open, combo]);

  const byId = useMemo(() => {
    const m = new Map<string, CatalogProduct>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const selected = [ids[0] ? byId.get(ids[0]) : null, ids[1] ? byId.get(ids[1]) : null];
  const normalTotal = selected.reduce((sum, p) => sum + (p?.price || 0), 0);
  const priceNum = Number(price) || 0;
  const savings = Math.max(0, normalTotal - priceNum);

  const bothChosen = Boolean(ids[0] && ids[1]);
  const canSave = bothChosen && priceNum > 0 && ids[0] !== ids[1];

  async function handleFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    if (combo?.id) fd.append("comboId", combo.id);
    try {
      const res = await uploadComboImage(fd).unwrap();
      setImage(res.url);
      toast.success("Foto subida. Recuerda guardar los cambios.");
    } catch (e: any) {
      toast.error(e?.data?.error || "No se pudo subir la foto.");
    }
  }

  async function save() {
    if (!canSave) return;
    const body = {
      name: name.trim(),
      productIds: [ids[0]!, ids[1]!],
      price: priceNum,
      active,
      image,
    };
    try {
      if (combo) {
        await updateCombo({ id: combo.id, body }).unwrap();
        toast.success("Combo actualizado.");
      } else {
        await createCombo(body).unwrap();
        toast.success("Combo creado.");
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo guardar el combo.");
    }
  }

  const previewName = name.trim() || (bothChosen ? `${selected[0]?.name} + ${selected[1]?.name}` : "Nombre del combo");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={combo ? "Editar combo" : "Nuevo combo"}
      maxWidth="max-w-xl"
      headerRight={
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showPreview ? "Ocultar" : "Vista previa"}
        </button>
      }
    >
      <div className="space-y-5">
        {/* ── Vista previa: cómo se va a ver la card en la tienda ── */}
        {showPreview && (
          <div className="flex justify-center rounded-2xl border border-border bg-bg p-5">
            <ComboCardPreview
              name={previewName}
              image={image}
              imageA={selected[0]?.images?.[0]}
              imageB={selected[1]?.images?.[0]}
              price={priceNum}
              normalTotal={normalTotal}
              savings={savings}
            />
          </div>
        )}

        {/* a) Foto del combo (opcional) */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Foto del combo</label>
          <p className="mb-2 text-xs leading-relaxed text-muted">
            Opcional. Si no subís una, se arma sola con las fotos de los 2 productos.
          </p>
          <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-2/40 p-3">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
              {image ? (
                <img src={image} alt="" className="h-full w-full object-contain p-1" />
              ) : (
                <ImageOff className="h-5 w-5 text-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {image ? "Cambiar foto" : "Subir foto"}
                </Button>
                {image && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImage("")} disabled={uploading}>
                    <X className="h-4 w-4" /> Quitar
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* b) Selección de los 2 productos */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
          <ProductSlot
            label="Producto A"
            products={products}
            selectedId={ids[0]}
            disabledId={ids[1]}
            onSelect={(id) => setIds([id, ids[1]])}
            onClear={() => setIds([null, ids[1]])}
          />
          <div className="grid place-items-center py-2 text-2xl font-light text-muted sm:pt-16">+</div>
          <ProductSlot
            label="Producto B"
            products={products}
            selectedId={ids[1]}
            disabledId={ids[0]}
            onSelect={(id) => setIds([ids[0], id])}
            onClear={() => setIds([ids[0], null])}
          />
        </div>

        {/* c) Nombre opcional */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Nombre del combo (opcional)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              bothChosen ? `${selected[0]?.name} + ${selected[1]?.name}` : "Se genera automático (A + B)"
            }
            className="input w-full"
          />
        </div>

        {/* d) Precio del paquete + resumen de ahorro */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Precio del paquete *</label>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              className="input w-full"
            />
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-3 text-sm">
            <div className="flex justify-between text-muted">
              <span>Suma normal:</span>
              <span className="tabular-nums">{formatCordobas(normalTotal)}</span>
            </div>
            <div className="mt-1 flex justify-between font-semibold text-accent">
              <span>Ahorro:</span>
              <span className="tabular-nums">{formatCordobas(savings)}</span>
            </div>
          </div>
        </div>

        {/* e) Activo */}
        <label className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setActive((a) => !a)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${active ? "bg-accent" : "bg-surface-2"}`}
            aria-pressed={active}
          >
            <span
              className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${active ? "translate-x-[22px]" : "translate-x-0.5"}`}
            />
          </button>
          <span className="font-medium">{active ? "Activo (visible en la tienda)" : "Inactivo (oculto)"}</span>
        </label>

        {priceNum > normalTotal && bothChosen && (
          <p className="text-xs text-warning">
            El precio del paquete es mayor que la suma normal: no habría descuento.
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={creating || updating} disabled={!canSave}>
            {combo ? "Guardar cambios" : "Crear combo"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Réplica en miniatura de ComboCard.tsx (tienda): misma lógica de imagen (foto
// propia > split de los 2 productos), mismo badge Combo, mismo tratamiento de
// precio/ahorro — así lo que se ve acá es lo que se va a ver en la tienda.
function ComboCardPreview({
  name,
  image,
  imageA,
  imageB,
  price,
  normalTotal,
  savings,
}: {
  name: string;
  image: string;
  imageA?: string;
  imageB?: string;
  price: number;
  normalTotal: number;
  savings: number;
}) {
  const onSale = savings > 0;

  return (
    <div className="w-56 overflow-hidden rounded-xl border border-white/10 bg-surface">
      <div className="product-stage relative aspect-square w-full overflow-hidden">
        <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[10px] font-bold text-bg">
          <Sparkles className="h-2.5 w-2.5" /> Combo
        </span>
        {onSale && (
          <span className="absolute right-2 top-2 z-10 rounded-md bg-accent px-2 py-0.5 text-[10px] font-bold text-bg">
            Ahorrás {formatCordobas(savings)}
          </span>
        )}

        {image ? (
          <img src={image} alt="" className="h-full w-full object-contain p-4" />
        ) : imageA || imageB ? (
          <div className="flex h-full items-center gap-1 p-3">
            <div className="grid h-full flex-1 place-items-center">
              {imageA ? (
                <img src={imageA} alt="" className="h-full w-full object-contain" />
              ) : (
                <ImageOff className="h-6 w-6 text-muted" />
              )}
            </div>
            <span className="text-lg font-light text-muted">+</span>
            <div className="grid h-full flex-1 place-items-center">
              {imageB ? (
                <img src={imageB} alt="" className="h-full w-full object-contain" />
              ) : (
                <ImageOff className="h-6 w-6 text-muted" />
              )}
            </div>
          </div>
        ) : (
          <div className="grid h-full place-items-center text-muted">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-3">
        <p className="line-clamp-2 text-xs font-bold leading-snug text-text">{name}</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-extrabold tabular-nums text-accent">{formatCordobas(price)}</span>
          {onSale && (
            <span className="text-[10px] text-muted line-through tabular-nums">{formatCordobas(normalTotal)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Un "slot" de producto: si no hay seleccionado, muestra un buscador; si lo hay,
// muestra la tarjeta con botón para quitarlo. `disabledId` evita elegir el mismo
// producto en ambos lados.
function ProductSlot({
  label,
  products,
  selectedId,
  disabledId,
  onSelect,
  onClear,
}: {
  label: string;
  products: CatalogProduct[];
  selectedId: string | null;
  disabledId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const selected = selectedId ? products.find((p) => p.id === selectedId) : null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.id !== disabledId && p.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, products, disabledId]);

  if (selected) {
    return (
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <div className="relative flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/5 p-2.5">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
            {selected.images?.[0] && (
              <img src={selected.images[0]} alt="" className="h-full w-full object-contain" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selected.name}</p>
            <p className="text-xs text-muted tabular-nums">{formatCordobas(selected.price)}</p>
          </div>
          <button
            onClick={onClear}
            className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-danger"
            aria-label="Quitar producto"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 focus-within:border-accent">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto…"
          className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted"
        />
      </div>
      {results.length > 0 && (
        <ul className="mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-border bg-surface custom-scrollbar">
          {results.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => {
                  onSelect(p.id);
                  setQuery("");
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2"
              >
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-surface-2">
                  {p.images?.[0] && <img src={p.images[0]} alt="" className="h-full w-full object-contain" />}
                </div>
                <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                <span className="text-xs text-muted tabular-nums">{formatCordobas(p.price)}</span>
                <Check className="h-4 w-4 shrink-0 text-transparent" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
