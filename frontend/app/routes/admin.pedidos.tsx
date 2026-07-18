import { redirect } from "@remix-run/node";

export function loader() {
  return redirect("/admin/crm");
}

export default function PedidosRedirect() {
  return null;
}
