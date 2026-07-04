// Panel principal del CRM v2: métricas + filtro por vendedor (admin) + Kanban.
import { useMemo, useState } from "react";
import { Plus, Users, Target, Trophy, Percent } from "lucide-react";
import { StatCard } from "~/components/ui/StatCard";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin } from "~/store/slices/authSlice";
import {
  useGetContactsQuery,
  useGetContactMetricsQuery,
  type Contact,
} from "~/store/api/contactsApi";
import { KanbanBoard } from "./KanbanBoard";
import { ContactModal } from "./ContactModal";
import { ContactDrawer } from "./ContactDrawer";

export function CrmPanel() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const [owner, setOwner] = useState<string | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [openContact, setOpenContact] = useState<Contact | null>(null);

  const { data, isLoading } = useGetContactsQuery(owner ? { owner } : undefined);
  const { data: metrics } = useGetContactMetricsQuery(owner ? { owner } : undefined);
  const contacts = data?.items ?? [];

  // Opciones de vendedor para el admin, derivadas de los contactos cargados (v1).
  const owners = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contacts) if (c.ownerEmail) map.set(c.ownerEmail, c.ownerName);
    return [...map.entries()].map(([email, name]) => ({ email, name }));
  }, [contacts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">CRM · Embudo de ventas</h1>
          <p className="text-muted">Mueve a tus clientes por el pipeline y no pierdas ninguna venta por olvido.</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <select
              value={owner ?? ""}
              onChange={(e) => setOwner(e.target.value || undefined)}
              className="input py-2"
            >
              <option value="">Todos los vendedores</option>
              {owners.map((o) => (
                <option key={o.email} value={o.email}>{o.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-accent px-4 py-2 text-sm font-bold text-white transition-all hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Nuevo contacto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Total leads" countTo={metrics?.total ?? 0} color="indigo" />
        <StatCard icon={Target} label="Negociando" countTo={metrics?.byStage.negotiating ?? 0} color="amber" delay={0.05} />
        <StatCard icon={Trophy} label="Ganados" countTo={metrics?.byStage.won ?? 0} color="emerald" delay={0.1} />
        <StatCard icon={Percent} label="Conversión" value={`${metrics?.conversionRate ?? 0}%`} color="sky" delay={0.15} />
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted">Cargando pipeline…</p>
      ) : (
        <>
          <KanbanBoard contacts={contacts} owner={owner} onOpen={setOpenContact} />
          {data?.nextCursor && (
            <p className="text-center text-xs text-muted">
              Mostrando los primeros {contacts.length} contactos. Filtra por vendedor para acotar la vista.
            </p>
          )}
        </>
      )}

      {creating && <ContactModal open={creating} onClose={() => setCreating(false)} />}
      {openContact && <ContactDrawer contact={openContact} onClose={() => setOpenContact(null)} />}
    </div>
  );
}
