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
import { FeedbackFab } from "~/components/layout/FeedbackFab";
import { WhatsAppFab } from "~/components/layout/WhatsAppFab";
import tailwind from "~/styles/globals.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: tailwind },
  { rel: "icon", type: "image/jpeg", href: "/logo.jpg" },
  { rel: "apple-touch-icon", href: "/logo.jpg" },
  // Inter (fuente única): <link> de primer nivel (no @import anidado en globals.css)
  // para que el navegador la descubra y pida en paralelo, no en cadena tras bajar
  // y parsear el CSS de la app. preconnect acelera la conexión a ambos hosts.
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
  },
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
          {/* Dark Premium: tarjeta translúcida + blur, borde de acento grueso a la
              izquierda por estado (éxito/error/aviso/info) — legible al instante,
              estilo macOS/Vercel. Abajo a la derecha: no compite con el header ni
              con el rail, y es donde el ojo aterriza tras una acción. */}
          <Toaster
            position="bottom-right"
            duration={5000}
            theme="dark"
            closeButton
            toastOptions={{
              classNames: {
                toast:
                  "rounded-2xl border border-white/10 bg-surface-2/90 backdrop-blur-md shadow-2xl shadow-black/50 p-4",
                title: "text-[15px] font-bold text-text",
                description: "text-sm text-muted mt-0.5",
                success: "border-l-4 border-l-accent",
                error: "border-l-4 border-l-danger",
                warning: "border-l-4 border-l-warning",
                info: "border-l-4 border-l-info",
                closeButton: "bg-surface-2 border border-white/10 text-muted hover:text-text",
                actionButton: "bg-accent text-bg font-semibold hover:bg-accent-hover",
                cancelButton: "bg-surface text-muted hover:text-text",
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

  // Ficha de producto: trae su propio breadcrumb + acciones (producto.$id.tsx),
  // sin shell, para no duplicar cabeceras. Sin WhatsAppFab acá: en móvil ya hay
  // una barra de compra fija con su propio CTA de WhatsApp específico del
  // producto ("Comprar al por mayor", mensaje prellenado) — el FAB genérico
  // (abajo-izquierda) se solaparía con esa barra y sería redundante.
  if (path.startsWith("/producto")) {
    return (
      <>
        <Outlet />
        <FeedbackFab />
      </>
    );
  }

  // Storefront público (home, combos, contacto): header full-width (Apple/Razer).
  // FeedbackFab va FUERA de StorefrontShell (no como children de <motion.main>):
  // framer-motion deja un `transform` inline incluso en reposo, que rompe
  // `position: fixed` en los descendientes (los ancla al ancestro, no al viewport).
  return (
    <>
      <StorefrontShell>
        <Outlet />
      </StorefrontShell>
      <FeedbackFab />
      <WhatsAppFab />
    </>
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
