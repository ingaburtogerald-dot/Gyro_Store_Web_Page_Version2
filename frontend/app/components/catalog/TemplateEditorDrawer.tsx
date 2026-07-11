import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import {
  useGetTemplateQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useGetConfigQuery,
  type TemplateAxis,
} from "~/store/api/catalogApi";
import { cn } from "~/lib/utils";

interface SpecRow {
  name: string;
  value: string;
}

export function TemplateEditorDrawer({
  open,
  onClose,
  editId,
}: {
  open: boolean;
  onClose: () => void;
  editId: string | null;
}) {
  const { data: detail } = useGetTemplateQuery(editId!, { skip: !editId });
  const { data: config } = useGetConfigQuery();
  const [createTemplate, { isLoading: creating }] = useCreateTemplateMutation();
  const [updateTemplate, { isLoading: updating }] = useUpdateTemplateMutation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [axes, setAxes] = useState<TemplateAxis[]>([]);
  const [specs, setSpecs] = useState<SpecRow[]>([]);

  const [step, setStep] = useState(1);
  const categories = config?.categories || [];

  // Sync when editing
  useEffect(() => {
    if (open) {
      if (editId && detail) {
        setName(detail.name);
        setDescription(detail.description || "");
        setCategory(detail.category);
        setAxes(detail.axes || []);
        setSpecs(detail.specs || []);
      } else if (!editId) {
        setName("");
        setDescription("");
        setCategory("");
        setAxes([]);
        setSpecs([]);
      }
      setStep(1);
    }
  }, [open, editId, detail]);

  const goNext = () => setStep((s) => Math.min(s + 1, 3));
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));

  async function save() {
    if (!name.trim()) return toast.error("El nombre es requerido.");
    if (!category.trim()) return toast.error("La categoría es requerida.");

    // Clean up axes options (remove empty ones)
    const cleanedAxes = axes.map(a => ({
      ...a,
      options: a.options.filter(o => o.trim() !== "")
    })).filter(a => a.key.trim() !== "" && a.label.trim() !== "");

    // Clean up specs
    const cleanedSpecs = specs.filter(s => s.name.trim() !== "" || s.value.trim() !== "");

    const payload = {
      name: name.trim(),
      category: category.trim(),
      description: description.trim() || undefined,
      axes: cleanedAxes,
      specs: cleanedSpecs,
    };

    try {
      if (editId) {
        await updateTemplate({ id: editId, body: payload }).unwrap();
        toast.success("Plantilla actualizada exitosamente.");
      } else {
        await createTemplate(payload).unwrap();
        toast.success("Plantilla creada exitosamente.");
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "Error al guardar la plantilla.");
    }
  }

  // Axes management
  const addAxis = () => {
    setAxes([...axes, { key: `eje_${Date.now()}`, label: "", options: [""], isColor: false }]);
  };
  const updateAxis = (index: number, changes: Partial<TemplateAxis>) => {
    const next = [...axes];
    next[index] = { ...next[index], ...changes };
    setAxes(next);
  };
  const removeAxis = (index: number) => {
    setAxes(axes.filter((_, i) => i !== index));
  };

  const addOptionToAxis = (axisIndex: number) => {
    const next = [...axes];
    next[axisIndex].options.push("");
    setAxes(next);
  };
  const updateOptionInAxis = (axisIndex: number, optionIndex: number, val: string) => {
    const next = [...axes];
    next[axisIndex].options[optionIndex] = val;
    setAxes(next);
  };
  const removeOptionFromAxis = (axisIndex: number, optionIndex: number) => {
    const next = [...axes];
    next[axisIndex].options.splice(optionIndex, 1);
    setAxes(next);
  };

  // Specs management
  const addSpec = () => setSpecs([...specs, { name: "", value: "" }]);
  const updateSpec = (index: number, field: keyof SpecRow, val: string) => {
    const next = [...specs];
    next[index][field] = val;
    setSpecs(next);
  };
  const removeSpec = (index: number) => setSpecs(specs.filter((_, i) => i !== index));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />
          <div className="fixed inset-y-0 right-0 z-[100] w-full max-w-2xl bg-surface shadow-2xl sm:w-[600px] flex flex-col pointer-events-none">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex h-full flex-col overflow-hidden bg-surface pointer-events-auto"
            >
              <header className="flex items-center justify-between border-b border-border p-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-bold">
                    {editId ? `Editar Plantilla` : "Nueva Plantilla"}
                  </h2>
                  <StepIndicator step={step} onStepClick={setStep} />
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {step === 1 && (
                  <div className="space-y-5">
                    <Field label="Categoría (Interna)">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
                      >
                        <option value="" disabled>Selecciona una categoría...</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} ({cat.id})
                          </option>
                        ))}
                        {category && !categories.find((c) => c.id === category) && (
                          <option value={category}>{category} (Obsoleta)</option>
                        )}
                      </select>
                      <p className="mt-1 text-[11px] text-muted">
                        Debe coincidir con la categoría asignada en inventario para que el mapeo automático funcione correctamente.
                      </p>
                    </Field>
                    
                    <Field label="Nombre de la Plantilla">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej. Plantilla Audífonos KZ"
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
                      />
                    </Field>

                    <Field label="Descripción (Opcional)">
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Nota interna sobre esta plantilla..."
                        rows={3}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
                      />
                    </Field>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-text">Ejes Dinámicos</h3>
                        <p className="text-xs text-muted">Ej: Color, Conector, Switch, Versión.</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={addAxis}>
                        <Plus className="h-4 w-4 mr-1" /> Eje
                      </Button>
                    </div>

                    {axes.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
                        No hay ejes configurados. Todos los productos serán estándar.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {axes.map((axis, i) => (
                          <div key={i} className="rounded-card border border-border bg-surface-2 p-4">
                            <div className="mb-3 flex items-start gap-2">
                              <div className="flex-1 space-y-3">
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1 block">Clave (id interno)</label>
                                    <input
                                      type="text"
                                      value={axis.key}
                                      onChange={(e) => updateAxis(i, { key: e.target.value })}
                                      placeholder="ej. conector"
                                      className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1 block">Etiqueta Pública</label>
                                    <input
                                      type="text"
                                      value={axis.label}
                                      onChange={(e) => updateAxis(i, { label: e.target.value })}
                                      placeholder="ej. Tipo de Conector"
                                      className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm"
                                    />
                                  </div>
                                </div>
                                <ToggleRow
                                  label="Es atributo visual de Color"
                                  on={!!axis.isColor}
                                  onToggle={() => updateAxis(i, { isColor: !axis.isColor })}
                                />
                              </div>
                              <button onClick={() => removeAxis(i)} className="mt-6 rounded p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            
                            <div className="rounded border border-border bg-surface p-3">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2 block">Opciones disponibles</label>
                              <div className="flex flex-wrap gap-2">
                                {axis.options.map((opt, optIndex) => (
                                  <div key={optIndex} className="flex items-center gap-1 rounded bg-surface-2 pr-1">
                                    <input
                                      type="text"
                                      value={opt}
                                      onChange={(e) => updateOptionInAxis(i, optIndex, e.target.value)}
                                      placeholder="Opción"
                                      className="w-24 bg-transparent px-2 py-1 text-xs outline-none"
                                    />
                                    <button onClick={() => removeOptionFromAxis(i, optIndex)} className="text-muted hover:text-danger p-0.5">
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                                <button onClick={() => addOptionToAxis(i)} className="flex items-center gap-1 rounded border border-dashed border-border px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent">
                                  <Plus className="h-3 w-3" /> Añadir
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-text">Especificaciones Técnicas Base</h3>
                        <p className="text-xs text-muted">Todos los productos creados con esta plantilla heredarán estas specs.</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={addSpec}>
                        <Plus className="h-4 w-4 mr-1" /> Spec
                      </Button>
                    </div>

                    {specs.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
                        No hay especificaciones por defecto.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {specs.map((spec, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={spec.name}
                              onChange={(e) => updateSpec(i, "name", e.target.value)}
                              placeholder="Ej. Frecuencia"
                              className="w-1/3 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
                            />
                            <input
                              type="text"
                              value={spec.value}
                              onChange={(e) => updateSpec(i, "value", e.target.value)}
                              placeholder="Ej. 20Hz - 40kHz"
                              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
                            />
                            <button onClick={() => removeSpec(i)} className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <footer className="flex items-center justify-between border-t border-border bg-surface p-4">
                <Button variant="ghost" onClick={onClose} disabled={creating || updating}>
                  Cancelar
                </Button>
                <div className="flex gap-2.5">
                  {step > 1 && (
                    <Button variant="outline" onClick={goPrev} disabled={creating || updating}>
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </Button>
                  )}
                  {step < 3 ? (
                    <Button onClick={goNext}>
                      Siguiente <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={save} loading={creating || updating}>
                      {editId ? "Guardar cambios" : "Crear plantilla"}
                    </Button>
                  )}
                </div>
              </footer>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

const WIZARD_STEPS = ["General", "Ejes", "Specs"];
function StepIndicator({ step, onStepClick }: { step: number; onStepClick: (n: number) => void }) {
  return (
    <div className="flex items-center mt-2">
      {WIZARD_STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        const isLast = i === WIZARD_STEPS.length - 1;
        return (
          <div key={label} className={cn("flex items-center", !isLast && "flex-1")}>
            <button
              type="button"
              onClick={() => onStepClick(n)}
              disabled={n >= step}
              className={cn("flex shrink-0 items-center gap-1.5", n < step && "cursor-pointer")}
            >
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold transition-colors",
                  active ? "bg-gradient-accent text-white"
                    : done ? "bg-accent/20 text-accent"
                      : "bg-surface-2 text-muted",
                )}
              >
                {done ? <Check className="h-2.5 w-2.5" /> : n}
              </span>
              <span className={cn("hidden text-[10px] font-medium transition-colors sm:inline", active ? "text-text" : "text-muted")}>
                {label}
              </span>
            </button>
            {!isLast && <span className={cn("mx-1 h-px flex-1 transition-colors", done ? "bg-accent/40" : "bg-border")} />}
          </div>
        );
      })}
    </div>
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

function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex w-full items-center justify-between text-left mt-2 rounded bg-surface-2 px-3 py-2"
    >
      <span className={cn("text-xs font-medium transition-colors", on ? "text-text" : "text-muted")}>{label}</span>
      <span className={cn("relative h-4 w-7 shrink-0 rounded-full transition-colors", on ? "bg-gradient-accent" : "bg-border")}>
        <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all", on ? "left-[14px]" : "left-0.5")} />
      </span>
    </button>
  );
}
