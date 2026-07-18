// Gate de roles del lado del cliente. La verificación REAL ocurre en el backend
// (middleware requireRole); esto solo controla qué renderiza la UI. Nunca confiar
// solo en esto para datos sensibles — siempre validar en el servidor.
import { useEffect } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAppSelector } from "~/store/hooks";
import { selectRoles, selectStatus } from "~/store/slices/authSlice";
import { useAuth } from "~/hooks/useAuth";
import { useIdleTimeout } from "~/hooks/useIdleTimeout";
import type { Role } from "~/lib/constants";

export function RequireRole({
  allowed,
  children,
}: {
  allowed: Role[];
  children: React.ReactNode;
}) {
  const status = useAppSelector(selectStatus);
  const roles = useAppSelector(selectRoles);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const hasAccess = roles.includes("global_admin") || roles.some((r) => allowed.includes(r));

  useIdleTimeout({
    minutes: 15,
    isActive: status === "authenticated",
    onIdle: () => {
      toast.error("Sesión cerrada por inactividad");
      logout();
    },
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      // Conserva la ruta protegida para volver aquí tras iniciar sesión.
      const from = location.pathname + location.search;
      navigate(`/login?redirectTo=${encodeURIComponent(from)}`);
    }
  }, [status, navigate, location]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  if (status === "authenticated" && !hasAccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-xl font-bold">Sin permisos</h1>
        <p className="text-muted">Tu cuenta no tiene acceso a esta sección.</p>
        <a href="/" className="text-sm text-accent-2 hover:underline">
          Volver al catálogo
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
