// Tabla de usuarios con avatar, badges de roles y acciones (editar / eliminar).
// El usuario protegido (global_admin principal) no muestra acciones.
import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2, Shield, Key, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "~/components/ui/DataTable";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { RowActionsMenu } from "~/components/ui/RowActionsMenu";
import { useGetUsersQuery, useDeleteUserMutation, useGenerateTempPasswordMutation, type ManagedUser } from "~/store/api/usersApi";
import { ROLE_LABELS, ROLE_BADGE, type Role } from "~/lib/constants";

export function UsersTable({ onEdit }: { onEdit: (u: ManagedUser) => void }) {
  const { data: users = [], isLoading } = useGetUsersQuery();
  const [del, { isLoading: deleting }] = useDeleteUserMutation();
  const [generateTemp, { isLoading: generatingTemp }] = useGenerateTempPasswordMutation();
  const [deleteFor, setDeleteFor] = useState<ManagedUser | null>(null);

  // Estados para contraseña temporal
  const [confirmTempFor, setConfirmTempFor] = useState<ManagedUser | null>(null);
  const [newTempPassword, setNewTempPassword] = useState<string | null>(null);
  const [tempPasswordUserEmail, setTempPasswordUserEmail] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleDelete() {
    if (!deleteFor) return;
    try {
      await del(deleteFor.id).unwrap();
      toast.success("Usuario enviado a la papelera.");
      setDeleteFor(null);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo eliminar.");
    }
  }

  async function handleGenerateTemp() {
    if (!confirmTempFor) return;
    try {
      const res = await generateTemp(confirmTempFor.id).unwrap();
      setNewTempPassword(res.tempPassword);
      setTempPasswordUserEmail(res.email);
      setConfirmTempFor(null);
      toast.success("Nueva contraseña temporal generada.");
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo generar la contraseña.");
    }
  }

  function copyPassword() {
    if (!newTempPassword) return;
    navigator.clipboard.writeText(newTempPassword);
    setCopied(true);
    toast.success("Contraseña copiada al portapapeles.");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCloseTempModal() {
    setNewTempPassword(null);
    setTempPasswordUserEmail("");
    setCopied(false);
  }

  const columns = useMemo<ColumnDef<ManagedUser, any>[]>(
    () => [
      {
        id: "user",
        header: "Usuario",
        accessorFn: (u) => `${u.displayName} ${u.email}`,
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex items-center gap-3">
              {u.photoURL ? (
                <img src={u.photoURL} alt="" className="h-8 w-8 rounded-full" />
              ) : (
                <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-accent text-xs font-semibold text-white">
                  {u.displayName?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              <div>
                <p className="flex items-center gap-1 font-medium">
                  {u.displayName}
                  {u.isProtected && <Shield className="h-3.5 w-3.5 text-accent-2" />}
                </p>
                <p className="text-xs text-muted">{u.email}</p>
              </div>
            </div>
          );
        },
      },
      {
        id: "roles",
        header: "Roles",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.roles.map((r) => (
              <span key={r} className={`rounded-pill px-2 py-0.5 text-xs ${ROLE_BADGE[r as Role] || "bg-surface-2 text-muted"}`}>
                {ROLE_LABELS[r as Role] || r}
              </span>
            ))}
          </div>
        ),
      },
      {
        accessorKey: "provider",
        header: "Proveedor",
        cell: (c) => {
          const val = c.getValue() as string;
          if (val === "google") {
            return (
              <span className="rounded-pill px-2 py-0.5 text-xs bg-rose-500/15 text-rose-400 border border-rose-500/20 font-medium">
                Google
              </span>
            );
          }
          if (val === "microsoft") {
            return (
              <span className="rounded-pill px-2 py-0.5 text-xs bg-sky-500/15 text-sky-400 border border-sky-500/20 font-medium">
                Microsoft
              </span>
            );
          }
          return (
            <span className="rounded-pill px-2 py-0.5 text-xs bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-medium">
              Local
            </span>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Creado",
        cell: (c) => (c.getValue() ? new Date(c.getValue()).toLocaleDateString("es-NI") : "—"),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const u = row.original;
          if (u.isProtected) return <span className="text-xs text-muted">Protegido</span>;
          return (
            <div className="flex justify-end">
              <RowActionsMenu
                actions={[
                  u.provider === "local" && {
                    label: "Generar contraseña temporal",
                    icon: <Key className="h-4 w-4" />,
                    onClick: () => setConfirmTempFor(u),
                  },
                  { label: "Editar", icon: <Pencil className="h-4 w-4" />, onClick: () => onEdit(u) },
                  { label: "Eliminar", icon: <Trash2 className="h-4 w-4" />, danger: true, separatorBefore: true, onClick: () => setDeleteFor(u) },
                ]}
              />
            </div>
          );
        },
      },
    ],
    [onEdit],
  );

  if (isLoading) return <div className="h-64 animate-pulse rounded-card border border-border bg-surface" />;

  return (
    <>
      <DataTable columns={columns} data={users} searchPlaceholder="Buscar usuario…" emptyText="Sin usuarios." />
      
      <Modal open={!!deleteFor} onClose={() => setDeleteFor(null)} title="Eliminar usuario">
        <p className="text-sm text-muted">
          ¿Enviar a <strong className="text-text">{deleteFor?.displayName}</strong> a la papelera? Podrás
          restaurarlo dentro de 30 días.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteFor(null)}>Cancelar</Button>
          <Button onClick={handleDelete} loading={deleting} className="bg-red-500/90">Eliminar</Button>
        </div>
      </Modal>

      {/* Modal de confirmación para generar contraseña temporal */}
      <Modal open={!!confirmTempFor} onClose={() => setConfirmTempFor(null)} title="Generar Contraseña Temporal">
        <div className="space-y-3">
          <p className="text-sm text-muted">
            ¿Generar una nueva contraseña temporal para el usuario <strong className="text-text">{confirmTempFor?.displayName} ({confirmTempFor?.email})</strong>?
          </p>
          <p className="text-xs text-rose-400">
            * Esto invalidará su contraseña actual de inmediato y le solicitará de forma obligatoria establecer una nueva la próxima vez que intente iniciar sesión.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setConfirmTempFor(null)}>Cancelar</Button>
            <Button onClick={handleGenerateTemp} loading={generatingTemp} className="bg-accent text-white">Generar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal mostrando la nueva contraseña temporal generada */}
      <Modal open={!!newTempPassword} onClose={handleCloseTempModal} title="Contraseña Temporal Generada">
        <div className="space-y-4 text-center py-2">
          <p className="text-sm text-muted">
            Se ha regenerado la contraseña temporal para <strong className="text-text">{tempPasswordUserEmail}</strong>.
          </p>
          
          <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
            <span className="text-xs uppercase font-semibold tracking-wider text-accent">Nueva Contraseña Temporal</span>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-lg font-bold select-all bg-bg px-3 py-1.5 rounded border border-border/40">
                {newTempPassword}
              </span>
              <button
                type="button"
                onClick={copyPassword}
                className="p-2 rounded-lg bg-surface-2 border border-border hover:bg-surface-3 transition-colors text-muted hover:text-text"
                title="Copiar contraseña"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <p className="text-xs text-muted">
            Por favor, copia esta contraseña y entrégasela de forma segura al usuario. El sistema le pedirá cambiarla en su próximo ingreso.
          </p>

          <div className="flex justify-center pt-2">
            <Button onClick={handleCloseTempModal} className="px-8">
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
