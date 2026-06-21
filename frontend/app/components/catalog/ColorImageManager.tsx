// Galería de fotos por color (máx 10 c/u). Los colores se detectan solos de las
// variantes vinculadas (último segmento del nombre). Sube a Firebase Storage.
// Las miniaturas se reordenan con drag & drop (dnd-kit); la 1ª es la principal.
import { useState } from "react";
import { Upload, Loader2, X, ImageOff } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "~/lib/utils";

const MAX_PER_COLOR = 10;

export function ColorImageManager({
  colors,
  imagesByColor,
  onChange,
  upload,
  uploading,
}: {
  colors: string[];
  imagesByColor: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
  upload: (files: FileList) => Promise<string[]>;
  uploading: boolean;
}) {
  const [active, setActive] = useState<string>(colors[0] ?? "");
  const current = active || colors[0] || "";
  const list = imagesByColor[current] ?? [];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length || !current) return;
    if (list.length + files.length > MAX_PER_COLOR) {
      return toast.error(`Máximo ${MAX_PER_COLOR} fotos por color.`);
    }
    const urls = await upload(files);
    onChange({ ...imagesByColor, [current]: [...list, ...urls] });
  }

  function remove(i: number) {
    onChange({ ...imagesByColor, [current]: list.filter((_, idx) => idx !== i) });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const oldIdx = list.indexOf(a.id as string);
    const newIdx = list.indexOf(over.id as string);
    if (oldIdx < 0 || newIdx < 0) return;
    onChange({ ...imagesByColor, [current]: arrayMove(list, oldIdx, newIdx) });
  }

  if (colors.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted">
        Vincula variantes con color para subir fotos por color.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActive(c)}
            className={cn(
              "rounded-pill border px-2.5 py-1 text-xs",
              current === c ? "border-transparent bg-gradient-accent text-white" : "border-border text-muted hover:text-text",
            )}
          >
            {c}
            <span className="ml-1 opacity-70">{(imagesByColor[c] ?? []).length}</span>
          </button>
        ))}
      </div>

      {list.length > 1 && (
        <p className="text-[11px] text-muted">Arrastra para ordenar · la 1ª es la principal.</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={list as UniqueIdentifier[]} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-2">
            {list.map((url, i) => (
              <SortablePhoto key={url} id={url} url={url} isPrimary={i === 0} onRemove={() => remove(i)} />
            ))}
            {list.length === 0 && (
              <div className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-border text-muted">
                <ImageOff className="h-5 w-5" />
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-pill border border-border px-3 py-2 text-sm text-muted hover:text-text">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Subir a “{current}”
        <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </label>
    </div>
  );
}

// Miniatura arrastrable. Todo el recuadro es el "asa"; el botón X detiene el
// pointer para que quitar una foto no inicie un arrastre.
function SortablePhoto({
  id,
  url,
  isPrimary,
  onRemove,
}: {
  id: string;
  url: string;
  isPrimary: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "relative h-16 w-16 cursor-grab touch-none overflow-hidden rounded-lg border active:cursor-grabbing",
        isPrimary ? "border-accent ring-1 ring-accent" : "border-border",
      )}
    >
      <img src={url} alt="" className="pointer-events-none h-full w-full object-cover" />
      {isPrimary && (
        <span className="absolute bottom-0 left-0 right-0 bg-black/65 py-0.5 text-center text-[9px] font-semibold text-white">
          Principal
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 bg-black/60 p-0.5 text-white"
        aria-label="Quitar foto"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
