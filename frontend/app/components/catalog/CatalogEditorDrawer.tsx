// Drawer para crear/editar un ítem del catálogo (basado en plantillas).
// Flujo: nombre → categoría → se elige una plantilla disponible en esa categoría;
// sus ejes se muestran como toggles On/Off (lo apagado se ve "agotado" al cliente),
// el admin pone un precio base y sube fotos por cada color encendido. No toca inventario.
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { ColorImageManager } from "./ColorImageManager";
import {
  useGetConfigQuery,
  useGetCatalogItemQuery,
  useGetTemplatesQuery,
  useGetTemplateQuery,
  useCreateCatalogItemMutation,
  useUpdateCatalogItemMutation,
  useUploadImagesMutation,
  type Availability,
} from "~/store/api/catalogApi";
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
  const [availability, setAvailability] = useState<Availability>({});

  const { data: templates = [] } = useGetTemplatesQuery({ category }, { skip: !open || !category });
  const { data: template } = useGetTemplateQuery(templateId, { skip: !templateId });

  // Colores encendidos del eje de color de la plantilla.
  const colorAxis = template?.axes.find((a) => a.isColor);
  const colorsForImages = useMemo(() => {
    if (!colorAxis) return ["General"];
    return colorAxis.options.filter((o) => availability[colorAxis.key]?.[o] !== false);
  }, [colorAxis, availability]);

  // Prefill al editar; limpiar al crear.
  useEffect(() => {
    if (!open) return;
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
      setAvailability(detail.availability || {});
    } else if (!editId) {
      setName(""); setDescription(""); setCategory("");
      setImagesByColor({}); setIsPromo(false); setPublished(true);
      setTiktokUrl(""); setCompareAtPrice("");
      setTemplateId(""); setBasePrice(""); setAvailability({});
    }
  }, [open, editId, detail]);

  // Al cargar la plantilla: inicializa la disponibilidad (todo encendido por
  // defecto, conservando lo ya guardado). Las specs se heredan de la plantilla
  // y se muestran al cliente desde el backend (no se editan por producto).
  // También precarga la descripción si el producto no tiene una.
  useEffect(() => {
    if (!template) return;
    setAvailability((prev) => {
      const next: Availability = {};
      for (const axis of template.axes) {
        next[axis.key] = {};
        for (const opt of axis.options) next[axis.key][opt] = prev[axis.key]?.[opt] ?? true;
      }
      return next;
    });
    setDescription((prev) => prev || template.description || "");
  }, [template]);

  function changeCategory(value: string) {
    setCategory(value);
    setTemplateId(""); // las plantillas dependen de la categoría
    setAvailability({});
  }

  function toggleOption(axisKey: string, opt: string) {
    setAvailability((prev) => {
      const on = prev[axisKey]?.[opt] !== false;
      return { ...prev, [axisKey]: { ...(prev[axisKey] || {}), [opt]: !on } };
    });
  }

  function togglePromo() {
    const next = !isPromo;
    setIsPromo(next);
    if (!next) setCompareAtPrice(""); // al apagar la promo, limpia el precio
  }

  async function uploadFiles(files: FileList): Promise<string[]> {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("images", f));
    try {
      const { urls } = await uploadImages(fd).unwrap();
      return urls;
    } catch {
      toast.error("No se pudieron subir las imágenes.");
      return [];
    }
  }

  async function save() {
    if (!name.trim() || !category) return toast.error("Nombre y categoría son obligatorios.");
    if (!templateId) return toast.error("Selecciona una plantilla.");
    if ((Number(basePrice) || 0) <= 0) return toast.error("Ingresa un precio base válido.");
    if (isPromo && (Number(compareAtPrice) || 0) <= (Number(basePrice) || 0)) {
      return toast.error("El precio antes de la oferta debe ser mayor al precio base.");
    }

    // Filtrar imagesByColor para que solo guarde las llaves válidas (los colores encendidos, o "General")
    const validImagesByColor: Record<string, string[]> = {};
    for (const color of colorsForImages) {
      if (imagesByColor[color] && imagesByColor[color].length > 0) {
        validImagesByColor[color] = imagesByColor[color];
      }
    }

    const body = {
      name, description, category, imagesByColor: validImagesByColor, isPromo, published, tiktokUrl,
      compareAtPrice: Number(compareAtPrice) || 0,
      templateId,
      basePrice: Number(basePrice) || 0,
      availability,
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
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative flex w-full max-w-xl max-h-[85vh] flex-col rounded-card border border-border bg-surface shadow-2xl overflow-hidden pointer-events-auto"
            >
              <header className="flex items-center justify-between border-b border-border p-4 bg-surface/50">
                <h2 className="text-lg font-bold">{editId ? "Editar producto" : "Nuevo producto"}</h2>
                <button onClick={onClose} aria-label="Cerrar">
                  <X className="h-5 w-5 text-muted hover:text-text" />
                </button>
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <Field label="Nombre"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label="Descripción">
                  <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                </Field>
                <Field label="Categoría">
                  <select className="input" value={category} onChange={(e) => changeCategory(e.target.value)}>
                    <option value="">Selecciona…</option>
                    {config?.categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </Field>

                {/* Selector de plantilla (aparece tras elegir categoría) */}
                {category && (
                  <Field label="Plantilla">
                    {templates.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted">
                        No hay plantillas para esta categoría todavía.
                      </p>
                    ) : (
                      <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                        <option value="">Selecciona una plantilla…</option>
                        {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    )}
                  </Field>
                )}

                {/* Mensaje guía mientras no haya plantilla elegida */}
                {category && templates.length > 0 && !templateId && (
                  <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted">
                    Elige una plantilla para definir las características del producto.
                  </p>
                )}

                {/* Características de la plantilla */}
                {templateId && template && (
                  <>
                    <Field label="Precio base (C$)">
                      <input className="input" type="number" min={0} value={basePrice}
                        onChange={(e) => setBasePrice(e.target.value)} placeholder="Ej: 350" />
                      <p className="mt-1 text-xs text-muted">El descuento por cantidad se calcula solo en la ficha del producto.</p>
                    </Field>

                    <div className="space-y-3 rounded-xl border border-border p-3">
                      <p className="text-sm font-medium">Disponibilidad por opción</p>
                      {template.axes.map((axis) => (
                        <div key={axis.key}>
                          <p className="mb-1 text-xs font-medium text-muted">{axis.label}</p>
                          <div className="divide-y divide-border/50">
                            {axis.options.map((opt) => {
                              const on = availability[axis.key]?.[opt] !== false;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  role="switch"
                                  aria-checked={on}
                                  onClick={() => toggleOption(axis.key, opt)}
                                  className="flex w-full items-center justify-between py-2 text-left"
                                >
                                  <span className={cn("text-sm transition-colors", on ? "text-text" : "text-muted")}>
                                    {opt}
                                  </span>
                                  <span
                                    className={cn(
                                      "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                                      on ? "bg-gradient-accent" : "bg-border",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                                        on ? "left-[18px]" : "left-0.5",
                                      )}
                                    />
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <span className="mb-1.5 block text-sm font-medium">
                        {colorAxis ? "Fotos por color encendido (máx 10 c/u)" : "Fotos del producto (máx 10)"}
                      </span>
                      <ColorImageManager
                        colors={colorsForImages}
                        imagesByColor={imagesByColor}
                        onChange={setImagesByColor}
                        upload={uploadFiles}
                        uploading={uploading}
                      />
                    </div>

                    <Field label="Video de TikTok (URL)">
                      <input className="input" value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder="https://www.tiktok.com/@.../video/..." />
                    </Field>

                    <div className="space-y-3 rounded-xl border border-border p-3">
                      <ToggleRow label="Publicado (visible en el catálogo)" on={published} onToggle={() => setPublished((v) => !v)} />
                      <ToggleRow label="En promoción" on={isPromo} onToggle={togglePromo} />
                      {isPromo && (
                        <Field label="Precio antes de la oferta (C$)">
                          <input className="input" type="number" min={0} value={compareAtPrice}
                            onChange={(e) => setCompareAtPrice(e.target.value)} placeholder="Mayor al precio base" />
                          <p className="mt-1 text-xs text-muted">Se muestra tachado junto al precio base en la ficha.</p>
                        </Field>
                      )}
                    </div>
                  </>
                )}
              </div>

              <footer className="border-t border-border p-4 bg-surface/30 flex justify-end gap-2.5">
                <Button variant="outline" onClick={onClose} disabled={creating || updating}>
                  Cancelar
                </Button>
                <Button onClick={save} loading={creating || updating}>
                  {editId ? "Guardar cambios" : "Crear producto"}
                </Button>
              </footer>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

// Fila con interruptor deslizante (mismo estilo que la disponibilidad por opción).
function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex w-full items-center justify-between text-left"
    >
      <span className={cn("text-sm transition-colors", on ? "text-text" : "text-muted")}>{label}</span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-gradient-accent" : "bg-border")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}
