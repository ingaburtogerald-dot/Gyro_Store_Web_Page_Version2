// Portal de Seguimientos (CRM) — admin y vendedores.
import { RequireRole } from "~/components/admin/RequireRole";
import { FollowupsPanel } from "~/components/admin/followups/FollowupsPanel";

export default function Seguimientos() {
  return (
    <RequireRole allowed={["admin", "seller"]}>
      <FollowupsPanel />
    </RequireRole>
  );
}
