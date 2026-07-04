// Tarjeta de contacto para el Kanban. Draggable (dnd-kit) y clickable para abrir la ficha.
import { useSortable } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { cn, formatCordobas } from "~/lib/utils";
import type { Contact } from "~/store/api/contactsApi";
import { dueState, DUE_META, fmtWhen } from "./crmMeta";

export function ContactCard({ contact, onOpen }: { contact: Contact; onOpen: (c: Contact) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: contact.id,
    data: { stage: contact.stage },
  });
  const due = DUE_META[dueState(contact)];

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
      }}
      className={cn(
        "group rounded-xl border border-border bg-surface p-3 shadow-sm",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab touch-none text-muted/50 hover:text-muted active:cursor-grabbing"
          aria-label="Arrastrar"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <button onClick={() => onOpen(contact)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold text-text">{contact.name}</span>
            {contact.value > 0 && (
              <span className="shrink-0 text-[11px] font-medium text-whatsapp">
                {formatCordobas(contact.value)}
              </span>
            )}
          </div>

          {contact.product && (
            <p className="mt-0.5 truncate text-xs text-muted" title={contact.product}>
              {contact.product}
            </p>
          )}

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", due.text)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", due.dot)} />
              {contact.nextActivityAt ? fmtWhen(contact.nextActivityAt) : due.label}
            </span>
            <span className="truncate text-[10px] text-muted/70">{contact.ownerName}</span>
          </div>
        </button>
      </div>
    </div>
  );
}
