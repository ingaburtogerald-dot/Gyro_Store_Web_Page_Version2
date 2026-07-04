// Tablero Kanban del CRM (dnd-kit). Renderiza desde la data de RTK Query agrupada por
// etapa; el reordenamiento se persiste con fractional indexing (un PATCH por drop) y se
// refleja al instante vía el optimistic update de moveStage.
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "~/lib/utils";
import { useMoveStageMutation, type Contact, type CrmStage } from "~/store/api/contactsApi";
import { ContactCard } from "./ContactCard";
import { STAGE_ORDER, STAGE_META } from "./crmMeta";

export function KanbanBoard({
  contacts,
  owner,
  onOpen,
}: {
  contacts: Contact[];
  owner?: string;
  onOpen: (c: Contact) => void;
}) {
  const [moveStage] = useMoveStageMutation();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    // Pequeño umbral: un click no dispara drag (para poder abrir la ficha).
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const byStage = useMemo(() => {
    const map = Object.fromEntries(STAGE_ORDER.map((s) => [s, [] as Contact[]])) as Record<CrmStage, Contact[]>;
    for (const c of contacts) (map[c.stage] ??= []).push(c);
    for (const s of STAGE_ORDER) map[s].sort((a, b) => a.stageOrder - b.stageOrder);
    return map;
  }, [contacts]);

  const findStage = (id: string): CrmStage | null => {
    if ((STAGE_ORDER as string[]).includes(id)) return id as CrmStage;
    return contacts.find((c) => c.id === id)?.stage ?? null;
  };

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const dest = findStage(String(over.id));
    if (!dest) return;

    // Columna destino sin la tarjeta arrastrada, para calcular vecinos.
    const col = byStage[dest].filter((c) => c.id !== active.id);
    const overIsColumn = (STAGE_ORDER as string[]).includes(String(over.id));
    const index = overIsColumn ? col.length : col.findIndex((c) => c.id === over.id);
    const at = index === -1 ? col.length : index;

    const before = col[at - 1]?.stageOrder ?? (col[0]?.stageOrder ?? 1000) - 2000;
    const after = col[at]?.stageOrder ?? before + 2000;
    const stageOrder = (before + after) / 2;

    const current = contacts.find((c) => c.id === active.id);
    if (current && current.stage === dest && current.stageOrder === stageOrder) return;

    moveStage({ id: String(active.id), stage: dest, stageOrder, owner });
  }

  const activeContact = activeId ? contacts.find((c) => c.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {STAGE_ORDER.map((stage) => (
          <Column key={stage} stage={stage} contacts={byStage[stage]} onOpen={onOpen} />
        ))}
      </div>

      <DragOverlay>
        {activeContact ? (
          <div className="rotate-1">
            <ContactCard contact={activeContact} onOpen={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ stage, contacts, onOpen }: { stage: CrmStage; contacts: Contact[]; onOpen: (c: Contact) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const meta = STAGE_META[stage];

  return (
    <div className={cn("rounded-card border bg-surface-2/30 p-2 transition-colors", meta.ring, isOver && "bg-surface-2/70")}>
      <div className="mb-2 flex items-center justify-between px-1 py-1">
        <span className={cn("flex items-center gap-1.5 text-xs font-semibold", meta.accent)}>
          <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
          {meta.label}
        </span>
        <span className="rounded-pill bg-surface px-1.5 text-[11px] text-muted">{contacts.length}</span>
      </div>

      <SortableContext items={contacts.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="min-h-[80px] space-y-2">
          {contacts.map((c) => (
            <ContactCard key={c.id} contact={c} onOpen={onOpen} />
          ))}
          {contacts.length === 0 && (
            <p className="px-1 py-6 text-center text-[11px] text-muted/60">Arrastra aquí</p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
