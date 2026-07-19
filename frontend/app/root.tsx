import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
  useLocation,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import { Provider } from "react-redux";
import { Toaster } from "sonner";
import { store } from "~/store/store";
import { useAuthBootstrap } from "~/hooks/useAuth";
import { useTheme } from "~/hooks/useTheme";
import { usePageviewTelemetry } from "~/hooks/usePageviewTelemetry";
import { ForcePasswordChangeGate } from "~/components/auth/ForcePasswordChangeGate";
import { AppShell } from "~/components/layout/AppShell";
import { StorefrontShell } from "~/components/layout/StorefrontShell";
import tailwind from "~/styles/globals.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: tailwind },
  { rel: "icon", type: "image/jpeg", href: "/logo.jpg" },
  { rel: "apple-touch-icon", href: "/logo.jpg" },
  // Inter (fuente única) se carga vía @import en globals.css. Estos preconnect
  // aceleran esa descarga a Google Fonts.
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning en <html>: el script anti-flash de abajo escribe
  // `data-theme` en el cliente antes de hidratar; sin esto React ve un mismatch (el
  // server no emite el atributo) y puede RECONCILIAR el <html> borrando el `data-theme`,
  // tirando la página al tema oscuro por defecto (bug intermitente de "no recuerda el
  // tema"). Suprimirlo hace que React respete el atributo puesto por el script.
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0a0f" />
        {/* Las etiquetas Open Graph (preview al compartir) las define cada ruta vía
            su función meta() — homepage y página de producto — con URL absoluta. */}
        <Meta />
        <Links />
        {/* App bloqueada en modo oscuro: fija data-theme="dark" antes del primer paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.setAttribute('data-theme','dark');`,
          }}
        />
      </head>
      <body className="min-h-screen bg-bg text-text antialiased">
        {/* Provider de Redux + notificaciones toast globales (Sonner) */}
        <Provider store={store}>
          <AuthBootstrap />
          <ForcePasswordChangeGate>
            {children}
          </ForcePasswordChangeGate>
          {/* Colores vía tokens: el toast sigue al tema activo (oscuro/claro) */}
          <Toaster
            position="top-left"
            duration={5000}
            theme="dark"
            closeButton
            toastOptions={{
              style: {
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              },
            }}
          />
        </Provider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Arranca el listener de sesión una sola vez (dentro del Provider). Sin UI.
function AuthBootstrap() {
  useAuthBootstrap();
  // Sincroniza el tema globalmente tras la hidratación, para que si React
  // borra data-theme="light", se vuelva a aplicar y persista.
  useTheme();
  return null;
}

export default function App() {
  const location = useLocation();
  const path = location.pathname;

  // Registra el tráfico real (pageviews). Hook incondicional → antes de cualquier
  // return; internamente excluye rutas de staff y se apaga en localhost.
  usePageviewTelemetry();

  // Login: pantalla propia sin chrome.
  if (path.startsWith("/login")) {
    return <Outlet />;
  }

  // Centro de administración: rail persistente (AppShell) con "Mi negocio".
  if (path.startsWith("/admin")) {
    return (
      <AppShell>
        <Outlet />
      </AppShell>
    );
  }

  // Ficha de producto: trae su propia navegación contextual (ProductTopNav),
  // que reemplaza al header — sin shell para no duplicar cabeceras.
  if (path.startsWith("/producto")) {
    return <Outlet />;
  }

  // Storefront público (home, combos, contacto): header full-width (Apple/Razer).
  return (
    <StorefrontShell>
      <Outlet />
    </StorefrontShell>
  );
}

// Boundary de error global — mensaje claro al usuario, sin pantalla en blanco.
export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} — ${error.statusText}`
    : error instanceof Error ? error.message : "Ocurrió un error inesperado.";
  const stack = error instanceof Error ? error.stack : "";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold text-accent-2">Gyro Store (Debug Error)</h1>
      <p className="text-danger max-w-3xl font-mono text-sm">{message}</p>
      {stack && (
        <pre className="max-w-3xl overflow-auto text-left text-xs bg-surface-2 p-4 text-muted rounded-xl">
          {stack}
        </pre>
      )}
      <a href="/" className="rounded-pill bg-gradient-accent px-6 py-2.5 text-sm font-medium text-bg">
        Volver al inicio
      </a>
    </main>
  );
}
