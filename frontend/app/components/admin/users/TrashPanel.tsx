// Papelera de usuarios: restaurar o eliminar permanentemente (retención 30 días).
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { useGetTrashQuery, useRestoreUserMutation, usePurgeUserMutation } from "~/store/api/usersApi";

export function TrashPanel() {
  const { data: trash = [], isLoading } = useGetTrashQuery();
  const [restore, { isLoading: restoring }] = useRestoreUserMutation();
  const [purge, { isLoading: purging }] = usePurgeUserMutation();

  async function handleRestore(id: string) {
    try {
      await restore(id).unwrap();
      toast.success("Usuario restaurado.");
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo restaurar.");
    }
  }

  async function handlePurge(id: string) {
    try {
      await purge(id).unwrap();
      toast.success("Usuario eliminado permanentemente.");
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo eliminar.");
    }
  }

  if (isLoading) return <div className="h-40 animate-pulse rounded-card border border-border bg-surface shadow-premium" />;
  if (trash.length === 0)
    return <p className="rounded-card border border-dashed border-border py-12 text-center text-muted">La papelera está vacía.</p>;

  return (
    <div className="space-y-2">
      {trash.map((u) => (
        <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface shadow-premium p-4">
          <div>
            <p className="font-medium">{u.displayName}</p>
            <p className="text-xs text-muted">{u.email} · expira en {u.daysLeft} días</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleRestore(u.id)} loading={restoring}>
              <RotateCcw className="h-4 w-4" /> Restaurar
            </Button>
            <Button size="sm" onClick={() => handlePurge(u.id)} loading={purging} className="bg-danger/90">
              <Trash2 className="h-4 w-4" /> Eliminar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
