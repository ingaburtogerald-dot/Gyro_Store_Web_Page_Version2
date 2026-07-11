import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { TemplateEditorDrawer } from "./TemplateEditorDrawer";
import { useGetTemplatesQuery, useDeleteTemplateMutation, type Template } from "~/store/api/catalogApi";

export function TemplateGrid() {
  const { data: templates = [], isLoading } = useGetTemplatesQuery();
  const [del] = useDeleteTemplateMutation();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  function openCreate() {
    setEditId(null);
    setDrawerOpen(true);
  }

  function openEdit(id: string) {
    setEditId(id);
    setDrawerOpen(true);
  }

  async function remove(id: string) {
    if (!confirm("¿Estás seguro de que quieres eliminar esta plantilla?")) return;
    try {
      await del(id).unwrap();
      toast.success("Plantilla eliminada.");
    } catch {
      toast.error("No se pudo eliminar la plantilla.");
    }
  }

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-card border border-border bg-surface shadow-premium" />;
  }

  return (
    <div className="pb-8">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">{templates.length} plantillas configuradas</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Agregar plantilla
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-card border border-border bg-surface shadow-premium">
          <p className="text-muted">No hay plantillas creadas todavía.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} onEdit={() => openEdit(template.id)} onDelete={() => remove(template.id)} />
          ))}
        </div>
      )}

      <TemplateEditorDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} editId={editId} />
    </div>
  );
}

function TemplateCard({ template, onEdit, onDelete }: { template: Template; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="relative flex flex-col justify-between rounded-card border border-border bg-surface p-4 shadow-premium transition-all hover:border-accent/40">
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <button onClick={onEdit} className="rounded-lg bg-surface-2 p-1.5 text-text hover:text-accent-2" aria-label="Editar">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={onDelete} className="rounded-lg bg-surface-2 p-1.5 text-text hover:text-danger" aria-label="Eliminar">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4 pr-16">
        <span className="mb-2 inline-block rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
          {template.category}
        </span>
        <h3 className="line-clamp-2 text-base font-bold leading-tight">{template.name}</h3>
      </div>

      <div className="space-y-3">
        {template.description && (
          <p className="line-clamp-2 text-xs text-muted">{template.description}</p>
        )}
        
        <div>
          <p className="mb-1 text-xs font-semibold text-text">Ejes configurados:</p>
          <div className="flex flex-wrap gap-1">
            {template.axes.length > 0 ? (
              template.axes.map(axis => (
                <span key={axis.key} className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                  {axis.label} {axis.isColor && "(Color)"}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted italic">Sin ejes dinámicos</span>
            )}
          </div>
        </div>

        {template.specs.length > 0 && (
          <p className="text-xs text-muted">{template.specs.length} specs por defecto</p>
        )}
      </div>
    </div>
  );
}
