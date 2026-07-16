// Galería de fotos por color (máx 10 c/u). Los colores se detectan solos de las
// variantes vinculadas (último segmento del nombre). Sube a Cloudflare R2 (vía API).
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
  const [active, setActive] = useState<string>("");
  const current = colors.includes(active) ? active : (colors[0] || "");
  const list = imagesByColor[current] ?? [];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const files = input.files;
    if (!files?.length || !current) return;
    
    if (list.length + files.length > MAX_PER_COLOR) {
      input.value = "";
      return toast.error(`Máximo ${MAX_PER_COLOR} fotos por color.`);
    }
    
    // Clonamos para la subida
    const urls = await upload(files);
    
    if (urls && urls.length > 0) {
      onChange({ ...imagesByColor, [current]: [...new Set([...list, ...urls])] });
    }
    // Reiniciar el input para poder volver a seleccionar los mismos archivos
    input.value = "";
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
      <p className="rounded-xl border border-dashed border-border/60 bg-surface/30 p-6 text-center text-xs text-muted">
        Vincula variantes con color para subir fotos por color.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pestañas de Color */}
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActive(c)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              current === c
                ? "bg-accent/10 text-accent ring-1 ring-accent/30"
                : "bg-surface/40 text-muted hover:bg-surface hover:text-text",
            )}
          >
            {c}
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[9px]",
                current === c ? "bg-accent/20 text-accent" : "bg-border text-muted",
              )}
            >
              {(imagesByColor[c] ?? []).length}
            </span>
          </button>
        ))}
      </div>

      {list.length > 1 && (
        <p className="text-[11px] font-medium text-muted">Arrastra para ordenar · la 1ª es la principal.</p>
      )}

      {/* Grid de Imágenes */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={list as UniqueIdentifier[]} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-3">
            {list.map((url, i) => (
              <SortablePhoto key={url} id={url} url={url} isPrimary={i === 0} onRemove={() => remove(i)} />
            ))}

            {/* Caja de subida integrada en la grilla */}
            {list.length < MAX_PER_COLOR && (
              <label
                className={cn(
                  "group flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed transition-all",
                  uploading
                    ? "border-accent/40 bg-accent/5 text-accent"
                    : "border-border/60 bg-surface/30 text-muted hover:border-accent/50 hover:bg-accent/5 hover:text-accent",
                )}
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Upload className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
                )}
                <span className="text-[10px] font-semibold">{uploading ? "Subiendo..." : "Añadir"}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// Miniatura arrastrable con diseño premium
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
        "group relative h-24 w-24 cursor-grab touch-none overflow-hidden rounded-xl border bg-surface/20 active:cursor-grabbing",
        isPrimary ? "border-accent ring-2 ring-accent/20" : "border-border/60",
      )}
    >
      <img src={url} alt="" className="pointer-events-none h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      
      {/* Badge Principal (flotante superior izquierdo) */}
      {isPrimary && (
        <span className="absolute left-1.5 top-1.5 rounded-md bg-accent/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur-md">
          Principal
        </span>
      )}

      {/* Botón Eliminar (flotante superior derecho, visible en hover) */}
      <button
        type="button"
        onClick={onRemove}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/40 text-white opacity-0 shadow-sm backdrop-blur-md transition-all hover:bg-destructive group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
