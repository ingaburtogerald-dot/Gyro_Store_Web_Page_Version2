import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import { Provider } from "react-redux";
import { Toaster } from "sonner";
import { store } from "~/store/store";
import { useAuthBootstrap } from "~/hooks/useAuth";
import { ForcePasswordChangeGate } from "~/components/auth/ForcePasswordChangeGate";
import tailwind from "~/tailwind.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: tailwind },
  { rel: "icon", type: "image/jpeg", href: "/logo.jpg" },
  { rel: "apple-touch-icon", href: "/logo.jpg" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Inter:wght@400;500;600;700&family=Sora:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0a0f" />
        {/* Las etiquetas Open Graph (preview al compartir) las define cada ruta vía
            su función meta() — homepage y página de producto — con URL absoluta. */}
        <Meta />
        <Links />
        {/* Aplica el tema guardado antes del primer paint para evitar parpadeo */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('gyro-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
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
            position="top-right"
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
  return null;
}

export default function App() {
  return <Outlet />;
}

// Boundary de error global — mensaje claro al usuario, sin pantalla en blanco.
export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} — ${error.statusText}`
    : "Ocurrió un error inesperado.";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold text-accent-2">Gyro Store</h1>
      <p className="text-muted">{message}</p>
      <a href="/" className="rounded-pill bg-gradient-accent px-6 py-2.5 text-sm font-medium text-white">
        Volver al inicio
      </a>
    </main>
  );
}
