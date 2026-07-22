// Editor de catálogo — estilo Shopify/Linear premium.
//   · Nuevo producto (!editId): wizard de 4 pasos (Info básica → Opciones →
//     Multimedia → Variantes) con barra de progreso animada y transición
//     deslizante entre pasos.
//   · Editar (editId): las mismas 4 secciones, pero como acordeón (sin scroll
//     infinito, acceso directo a cualquier bloque).
// La disponibilidad ya NO se togglea a mano: se deriva del stock del SKU mapeado.
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Info, Image as ImageIcon, Layers, SlidersHorizontal, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { ComboBox, type ComboBoxOption } from "~/components/ui/ComboBox";
import { FloatingInput, FloatingTextarea } from "~/components/ui/FloatingField";
import { WizardProgress, type WizardStepMeta } from "./WizardProgress";
import { GlassSection } from "./GlassSection";
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

const EASE = [0.16, 1, 0.3, 1] as const;

const STEPS: WizardStepMeta[] = [
  { key: "info", label: "Info básica", icon: Info },
  { key: "opciones", label: "Opciones", icon: SlidersHorizontal },
  { key: "media", label: "Multimedia", icon: ImageIcon },
  { key: "variantes", label: "Variantes", icon: Layers },
];

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
  const [submitted, setSubmitted] = useState(false); // resalta campos inválidos tras intentar guardar/avanzar

  // Wizard (solo al crear): paso actual + dirección para la transición deslizante.
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

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

  // Opciones del combobox de Categoría/Plantilla (ícono grande en el disparador).
  const categoryOptions = useMemo<ComboBoxOption[]>(
    () => (config?.categories ?? []).map((c) => ({ value: c.id, label: c.name, icon: c.icon })),
    [config],
  );
  const templateOptions = useMemo<ComboBoxOption[]>(
    () => templates.filter((t) => !category || t.category === category).map((t) => ({ value: t.id, label: t.name })),
    [templates, category],
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
    setStep(0);
    setDirection(1);
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

  const nameInvalid = submitted && !name.trim();
  const categoryInvalid = submitted && !category;
  const templateInvalid = submitted && !templateId;

  // Paso 1 (Info básica) es el único con requisitos duros antes de avanzar —
  // el resto del wizard depende de que exista plantilla.
  function step1Valid(): boolean {
    return Boolean(name.trim() && category && templateId);
  }

  function goNext() {
    if (step === 0 && !step1Valid()) {
      setSubmitted(true);
      toast.error("Completa nombre, categoría y plantilla para continuar.");
      return;
    }
    setDirection(1);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }

  const completedSteps = useMemo(() => new Set(Array.from({ length: step }, (_, i) => i)), [step]);

  async function save() {
    setSubmitted(true);
    if (!name.trim() || !category || !templateId) return toast.error("Nombre, categoría y plantilla son obligatorios.");
    // Eliminada la validación estricta de basePrice ya que ahora los precios van en las variantes.
    // Auto-calcular basePrice buscando el menor precio entre las variantes mapeadas
    let calculatedBasePrice = 0;
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

  // ── Contenido de cada paso/sección (compartido entre wizard y acordeón) ──
  function renderInfoFields() {
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoría">
            <ComboBox
              options={categoryOptions}
              value={category}
              onChange={setCategory}
              placeholder="Selecciona una categoría…"
              searchPlaceholder="Buscar categoría…"
              invalid={categoryInvalid}
            />
          </Field>
          <Field label="Plantilla">
            <ComboBox
              options={templateOptions}
              value={templateId}
              onChange={changeTemplate}
              placeholder="Selecciona una plantilla…"
              searchPlaceholder="Buscar plantilla…"
              emptyText="No hay plantillas para esta categoría."
              invalid={templateInvalid}
            />
          </Field>
        </div>
        <FloatingInput label="Nombre" value={name} onChange={(e) => setName(e.target.value)} invalid={nameInvalid} />
        <FloatingTextarea label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <ToggleRow label="Producto en promoción" on={isPromo} onToggle={togglePromo} />
          <AnimatePresence initial={false}>
            {isPromo && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                style={{ overflow: "hidden" }}
              >
                <div className="pt-3.5">
                  <FloatingInput
                    label="Precio de comparación"
                    type="number"
                    min="0"
                    value={compareAtPrice}
                    onChange={(e) => setCompareAtPrice(e.target.value)}
                  />
                  <p className="mt-1.5 text-xs text-muted">Se mostrará tachado sobre el precio de venta.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </>
    );
  }

  function renderOptionsFields() {
    if (!template) {
      return (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted">
          Selecciona una plantilla para ver sus opciones.
        </p>
      );
    }
    return (
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
    );
  }

  const mediaSubtitle = colorAxis ? "Fotos por color (máx 10 c/u) + video." : "Fotos del producto (máx 10) + video.";

  function renderMediaFields() {
    return (
      <>
        <ColorImageManager
          colors={colorsForImages}
          imagesByColor={imagesByColor}
          onChange={setImagesByColor}
          upload={uploadFiles}
          uploading={uploading}
        />
        <div>
          <FloatingInput label="Video de TikTok (URL)" value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} />
          <p className="mt-1.5 text-xs text-muted/60">Ej. https://www.tiktok.com/@.../video/...</p>
        </div>
      </>
    );
  }

  function renderVariantFields() {
    return template ? (
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
        Elige una plantilla en el primer paso para generar las variantes.
      </p>
    );
  }

  const slideVariants = {
    enter: (dir: number) => ({ x: dir >= 0 ? 36 : -36, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir >= 0 ? -36 : 36, opacity: 0 }),
  };

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
        editId ? (
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-xs text-muted/60">Los cambios afectarán a todas las versiones del producto.</p>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={save} loading={creating || updating}>
                <Check className="mr-2 h-4 w-4" /> Guardar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between gap-3">
            <Button variant="outline" onClick={step === 0 ? onClose : goBack}>
              {step === 0 ? "Cancelar" : "Atrás"}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={goNext}>Siguiente</Button>
            ) : (
              <Button onClick={save} loading={creating || updating}>
                <Check className="mr-2 h-4 w-4" /> Crear producto
              </Button>
            )}
          </div>
        )
      }
    >
      {editId ? (
        <div className="space-y-4">
          <GlassSection icon={Info} title="Información general" subtitle="Nombre, categoría y plantilla base." collapsible defaultOpen>
            {renderInfoFields()}
          </GlassSection>
          <GlassSection icon={SlidersHorizontal} title="Opciones del producto" subtitle="Enciende solo lo que este producto ofrece. Lo apagado no existe para el cliente." collapsible>
            {renderOptionsFields()}
          </GlassSection>
          <GlassSection icon={ImageIcon} title="Multimedia" subtitle={mediaSubtitle} collapsible>
            {renderMediaFields()}
          </GlassSection>
          <GlassSection icon={Layers} title="Variantes y SKU" subtitle="Asigna un SKU a cada variante. El stock y la disponibilidad se leen del inventario en vivo." collapsible>
            {renderVariantFields()}
          </GlassSection>
        </div>
      ) : (
        <div>
          <WizardProgress steps={STEPS} current={step} completed={completedSteps} />
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: EASE }}
            >
              {step === 0 && (
                <GlassSection icon={Info} title="Info básica" subtitle="Nombre, categoría y plantilla base.">
                  {renderInfoFields()}
                </GlassSection>
              )}
              {step === 1 && (
                <GlassSection icon={SlidersHorizontal} title="Opciones" subtitle="Enciende solo lo que este producto ofrece. Lo apagado no existe para el cliente.">
                  {renderOptionsFields()}
                </GlassSection>
              )}
              {step === 2 && (
                <GlassSection icon={ImageIcon} title="Multimedia" subtitle={mediaSubtitle}>
                  {renderMediaFields()}
                </GlassSection>
              )}
              {step === 3 && (
                <GlassSection icon={Layers} title="Variantes y SKU" subtitle="Asigna un SKU a cada variante. El stock y la disponibilidad se leen del inventario en vivo.">
                  {renderVariantFields()}
                </GlassSection>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </FormDrawerLayout>
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
