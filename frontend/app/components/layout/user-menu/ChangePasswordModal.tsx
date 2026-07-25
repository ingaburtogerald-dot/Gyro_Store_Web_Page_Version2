import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { getIdToken } from "~/lib/authStrategies";

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres.");
    if (newPassword !== confirm) return toast.error("Las contraseñas no coinciden.");

    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("No se pudo obtener el token de autenticación.");
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo cambiar la contraseña.");
      toast.success("Contraseña actualizada correctamente.");
      setNewPassword("");
      setConfirm("");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cambiar contraseña">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="np" className="mb-1.5 block text-sm font-medium">
            Nueva contraseña
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 focus-within:border-accent">
            <Lock className="h-4 w-4 text-muted" />
            <input
              id="np"
              type={show ? "text" : "password"}
              placeholder="Mínimo 6 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted"
              required
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="text-muted hover:text-text">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="cp" className="mb-1.5 block text-sm font-medium">
            Confirmar contraseña
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 focus-within:border-accent">
            <Lock className="h-4 w-4 text-muted" />
            <input
              id="cp"
              type={show ? "text" : "password"}
              placeholder="Repite la contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          Actualizar contraseña
        </Button>
      </form>
    </Modal>
  );
}
