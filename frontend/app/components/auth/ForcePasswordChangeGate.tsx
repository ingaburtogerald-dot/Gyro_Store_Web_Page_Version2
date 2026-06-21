import { useState } from "react";
import { Lock, Eye, EyeOff, LogOut, Key } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { useAuth } from "~/hooks/useAuth";
import { useAppDispatch } from "~/store/hooks";
import { setUser } from "~/store/slices/authSlice";
import { getIdToken, type SessionUser } from "~/lib/authStrategies";

export function ForcePasswordChangeGate({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const dispatch = useAppDispatch();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user || !user.mustChangePassword) {
    return <>{children}</>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword.length < 6) {
      return toast.error("La contraseña debe tener al menos 6 caracteres.");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("Las contraseñas no coinciden.");
    }

    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("No se pudo obtener el token de autenticación.");
      }

      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Ocurrió un error al cambiar la contraseña.");
      }

      toast.success("Contraseña actualizada correctamente.");
      
      // Actualizamos el estado de Redux para desactivar el bloqueo
      if (user && user.uid) {
        dispatch(
          setUser({
            ...user,
            uid: user.uid,
            mustChangePassword: false,
          } as SessionUser)
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 backdrop-blur-md overflow-hidden p-4">
      {/* Fondo aurora */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="animate-aurora absolute -left-1/4 top-0 h-[60vh] w-[60vh] rounded-full bg-accent blur-[120px]" />
        <div className="animate-aurora absolute -right-1/4 bottom-0 h-[50vh] w-[50vh] rounded-full bg-accent-2 blur-[120px]" />
      </div>

      <div className="glass relative z-10 w-full max-w-md rounded-card p-8 shadow-2xl border border-white/10">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 text-accent mb-4 border border-accent/30">
            <Key className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Cambio de Contraseña Requerido</h1>
          <p className="mt-2 text-sm text-muted">
            Has iniciado sesión con una contraseña temporal. Por seguridad, debes establecer una contraseña nueva antes de continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium">
              Nueva contraseña
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-accent">
              <Lock className="h-4 w-4 text-muted" />
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted hover:text-text focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium">
              Confirmar nueva contraseña
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-accent">
              <Lock className="h-4 w-4 text-muted" />
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Actualizar contraseña
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" /> o <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          variant="outline"
          onClick={logout}
          className="w-full"
        >
          <LogOut className="h-4 w-4 mr-1.5" /> Cerrar sesión
        </Button>
      </div>
    </main>
  );
}
