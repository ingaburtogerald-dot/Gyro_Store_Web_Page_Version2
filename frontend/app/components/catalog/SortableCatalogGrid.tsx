// Grid de catálogo en modo edición: drag & drop para reordenar (dnd-kit),
// botón de editar por card y botón para agregar producto.
import { useEffect, useState } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, rectSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, ImageOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { CatalogEditorDrawer } from "./CatalogEditorDrawer";
import {
  useGetAdminCatalogQuery, useReorderCatalogMutation, useDeleteCatalogItemMutation,
  type CatalogProduct,
} from "~/store/api/catalogApi";
import { formatCordobas } from "~/lib/utils";

export function SortableCatalogGrid() {
  const { data: serverItems = [] } = useGetAdminCatalogQuery();
  const [reorder] = useReorderCatalogMutation();
  const [del] = useDeleteCatalogItemMutation();

  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => setItems(serverItems), [serverItems]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    const next = arrayMove(items, oldIdx, newIdx);
    setItems(next);
    try {
      await reorder({ items: next.map((it, order) => ({ id: it.id, order })) }).unwrap();
    } catch {
      toast.error("No se pudo guardar el orden.");
    }
  }

  function openCreate() { setEditId(null); setDrawerOpen(true); }
  function openEdit(id: string) { setEditId(id); setDrawerOpen(true); }

  async function remove(id: string) {
    try {
      await del(id).unwrap();
      toast.success("Producto eliminado del catálogo.");
    } catch {
      toast.error("No se pudo eliminar.");
    }
  }

  return (
    <div className="pb-8">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">Arrastra para reordenar · {items.length} productos</p>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Agregar producto</Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <SortableCard key={item.id} item={item} onEdit={() => openEdit(item.id)} onDelete={() => remove(item.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <CatalogEditorDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} editId={editId} />
    </div>
  );
}

function SortableCard({ item, onEdit, onDelete }: { item: CatalogProduct; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const baseName = item.name;

  return (
    <div ref={setNodeRef} style={style} className="relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface">
      <div className="absolute left-2 top-2 z-10 flex gap-1">
        <button {...attributes} {...listeners} className="cursor-grab rounded-lg bg-black/50 p-1.5 text-white active:cursor-grabbing" aria-label="Reordenar">
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <button onClick={onEdit} className="rounded-lg bg-black/50 p-1.5 text-white hover:text-accent-2" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
        <button onClick={onDelete} className="rounded-lg bg-black/50 p-1.5 text-white hover:text-red-400" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
      </div>

      <div className="aspect-square bg-surface-2 shrink-0">
        {item.images?.[0] ? (
          <img src={item.images[0]} alt={baseName} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-muted"><ImageOff className="h-8 w-8" /></div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="mb-2">
          {item.isPromo && <span className="mb-1 block text-xs font-semibold text-accent-2">Promoción</span>}
          <p className="line-clamp-2 font-medium leading-snug">{baseName}</p>
        </div>
        <div className="mt-auto">
          <p className="font-heading font-bold">{formatCordobas(item.price)}</p>
          <p className="text-xs text-muted">stock {item.stock}</p>
        </div>
      </div>
    </div>
  );
}
