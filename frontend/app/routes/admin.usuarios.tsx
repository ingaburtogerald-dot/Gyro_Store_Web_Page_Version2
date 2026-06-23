// Portal de Gestión de Usuarios: usuarios activos + papelera.
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { RequireRole } from "~/components/admin/RequireRole";
import { Button } from "~/components/ui/Button";
import { UsersTable } from "~/components/admin/users/UsersTable";
import { UserFormModal } from "~/components/admin/users/UserFormModal";
import { TrashPanel } from "~/components/admin/users/TrashPanel";
import type { ManagedUser } from "~/store/api/usersApi";
import { TabBtn } from "~/components/ui/TabBtn";

export default function Usuarios() {
  const [tab, setTab] = useState<"active" | "trash">("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(u: ManagedUser) {
    setEditing(u);
    setModalOpen(true);
  }

  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="gradient-text text-2xl font-bold">Gestión de Usuarios</h1>
            <p className="text-muted">Crea, invita y administra los roles del equipo.</p>
          </div>
          <Button onClick={openCreate}>
            <UserPlus className="h-4 w-4" /> Nuevo usuario
          </Button>
        </div>

        <div className="flex gap-1 rounded-pill border border-border bg-surface p-1 sm:w-fit">
          <TabBtn active={tab === "active"} onClick={() => setTab("active")}>Activos</TabBtn>
          <TabBtn active={tab === "trash"} onClick={() => setTab("trash")}>Papelera</TabBtn>
        </div>

        {tab === "active" ? <UsersTable onEdit={openEdit} /> : <TrashPanel />}
      </div>

      <UserFormModal open={modalOpen} onClose={() => setModalOpen(false)} user={editing} />
    </RequireRole>
  );
}

