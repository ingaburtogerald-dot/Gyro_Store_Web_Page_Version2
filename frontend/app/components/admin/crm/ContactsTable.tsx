// Lista de seguimientos en TABLA agrupada por urgencia (Vencidos · Para hoy · Próximos ·
// Sin tarea · Cerrados). Filas anchas con toda la info alineada + edición por fila:
// reprogramar el recordatorio en línea, editar datos, cerrar/reabrir, WhatsApp y borrar.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Pencil, Trash2, CheckCircle2, RotateCcw, ChevronDown, ChevronRight, X } from "lucide-react";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { DatePicker } from "~/components/ui/DatePicker";
import { RowActionsMenu } from "~/components/ui/RowActionsMenu";
import { cn } from "~/lib/utils";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin } from "~/store/slices/authSlice";
import { useUpdateBoardMutation, useDeleteContactMutation, type Contact } from "~/store/api/contactsApi";
import { ContactModal } from "./ContactModal";
import { dueState, DUE_META, sourceMeta, tagMeta, waLink, ymdFromIso, isoFromYmd, type Urgency } from "./crmMeta";

const SECTIONS: { key: Urgency; label: string }[] = [
  { key: "overdue", label: "Vencidos" },
  { key: "today", label: "Para hoy" },
  { key: "upcoming", label: "Próximos" },
  { key: "none", label: "Sin tarea" },
  { key: "closed", label: "Cerrados" },
];

export function ContactsTable({
  contacts,
  owner,
  onOpen,
}: {
  contacts: Contact[];
  owner?: string;
  onOpen: (c: Contact) => void;
}) {
  const isAdmin = useAppSelector(selectIsAdmin);
  const [updateBoard] = useUpdateBoardMutation();
  const [del, { isLoading: deleting }] = useDeleteContactMutation();
  const [editFor, setEditFor] = useState<Contact | null>(null);
  const [deleteFor, setDeleteFor] = useState<Contact | null>(null);
  const [collapsed, setCollapsed] = useState<Set<Urgency>>(new Set(["closed"]));

  const groups = useMemo(() => {
    const map = Object.fromEntries(SECTIONS.map((s) => [s.key, [] as Contact[]])) as Record<Urgency, Contact[]>;
    for (const c of contacts) map[dueState(c)].push(c);
    return map;
  }, [contacts]);

  const colSpan = isAdmin ? 6 : 5;
  const visibleSections = SECTIONS.filter((s) => groups[s.key].length > 0);

  function toggle(key: Urgency) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function toggleStatus(c: Contact) {
    const status = c.status === "closed" ? "active" : "closed";
    try {
      await updateBoard({ id: c.id, patch: { status }, owner }).unwrap();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo cambiar el estado.");
    }
  }

  async function handleDelete() {
    if (!deleteFor) return;
    try {
      await del(deleteFor.id).unwrap();
      toast.success("Contacto eliminado.");
      setDeleteFor(null);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo eliminar.");
    }
  }

  if (visibleSections.length === 0) {
    return <p className="rounded-card border border-border bg-surface py-16 text-center text-sm text-muted">No hay contactos con este filtro.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="table-header-brand text-left text-[11px] font-bold uppercase tracking-wider text-muted border-b border-border">
            <th className="px-3 py-2 font-medium">Cliente</th>
            <th className="px-3 py-2 font-medium">Origen</th>
            <th className="px-3 py-2 font-medium">Etiquetas</th>
            <th className="px-3 py-2 font-medium">Próximo recordatorio</th>
            {isAdmin && <th className="px-3 py-2 font-medium">Vendedor</th>}
            <th className="px-3 py-2" aria-label="Acciones" />
          </tr>
        </thead>

        {visibleSections.map((sec) => {
          const meta = DUE_META[sec.key];
          const isCollapsed = collapsed.has(sec.key);
          return (
            <tbody key={sec.key}>
              <tr className="border-b border-border bg-surface-2/40">
                <td colSpan={colSpan} className="px-3 py-1.5">
                  <button onClick={() => toggle(sec.key)} className="flex items-center gap-2 text-xs font-semibold">
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted" /> : <ChevronDown className="h-3.5 w-3.5 text-muted" />}
                    <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                    <span className={meta.text}>{sec.label}</span>
                    <span className="rounded-pill bg-surface px-1.5 text-[11px] text-muted">{groups[sec.key].length}</span>
                  </button>
                </td>
              </tr>

              {!isCollapsed &&
                groups[sec.key].map((c) => {
                  const src = sourceMeta(c.source);
                  return (
                    <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/30">
                      <td className="px-3 py-2">
                        <button onClick={() => onOpen(c)} className="text-left">
                          <div className="font-semibold text-text hover:text-accent">{c.name}</div>
                          <div className="text-[11px] text-muted">
                            {c.phone || "sin teléfono"}
                            {c.product ? ` · ${c.product}` : ""}
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn("rounded-pill px-2 py-0.5 text-[11px] font-medium", src.cls)} title={src.label}>
                          {src.emoji} {src.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {c.tags.length === 0 && <span className="text-xs text-muted">—</span>}
                          {c.tags.map((t) => {
                            const m = tagMeta(t);
                            return <span key={t} className={cn("rounded-pill px-1.5 py-0.5 text-[10px] font-medium", m.cls)}>{m.label}</span>;
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <ReminderCell contact={c} owner={owner} />
                      </td>
                      {isAdmin && <td className="px-3 py-2 text-xs text-muted">{c.ownerName}</td>}
                      <td className="px-3 py-2">
                        <div className="flex justify-end">
                          <RowActionsMenu
                            actions={[
                              c.phone && {
                                label: "Escribir por WhatsApp",
                                icon: <MessageCircle className="h-4 w-4" />,
                                href: waLink(c.phone, `Hola ${c.name}, le escribo de Gyro Store 👋`),
                              },
                              { label: "Editar datos", icon: <Pencil className="h-4 w-4" />, onClick: () => setEditFor(c) },
                              {
                                label: c.status === "closed" ? "Reabrir seguimiento" : "Cerrar seguimiento",
                                icon: c.status === "closed" ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />,
                                onClick: () => toggleStatus(c),
                              },
                              { label: "Eliminar", icon: <Trash2 className="h-4 w-4" />, danger: true, separatorBefore: true, onClick: () => setDeleteFor(c) },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          );
        })}
      </table>

      {editFor && <ContactModal open onClose={() => setEditFor(null)} item={editFor} />}
      {deleteFor && (
        <Modal open onClose={() => setDeleteFor(null)} title="Eliminar contacto">
          <p className="text-sm text-muted">
            ¿Eliminar a <strong className="text-text">{deleteFor.name}</strong> y todo su historial? No se puede deshacer.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteFor(null)}>Cancelar</Button>
            <Button size="sm" variant="destructive" onClick={handleDelete} loading={deleting}>Eliminar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Celda del próximo recordatorio: calendario temático (solo fecha). Elegir un día lo
// reprograma; la "×" lo deja sin tarea. La urgencia se aprecia por la sección.
function ReminderCell({ contact, owner }: { contact: Contact; owner?: string }) {
  const [updateBoard] = useUpdateBoardMutation();
  if (contact.status === "closed") return <span className="text-xs text-muted">—</span>;

  function commit(iso: string | null) {
    if (iso !== contact.nextActivityAt) {
      updateBoard({ id: contact.id, patch: { nextActivityAt: iso, status: "active" }, owner });
    }
  }

  return (
    <div className="flex items-center gap-1">
      <div className="w-[160px]">
        <DatePicker
          value={ymdFromIso(contact.nextActivityAt)}
          onChange={(ymd) => commit(isoFromYmd(ymd))}
          placeholder="Sin tarea"
        />
      </div>
      {contact.nextActivityAt && (
        <button onClick={() => commit(null)} title="Quitar recordatorio" className="rounded p-1 text-muted hover:text-red-400">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
