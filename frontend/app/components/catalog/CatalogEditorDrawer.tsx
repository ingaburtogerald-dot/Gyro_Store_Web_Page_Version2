// Editor de catálogo — formulario largo scrolleable (estilo Shopify).
// Sin wizard: 4 tarjetas (General · Multimedia · Precios · Variantes). La
// disponibilidad ya NO se togglea a mano: se deriva del stock del SKU mapeado.
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff, Info, Image as ImageIcon, Tag, Layers, SlidersHorizontal, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { ColorImageManager } from "./ColorImageManager";
import { VariantMappingTable } from "./VariantMappingTable";
import {
  useGetConfigQuery,
  useGetCatalogItemQuery,
  useGetTemplatesQuery,
  useGetTemplateQuery,
  useGetInventorySkusQuery,
  useCreateCatalogItemMutation,
  useUpdateCatalogItemMutation,
  useUploadImagesMutation,
  variantSku,
  type VariantMappings,
} from "~/store/api/catalogApi";
import { FormDrawerLayout } from "~/components/ui/FormDrawerLayout";
import { cn } from "~/lib/utils";

export function CatalogEditorDrawer({
  open,
  onClose,
  editId,
}: {
  open: boolean;
  onClose: () => void;
  editId: string | null;
}) {
  const { data: config } = useGetConfigQuery();
  const { data: detail } = useGetCatalogItemQuery(editId!, { skip: !editId });
  const [createItem, { isLoading: creating }] = useCreateCatalogItemMutation();
  const [updateItem, { isLoading: updating }] = useUpdateCatalogItemMutation();
  const [uploadImages, { isLoading: uploading }] = useUploadImagesMutation();
  const { data: inventory = [], isLoading: loadingInv } = useGetInventorySkusQuery(undefined, { skip: !open });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [imagesByColor, setImagesByColor] = useState<Record<string, string[]>>({});
  const [isPromo, setIsPromo] = useState(false);
  const [published, setPublished] = useState(true);
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [variantMappings, setVariantMappings] = useState<VariantMappings>({});
  // Opciones que este producto ofrece por eje (poda estructural). { conector: ["Tipo C"], color: [...] }
  const [axisOptions, setAxisOptions] = useState<Record<string, string[]>>({});
  const [submitted, setSubmitted] = useState(false); // resalta campos inválidos tras intentar guardar

  const { data: templates = [] } = useGetTemplatesQuery(undefined, { skip: !open });
  const { data: template } = useGetTemplateQuery(templateId, { skip: !templateId });

  // Ejes con sus opciones podadas a lo que ESTE producto ofrece. La tabla y los
  // combos se generan solo sobre esto (no sobre todo el catálogo de la plantilla).
  const effectiveAxes = useMemo(
    () => (template?.axes ?? []).map((a) => ({ ...a, options: axisOptions[a.key] ?? a.options })),
    [template, axisOptions],
  );

  // Colores para el gestor de imágenes = solo los colores incluidos.
  const colorAxis = template?.axes.find((a) => a.isColor);
  const colorsForImages = useMemo(
    () => (colorAxis ? (axisOptions[colorAxis.key] ?? colorAxis.options) : ["General"]),
    [colorAxis, axisOptions],
  );

  // Alterna si el producto ofrece una opción (preserva el orden de la plantilla).
  // Un eje no puede quedar sin ninguna opción (rompería el modelo y el backend
  // interpretaría "vacío" como "todas").
  function toggleAxisOption(axisKey: string, opt: string, allOptions: string[]) {
    const cur = axisOptions[axisKey] ?? allOptions;
    if (cur.includes(opt) && cur.length <= 1) {
      toast.error("Cada eje debe ofrecer al menos una opción.");
      return;
    }
    setAxisOptions((prev) => {
      const list = prev[axisKey] ?? allOptions;
      const nextSet = list.includes(opt) ? list.filter((o) => o !== opt) : [...list, opt];
      return { ...prev, [axisKey]: allOptions.filter((o) => nextSet.includes(o)) };
    });
  }

  // Prefill al editar; limpiar al crear.
  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    if (editId && detail) {
      setName(detail.name);
      setDescription(detail.description || "");
      setCategory(detail.category);
      setImagesByColor(detail.imagesByColor || {});
      setIsPromo(!!detail.isPromo);
      setPublished(detail.published !== false);
      setTiktokUrl(detail.tiktokUrl || "");
      setCompareAtPrice(detail.compareAtPrice ? String(detail.compareAtPrice) : "");
      setTemplateId(detail.templateId || "");
      setBasePrice(detail.basePrice ? String(detail.basePrice) : "");
      setVariantMappings(detail.variantMappings || {});
      setAxisOptions(detail.axisOptions || {});
    } else if (!editId) {
      setName(""); setDescription(""); setCategory("");
      setImagesByColor({}); setIsPromo(false); setPublished(true);
      setTiktokUrl(""); setCompareAtPrice("");
      setTemplateId(""); setBasePrice(""); setVariantMappings({}); setAxisOptions({});
    }
  }, [open, editId, detail]);

  // Al cargar la plantilla: precarga descripción y asegura que cada eje tenga su
  // lista de opciones (por defecto TODAS incluidas; conserva la selección previa
  // al editar y descarta opciones que ya no existen en la plantilla).
  useEffect(() => {
    if (!template) return;
    setDescription((prev) => prev || template.description || "");
    setAxisOptions((prev) => {
      const next = { ...prev };
      for (const axis of template.axes) {
        next[axis.key] = next[axis.key]
          ? axis.options.filter((o) => next[axis.key].includes(o))
          : axis.options;
      }
      return next;
    });
  }, [template]);

  function changeTemplate(value: string) {
    setTemplateId(value);
    const t = templates.find((x) => x.id === value);
    if (t) {
      setName((n) => n || t.name || "");
      setCategory((c) => c || t.category || "");
    }
  }

  function togglePromo() {
    const next = !isPromo;
    setIsPromo(next);
    if (!next) setCompareAtPrice("");
  }

  async function uploadFiles(files: FileList): Promise<string[]> {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("images", f));
    // Al editar un producto existente, agrupa sus fotos en catalog/products/<id>/.
    // En un producto nuevo (sin id aún) se omite → caen a un bucket con fecha.
    if (editId) fd.append("productId", editId);
    try {
      const { urls } = await uploadImages(fd).unwrap();
      return urls;
    } catch {
      toast.error("No se pudieron subir las imágenes.");
      return [];
    }
  }

  // Producto cartesiano de TODAS las opciones de la plantilla (misma lógica que
  // la tabla). Sirve para el aviso de "sin SKU" al guardar.
  const allCombos = useMemo(() => {
    if (!effectiveAxes.length) return [];
    let combos: string[][] = [[]];
    for (const axis of effectiveAxes) {
      const next: string[][] = [];
      for (const c of combos) for (const o of axis.options) next.push([...c, o]);
      combos = next;
    }
    return combos.map((c) => c.join(" / "));
  }, [effectiveAxes]);

  const priceInvalid = submitted && (Number(basePrice) || 0) <= 0;
  const nameInvalid = submitted && !name.trim();

  async function save() {
    setSubmitted(true);
    if (!name.trim() || !category || !templateId) return toast.error("Nombre, categoría y plantilla son obligatorios.");
    // Eliminada la validación estricta de basePrice ya que ahora los precios van en las variantes.
    let calculatedBasePrice = Number(basePrice) || 0;
    if (calculatedBasePrice === 0) {
      // Auto-calcular basePrice buscando el menor precio entre las variantes mapeadas
      let minPrice = Infinity;
      Object.values(variantMappings).forEach(m => {
        if (m.price) minPrice = Math.min(minPrice, m.price);
        else {
           // buscar en inventario
           const skuItem = inventory.find(i => i.sku === m.sku);
           if (skuItem && skuItem.price) minPrice = Math.min(minPrice, skuItem.price);
        }
      });
      if (minPrice !== Infinity) calculatedBasePrice = minPrice;
    }

    // Aviso: combos sin SKU se mostrarán como «Agotado» permanente.
    const unmapped = allCombos.filter((c) => !variantSku(variantMappings[c])).length;
    if (unmapped > 0) {
      const ok = window.confirm(
        `${unmapped} de ${allCombos.length} variantes no tienen SKU asignado: se mostrarán como «Agotado». ¿Guardar de todos modos?`,
      );
      if (!ok) return;
    }

    const validImagesByColor: Record<string, string[]> = {};
    for (const color of colorsForImages) {
      if (imagesByColor[color]?.length) validImagesByColor[color] = imagesByColor[color];
    }

    const body = {
      name, description, category, imagesByColor: validImagesByColor, isPromo, published, tiktokUrl,
      compareAtPrice: Number(compareAtPrice) || 0,
      templateId,
      basePrice: calculatedBasePrice,
      variantMappings, // { "Rojo / M": { sku, price? } }
      axisOptions,     // qué opciones ofrece este producto por eje
    };

    try {
      if (editId) await updateItem({ id: editId, body }).unwrap();
      else await createItem(body).unwrap();
      toast.success(editId ? "Producto actualizado." : "Producto creado.");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo guardar.");
    }
  }

  return (
    <FormDrawerLayout
      open={open}
      onClose={onClose}
      maxWidth="max-w-3xl"
      title={editId ? "Editar producto" : "Nuevo producto"}
      headerActions={
        <button
          type="button" role="switch" aria-checked={published}
          onClick={() => setPublished((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-semibold transition-colors",
            published ? "border-accent/30 bg-accent/10 text-accent-2" : "border-border bg-surface-2 text-muted",
          )}
        >
          {published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {published ? "Publicado" : "Borrador"}
        </button>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-xs text-muted/60">Los cambios afectarán a todas las versiones del producto.</p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} loading={creating || updating}>
              <Check className="mr-2 h-4 w-4" /> {editId ? "Guardar" : "Crear producto"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* ── Tarjeta 1: Información general ── */}
        <SectionCard icon={Info} title="Información general" subtitle="Nombre, categoría y plantilla base.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoría">
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Selecciona…</option>
                {config?.categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </Field>
            <Field label="Plantilla">
              <select className="input" value={templateId} onChange={(e) => changeTemplate(e.target.value)}>
                <option value="">Selecciona una plantilla…</option>
                {templates.filter((t) => !category || t.category === category).map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Nombre">
                    <input className={cn("input", nameInvalid && "border-danger focus:border-danger")} value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field label="Descripción">
                    <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descripción detallada del producto…" />
                  </Field>
                </SectionCard>

                {/* ── Tarjeta 2: Opciones que ofrece este producto ── */}
                {template && (
                  <SectionCard icon={SlidersHorizontal} title="Opciones del producto" subtitle="Enciende solo lo que este producto ofrece. Lo apagado no existe para el cliente.">
                    <div className="space-y-3">
                      {template.axes.map((axis) => {
                        const included = axisOptions[axis.key] ?? axis.options;
                        return (
                          <div key={axis.key}>
                            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted/90">{axis.label}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {axis.options.map((opt) => {
                                const on = included.includes(opt);
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    role="switch"
                                    aria-checked={on}
                                    onClick={() => toggleAxisOption(axis.key, opt, axis.options)}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-semibold transition-all",
                                      on
                                        ? "border-transparent bg-gradient-accent text-white shadow-sm shadow-accent/25"
                                        : "border-border bg-surface-2 text-muted opacity-70 hover:border-accent/40 hover:text-text hover:opacity-100",
                                    )}
                                  >
                                    {on
                                      ? <Check className="h-3.5 w-3.5 shrink-0" />
                                      : <span className="h-3 w-3 shrink-0 rounded-full border border-current" />}
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>
                )}

                {/* ── Tarjeta 3: Multimedia ── */}
                <SectionCard icon={ImageIcon} title="Multimedia" subtitle={colorAxis ? "Fotos por color (máx 10 c/u) + video." : "Fotos del producto (máx 10) + video."}>
                  <ColorImageManager
                    colors={colorsForImages}
                    imagesByColor={imagesByColor}
                    onChange={setImagesByColor}
                    upload={uploadFiles}
                    uploading={uploading}
                  />
                  <Field label="Video de TikTok (URL)">
                    <input className="input" value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder="https://www.tiktok.com/@.../video/..." />
                  </Field>
                </SectionCard>


                {/* ── Tarjeta 5: Variantes y SKU ── */}
                <SectionCard icon={Layers} title="Variantes y SKU" subtitle="Asigna un SKU a cada variante. El stock y la disponibilidad se leen del inventario en vivo.">
                  {template ? (
                    <VariantMappingTable
                      axes={effectiveAxes}
                      variantMappings={variantMappings}
                      onChange={setVariantMappings}
                      inventory={inventory}
                      basePrice={Number(basePrice) || 0}
                      isLoading={loadingInv}
                    />
                  ) : (
                    <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted">
                      Elige una plantilla en la Tarjeta 1 para generar las variantes.
                    </p>
                  )}
                </SectionCard>
      </div>
    </FormDrawerLayout>
  );
}

// ── Tarjeta de sección: header con ícono + cuerpo. Reusa el material glass. ──
function SectionCard({ icon: Icon, title, subtitle, children }: {
  icon: React.ElementType; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-border bg-surface shadow-premium">
      <header className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent-2">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
      </header>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted/90">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onToggle} className="flex w-full items-center justify-between text-left">
      <span className={cn("text-sm transition-colors", on ? "text-text" : "text-muted")}>{label}</span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-gradient-accent" : "bg-border")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}
