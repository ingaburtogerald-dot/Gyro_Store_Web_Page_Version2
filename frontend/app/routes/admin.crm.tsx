// Portal CRM v2 (embudo Kanban + historial) — admin y vendedores.
import { RequireRole } from "~/components/admin/RequireRole";
import { CrmPanel } from "~/components/admin/crm/CrmPanel";

export default function Crm() {
  return (
    <RequireRole allowed={["admin", "seller"]}>
      <CrmPanel />
    </RequireRole>
  );
}
