// Header sticky del catálogo público: logo, redes sociales, WhatsApp y acceso discreto.
import { Link, useLocation } from "@remix-run/react";
import { Instagram, Facebook, MessageCircle, LogIn, Pencil, LayoutDashboard } from "lucide-react";
import { Logo } from "~/components/ui/Logo";
import { buildWhatsappUrl, cn } from "~/lib/utils";
import { roleLandingPath } from "~/lib/constants";
import { useGetConfigQuery } from "~/store/api/catalogApi";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { selectIsAdmin, selectEditMode, selectStatus, selectRoles, toggleEditMode } from "~/store/slices/authSlice";

export function PublicHeader() {
  const { data: config } = useGetConfigQuery();
  const whatsapp = config?.whatsapp ?? "50585944758";
  const social = config?.socialLinks;
  const dispatch = useAppDispatch();
  const isAdmin = useAppSelector(selectIsAdmin);
  const editMode = useAppSelector(selectEditMode);
  const status = useAppSelector(selectStatus);
  const roles = useAppSelector(selectRoles);
  const location = useLocation();
  // Tras iniciar sesión, vuelve a la página actual del catálogo.
  const loginTo = `/login?redirectTo=${encodeURIComponent(location.pathname + location.search)}`;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/">
          <Logo size={38} withText textClassName="text-xl" />
        </Link>

        {/* Redes sociales (centro, oculto en móvil) */}
        <nav className="hidden items-center gap-4 md:flex">
          <a href={social?.instagram ?? "#"} target="_blank" rel="noreferrer" aria-label="Instagram"
            className="text-muted transition-colors hover:text-text">
            <Instagram className="h-5 w-5" />
          </a>
          <a href={social?.facebook ?? "#"} target="_blank" rel="noreferrer" aria-label="Facebook"
            className="text-muted transition-colors hover:text-text">
            <Facebook className="h-5 w-5" />
          </a>
          <a href={social?.tiktok ?? "#"} target="_blank" rel="noreferrer" aria-label="TikTok"
            className="text-muted transition-colors hover:text-text">
            {/* Lucide no trae logo de TikTok; usamos un glifo */}
            <span className="text-sm font-bold">TikTok</span>
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => dispatch(toggleEditMode())}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill border px-3 py-2 text-sm transition-colors",
                editMode ? "border-transparent bg-gradient-accent text-white" : "border-border text-muted hover:text-text",
              )}
              title="Modo edición del catálogo"
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">{editMode ? "Editando" : "Editar"}</span>
            </button>
          )}
          <a
            href={buildWhatsappUrl(whatsapp, "Hola Gyro Store, tengo una consulta 👋")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-pill bg-whatsapp px-4 py-2 text-sm font-semibold text-[#04201a]"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          {/* Con sesión activa: ir al panel (no se cierra la sesión). Sin sesión: acceso. */}
          {status === "authenticated" ? (
            <Link
              to={roleLandingPath(roles)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-accent-2/40 px-3 py-2 text-sm font-medium text-accent-2 transition-colors hover:bg-accent-2/10"
              title="Centro de Administración"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Centro de Administración</span>
            </Link>
          ) : status === "unauthenticated" ? (
            <Link
              to={loginTo}
              className="inline-flex items-center gap-1.5 rounded-pill px-3 py-2 text-sm text-muted transition-colors hover:text-text"
              title="Acceso Colaboradores"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Acceso</span>
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
