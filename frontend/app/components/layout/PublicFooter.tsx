// Footer del catálogo: redes, dirección, mapa y acceso discreto a colaboradores.
import { Link, useLocation } from "@remix-run/react";
import { MapPin } from "lucide-react";
import { useGetConfigQuery } from "~/store/api/catalogApi";
import { useAppSelector } from "~/store/hooks";
import { selectStatus, selectRoles } from "~/store/slices/authSlice";
import { roleLandingPath } from "~/lib/constants";

export function PublicFooter() {
  const { data: config } = useGetConfigQuery();
  const location = useLocation();
  const status = useAppSelector(selectStatus);
  const roles = useAppSelector(selectRoles);
  // Tras iniciar sesión, vuelve a la página actual del catálogo.
  const loginTo = `/login?redirectTo=${encodeURIComponent(location.pathname + location.search)}`;
  // Con sesión activa, el enlace lleva al panel en vez de pedir acceso.
  const authed = status === "authenticated";

  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <span className="bg-gradient-accent bg-clip-text text-lg font-bold text-transparent">
            Gyro Store
          </span>
          <p className="mt-2 text-sm text-muted">
            Electrónica importada desde China, disponible en Managua.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold">Ubicación</h4>
          <a
            href="https://maps.google.com/?q=Managua,Nicaragua"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
          >
            <MapPin className="h-4 w-4" />
            {config?.storeAddress ?? "Managua, Nicaragua"}
          </a>
        </div>

        <div>
          <h4 className="text-sm font-semibold">Síguenos</h4>
          <div className="mt-2 flex flex-col gap-1 text-sm text-muted">
            <a href={config?.socialLinks?.instagram ?? "#"} className="hover:text-text">Instagram</a>
            <a href={config?.socialLinks?.facebook ?? "#"} className="hover:text-text">Facebook</a>
            <a href={config?.socialLinks?.tiktok ?? "#"} className="hover:text-text">TikTok</a>
            <Link to="/contacto" className="hover:text-text">Contacto</Link>
          </div>
        </div>
      </div>

      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} Gyro Store ·{" "}
        <Link to={authed ? roleLandingPath(roles) : loginTo} className="hover:text-text">
          {authed ? "Centro de Administración" : "Acceso Colaboradores"}
        </Link>
      </div>
    </footer>
  );
}
