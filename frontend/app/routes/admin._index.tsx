// Índice del Centro de Administración: bienvenida + accesos rápidos por rol.
// Las tarjetas de portales se completan en fases posteriores.
import { useAppSelector } from "~/store/hooks";
import { selectUser } from "~/store/slices/authSlice";
import { ROLE_LABELS, type Role } from "~/lib/constants";

export default function AdminHome() {
  const user = useAppSelector(selectUser);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Hola, {user?.name} 👋</h1>
      <p className="mt-1 text-muted">Bienvenido al Centro de Administración de Gyro Store.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(user?.roles ?? []).map((r) => (
          <span
            key={r}
            className="rounded-pill border border-border bg-surface px-3 py-1 text-xs text-muted"
          >
            {ROLE_LABELS[r as Role] ?? r}
          </span>
        ))}
      </div>

      <div className="mt-8 rounded-card border border-border bg-surface p-6 text-sm text-muted">
        Selecciona un portal en el menú lateral para comenzar. Los módulos de
        inventario, ventas, facturación, reportes, logística y usuarios se irán
        habilitando por fases.
      </div>
    </div>
  );
}
