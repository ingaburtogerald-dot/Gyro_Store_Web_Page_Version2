// Ficha del contacto: datos + cambio rápido de etapa + historial de actividades.
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { cn, formatCordobas } from "~/lib/utils";
import {
  useMoveStageMutation,
  useDeleteContactMutation,
  type Contact,
  type CrmStage,
} from "~/store/api/contactsApi";
import { ContactModal } from "./ContactModal";
import { ActivityTimeline } from "./ActivityTimeline";
import { STAGE_ORDER, STAGE_META, waLink } from "./crmMeta";

export function ContactDrawer({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const [moveStage] = useMoveStageMutation();
  const [del, { isLoading: deleting }] = useDeleteContactMutation();
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  async function changeStage(stage: CrmStage) {
    if (stage === contact.stage) return;
    try {
      await moveStage({ id: contact.id, stage, stageOrder: contact.stageOrder }).unwrap();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo cambiar la etapa.");
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
          <button onClick={() => setConfirmDel(true)} title="Eliminar" className="rounded-lg p-1.5 text-muted hover:bg-red-500/10 hover:text-red-400">
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
          {contact.value > 0 && <span className="text-whatsapp">💰 {formatCordobas(contact.value)}</span>}
          <span>👤 {contact.ownerName}</span>
        </div>

        {contact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {contact.tags.map((t) => (
              <span key={t} className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] text-muted">#{t}</span>
            ))}
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Etapa del embudo</p>
          <div className="flex flex-wrap gap-1.5">
            {STAGE_ORDER.map((s) => {
              const m = STAGE_META[s];
              const active = contact.stage === s;
              return (
                <button
                  key={s}
                  onClick={() => changeStage(s)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-medium transition-colors",
                    active ? cn(m.ring, m.accent, "bg-surface-2") : "border-border text-muted hover:text-text",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
                  {m.label}
                </button>
              );
            })}
          </div>
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
