// Ficha del contacto: datos + estado (activo/cerrado) + historial de actividades.
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Pencil, Trash2, CheckCircle2, RotateCcw } from "lucide-react";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { cn } from "~/lib/utils";
import { useUpdateBoardMutation, useDeleteContactMutation, type Contact } from "~/store/api/contactsApi";
import { ContactModal } from "./ContactModal";
import { ActivityTimeline } from "./ActivityTimeline";
import { waLink, sourceMeta, tagMeta } from "./crmMeta";

export function ContactDrawer({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const [updateBoard, { isLoading: saving }] = useUpdateBoardMutation();
  const [del, { isLoading: deleting }] = useDeleteContactMutation();
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const src = sourceMeta(contact.source);

  async function toggleStatus() {
    const status = contact.status === "closed" ? "active" : "closed";
    try {
      await updateBoard({ id: contact.id, patch: { status } }).unwrap();
      toast.success(status === "closed" ? "Contacto cerrado." : "Contacto reabierto.");
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo cambiar el estado.");
    }
  }

  async function handleDelete() {
    try {
      await del(contact.id).unwrap();
      toast.success("Contacto eliminado.");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo eliminar.");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={contact.name}
      maxWidth="max-w-2xl"
      headerRight={
        <div className="flex items-center gap-1">
          {contact.phone && (
            <a
              href={waLink(contact.phone, `Hola ${contact.name}, le escribo de Gyro Store 👋`)}
              target="_blank"
              rel="noreferrer"
              title="WhatsApp"
              className="rounded-lg p-1.5 text-muted hover:bg-whatsapp/10 hover:text-whatsapp"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
          <button onClick={() => setEditing(true)} title="Editar" className="rounded-lg p-1.5 text-muted hover:text-accent">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setConfirmDel(true)} title="Eliminar" className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {contact.phone && <span>📱 {contact.phone}</span>}
          {contact.email && <span>✉️ {contact.email}</span>}
          {contact.product && <span>🛍️ {contact.product}</span>}
          <span>👤 {contact.ownerName}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded-pill px-2 py-0.5 text-[11px] font-medium", src.cls)}>
            {src.emoji} {src.label}
          </span>
          {contact.tags.map((t) => {
            const m = tagMeta(t);
            return (
              <span key={t} className={cn("rounded-pill px-2 py-0.5 text-[11px] font-medium", m.cls)}>
                {m.label}
              </span>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded-card border border-border bg-surface-2/40 px-3 py-2">
          <span className="text-sm">
            Estado:{" "}
            <strong className={contact.status === "closed" ? "text-accent-2" : "text-warning"}>
              {contact.status === "closed" ? "Cerrado" : "Activo"}
            </strong>
          </span>
          <Button size="sm" variant="outline" onClick={toggleStatus} loading={saving}>
            {contact.status === "closed" ? (
              <><RotateCcw className="h-4 w-4" /> Reabrir</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> Cerrar seguimiento</>
            )}
          </Button>
        </div>

        <div className="border-t border-border pt-4">
          <p className="mb-3 text-sm font-bold">Historial de interacciones</p>
          <ActivityTimeline contactId={contact.id} />
        </div>
      </div>

      {editing && <ContactModal open={editing} onClose={() => setEditing(false)} item={contact} />}

      {confirmDel && (
        <Modal open onClose={() => setConfirmDel(false)} title="Eliminar contacto">
          <p className="text-sm text-muted">
            ¿Eliminar a <strong className="text-text">{contact.name}</strong> y todo su historial? No se puede deshacer.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDel(false)}>Cancelar</Button>
            <Button size="sm" variant="destructive" onClick={handleDelete} loading={deleting}>Eliminar</Button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
