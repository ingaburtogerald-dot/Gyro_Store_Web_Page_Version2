// Panel de Seguimientos: KPIs + filtros (vendedor / origen / etiqueta) + board por urgencia.
import { useMemo, useState } from "react";
import { Plus, Users, AlarmClock, Inbox, CheckCircle2, X } from "lucide-react";
import { StatCard } from "~/components/ui/Card";
import { FilterSelect } from "~/components/ui/FilterSelect";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin } from "~/store/slices/authSlice";
import {
  useGetContactsQuery,
  type Contact,
  type ContactSource,
  type ContactTag,
} from "~/store/api/contactsApi";
import { ContactsTable } from "./ContactsTable";
import { ContactModal } from "./ContactModal";
import { ContactDrawer } from "./ContactDrawer";
import { isDue, dueState, SOURCE_ORDER, SOURCE_META, TAG_ORDER, TAG_META } from "./crmMeta";

export function CrmPanel() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const [owner, setOwner] = useState<string | undefined>(undefined);
  const [sourceFilter, setSourceFilter] = useState<ContactSource | "">("");
  const [tagFilter, setTagFilter] = useState<ContactTag | "">("");
  const [creating, setCreating] = useState(false);
  const [openContact, setOpenContact] = useState<Contact | null>(null);

  const { data: all = [], isLoading } = useGetContactsQuery(owner ? { owner } : undefined);

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of all) if (c.ownerEmail) map.set(c.ownerEmail, c.ownerName);
    return [...map.entries()].map(([email, name]) => ({ email, name }));
  }, [all]);

  const contacts = useMemo(
    () =>
      all.filter(
        (c) => (!sourceFilter || c.source === sourceFilter) && (!tagFilter || c.tags.includes(tagFilter)),
      ),
    [all, sourceFilter, tagFilter],
  );

  const kpis = useMemo(() => {
    const active = contacts.filter((c) => c.status === "active");
    return {
      active: active.length,
      due: active.filter(isDue).length,
      noTask: active.filter((c) => dueState(c) === "none").length,
      closed: contacts.filter((c) => c.status === "closed").length,
    };
  }, [contacts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Seguimientos</h1>
          <p className="text-muted">Apunta a tus clientes y no pierdas ninguna venta por olvido.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-accent px-4 py-2 text-sm font-bold text-white transition-all hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nuevo contacto
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Activos" countTo={kpis.active} color="indigo" />
        <StatCard icon={AlarmClock} label="Por atender" countTo={kpis.due} color="rose" delay={0.05} />
        <StatCard icon={Inbox} label="Sin tarea" countTo={kpis.noTask} color="amber" delay={0.1} />
        <StatCard icon={CheckCircle2} label="Cerrados" countTo={kpis.closed} color="emerald" delay={0.15} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {isAdmin && (
          <div className="w-full sm:w-48">
            <span className="mb-1 block text-xs text-muted">Vendedor</span>
            <FilterSelect
              value={owner ?? ""}
              onChange={(v) => setOwner(v || undefined)}
              placeholder="Todos los vendedores"
              icon={<Users className="h-4 w-4" />}
              options={[{ value: "", label: "Todos los vendedores" }, ...owners.map((o) => ({ value: o.email, label: o.name }))]}
            />
          </div>
        )}
        <div className="w-full sm:w-52">
          <span className="mb-1 block text-xs text-muted">Origen</span>
          <FilterSelect
            value={sourceFilter}
            onChange={(v) => setSourceFilter(v as ContactSource | "")}
            placeholder="Todos los orígenes"
            options={[{ value: "", label: "Todos los orígenes" }, ...SOURCE_ORDER.map((s) => ({ value: s, label: `${SOURCE_META[s].emoji}  ${SOURCE_META[s].label}` }))]}
          />
        </div>
        <div className="w-full sm:w-48">
          <span className="mb-1 block text-xs text-muted">Etiqueta</span>
          <FilterSelect
            value={tagFilter}
            onChange={(v) => setTagFilter(v as ContactTag | "")}
            placeholder="Todas las etiquetas"
            options={[{ value: "", label: "Todas las etiquetas" }, ...TAG_ORDER.map((t) => ({ value: t, label: TAG_META[t].label }))]}
          />
        </div>
        {(owner || sourceFilter || tagFilter) && (
          <button
            onClick={() => { setOwner(undefined); setSourceFilter(""); setTagFilter(""); }}
            className="mb-0.5 inline-flex items-center gap-1 rounded-pill px-2.5 py-2 text-xs text-muted hover:bg-surface-2 hover:text-text"
          >
            <X className="h-3.5 w-3.5" /> Limpiar
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted">Cargando seguimientos…</p>
      ) : (
        <ContactsTable contacts={contacts} owner={owner} onOpen={setOpenContact} />
      )}

      {creating && <ContactModal open={creating} onClose={() => setCreating(false)} />}
      {openContact && <ContactDrawer contact={openContact} onClose={() => setOpenContact(null)} />}
    </div>
  );
}
