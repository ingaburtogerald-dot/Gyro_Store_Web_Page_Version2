// Pestaña "Combos" de la Gestión de Catálogo: lista los combos creados y permite
// crear/editar/activar/eliminar. Cada combo empareja 2 productos a un precio de
// paquete y aparece en la página de detalle de ambos (Fase 2).
import { useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { ComboEditorModal } from "./ComboEditorModal";
import { formatCordobas } from "~/lib/utils";
import {
  useGetAdminCombosQuery,
  useDeleteComboMutation,
  useToggleComboActiveMutation,
  type Combo,
} from "~/store/api/catalogApi";

export function ComboGrid() {
  const { data: combos = [], isLoading } = useGetAdminCombosQuery();
  const [del] = useDeleteComboMutation();
  const [toggle] = useToggleComboActiveMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Combo | null>(null);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(combo: Combo) {
    setEditing(combo);
    setModalOpen(true);
  }

  async function remove(combo: Combo) {
    if (!confirm(`¿Eliminar el combo "${combo.name}"?`)) return;
    try {
      await del(combo.id).unwrap();
      toast.success("Combo eliminado.");
    } catch {
      toast.error("No se pudo eliminar el combo.");
    }
  }

  async function setActive(combo: Combo, active: boolean) {
    try {
      await toggle({ id: combo.id, active }).unwrap();
    } catch {
      toast.error("No se pudo cambiar el estado del combo.");
    }
  }

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-card border border-border bg-surface shadow-premium" />;
  }

  return (
    <div className="pb-8">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">{combos.length} combos creados</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Crear combo
        </Button>
      </div>

      {combos.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-card border border-border bg-surface text-center shadow-premium">
          <p className="text-muted">No hay combos creados todavía.</p>
          <p className="text-xs text-muted">Empareja 2 productos a un precio especial y aparecerán en sus páginas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {combos.map((combo) => (
            <ComboCard
              key={combo.id}
              combo={combo}
              onEdit={() => openEdit(combo)}
              onDelete={() => remove(combo)}
              onToggle={(active) => setActive(combo, active)}
            />
          ))}
        </div>
      )}

      <ComboEditorModal open={modalOpen} onClose={() => setModalOpen(false)} combo={editing} />
    </div>
  );
}

function ComboCard({
  combo,
  onEdit,
  onDelete,
  onToggle,
}: {
  combo: Combo;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (active: boolean) => void;
}) {
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

      <div className="pr-16">
        <h3 className="line-clamp-2 text-base font-bold leading-tight">{combo.name}</h3>

        {combo.broken && (
          <p className="mt-1 flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="h-3.5 w-3.5" /> Un producto ya no existe
          </p>
        )}

        {/* Miniaturas de los 2 productos */}
        <div className="mt-3 flex items-center gap-2">
          {combo.products.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted">+</span>}
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
                {p.image && <img src={p.image} alt="" className="h-full w-full object-contain" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
        <div>
          <p className="text-[11px] text-muted">Precio del paquete</p>
          <p className="font-heading text-lg font-bold text-accent leading-none tabular-nums">
            {formatCordobas(combo.price)}
          </p>
          {combo.savings > 0 && (
            <p className="mt-0.5 text-[11px] text-muted">
              Ahorro <span className="tabular-nums">{formatCordobas(combo.savings)}</span>
            </p>
          )}
        </div>

        {/* Toggle activo */}
        <button
          type="button"
          onClick={() => onToggle(!combo.active)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${combo.active ? "bg-accent" : "bg-surface-2"}`}
          aria-pressed={combo.active}
          aria-label={combo.active ? "Desactivar combo" : "Activar combo"}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${combo.active ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </button>
      </div>
    </div>
  );
}
