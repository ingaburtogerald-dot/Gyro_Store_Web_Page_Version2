// Modal para crear o editar usuarios. En creación pide proveedor y correo; en
// edición solo permite cambiar nombre y roles. Soporta roles múltiples.
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { useCreateUserMutation, useUpdateUserMutation, type ManagedUser } from "~/store/api/usersApi";
import { ROLE_LABELS, type Role } from "~/lib/constants";
import { cn } from "~/lib/utils";

const ALL_ROLES = Object.keys(ROLE_LABELS).filter((r) => r !== "global_admin") as Role[];

export function UserFormModal({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user?: ManagedUser | null;
}) {
  const isEdit = !!user;
  const [createUser, { isLoading: creating }] = useCreateUserMutation();
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState<"local" | "google" | "microsoft">("local");
  const [roles, setRoles] = useState<Role[]>([]);

  // Estados para mostrar la contraseña temporal
  const [createdTempPassword, setCreatedTempPassword] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setDisplayName(user?.displayName || "");
      setEmail(user?.email || "");
      setProvider(user?.provider || "local");
      setRoles(user?.roles?.filter((r) => r !== "global_admin") || []);
      setCreatedTempPassword(null);
      setCreatedEmail("");
      setCopied(false);
    }
  }, [open, user]);

  function toggleRole(r: Role) {
    setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));
  }

  function copyPassword() {
    if (!createdTempPassword) return;
    navigator.clipboard.writeText(createdTempPassword);
    setCopied(true);
    toast.success("Contraseña copiada al portapapeles.");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDone() {
    setCreatedTempPassword(null);
    setCreatedEmail("");
    onClose();
  }

  async function submit() {
    if (!displayName.trim()) return toast.error("El nombre es obligatorio.");
    if (roles.length === 0) return toast.error("Asigna al menos un rol.");
    try {
      if (isEdit) {
        await updateUser({ id: user!.id, displayName: displayName.trim(), roles }).unwrap();
        toast.success("Usuario actualizado.");
        onClose();
      } else {
        if (!email.trim()) return toast.error("El correo es obligatorio.");
        const res = await createUser({ email: email.trim(), displayName: displayName.trim(), roles, provider }).unwrap();
        if (res.tempPassword) {
          toast.success("Usuario creado con contraseña temporal.");
          setCreatedTempPassword(res.tempPassword);
          setCreatedEmail(res.email);
        } else {
          toast.success("Usuario creado. Se envió la invitación.");
          onClose();
        }
      }
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo guardar.");
    }
  }

  if (createdTempPassword) {
    return (
      <Modal open={open} onClose={handleDone} title="Usuario Creado Exitosamente">
        <div className="space-y-4 text-center py-2">
          <p className="text-sm text-muted">
            Se ha creado la cuenta local para <strong className="text-text">{createdEmail}</strong>.
          </p>
          
          <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
            <span className="text-xs uppercase font-semibold tracking-wider text-accent">Contraseña Temporal</span>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-lg font-bold select-all bg-bg px-3 py-1.5 rounded border border-border/40">
                {createdTempPassword}
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
            Por favor, copia y entrega esta contraseña al usuario. El sistema le solicitará cambiarla obligatoriamente al ingresar por primera vez.
          </p>

          <div className="flex justify-center pt-2">
            <Button onClick={handleDone} className="px-8">
              Entendido
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Editar usuario" : "Nuevo usuario"}>
      <div className="space-y-3">
        {!isEdit && (
          <Field label="Tipo de cuenta">
            <select className="input" value={provider} onChange={(e) => setProvider(e.target.value as any)}>
              <option value="local">Local (@gyrostore.com)</option>
              <option value="google">Google</option>
              <option value="microsoft">Microsoft</option>
            </select>
          </Field>
        )}

        <Field label="Nombre">
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nombre completo" />
        </Field>

        <Field label="Correo">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isEdit}
            placeholder={provider === "local" ? "usuario@gyrostore.com" : "correo@gmail.com"}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted">Roles</span>
          <div className="flex flex-wrap gap-2">
            {ALL_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggleRole(r)}
                className={cn(
                  "rounded-pill border px-3 py-1.5 text-sm transition-colors",
                  roles.includes(r) ? "border-transparent bg-gradient-accent text-white" : "border-border text-muted hover:text-text",
                )}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={submit} loading={creating || updating}>{isEdit ? "Guardar" : "Crear e invitar"}</Button>
        </div>
      </div>
    </Modal>
  );
}
