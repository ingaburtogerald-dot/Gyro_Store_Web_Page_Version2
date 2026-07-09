import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Mail, Lock, ArrowLeft, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertTriangle, KeyRound, MessageCircle } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { Logo } from "~/components/ui/Logo";
import { cn, buildWhatsappUrl } from "~/lib/utils";
import { useAuth } from "~/hooks/useAuth";
import { GoogleStrategy, MicrosoftStrategy, EmailStrategy } from "~/lib/authStrategies";
import { loginSchema, type LoginInput } from "~/lib/validators";
import { roleLandingPath, type Role, WHATSAPP_NUMBER } from "~/lib/constants";

export const meta: MetaFunction = () => [{ title: "Acceso Colaboradores · Gyro Store" }];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Página desde donde se inició el login (la dejó el header/footer o RequireRole).
  const redirectTo = searchParams.get("redirectTo");
  const [busy, setBusy] = useState<null | "google" | "microsoft" | "email">(null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  // Saludo según la hora. Se calcula tras montar para no chocar con el SSR
  // (la hora del servidor puede diferir de la del navegador → hydration mismatch).
  const [greeting, setGreeting] = useState<{ text: string; emoji: string } | null>(null);
  useEffect(() => setGreeting(getGreeting()), []);

  // Pre-cargar Firebase Auth para evitar que el navegador (Edge/Safari) 
  // bloquee el popup por culpa del delay del "fetch" asíncrono.
  useEffect(() => {
    import("~/lib/firebase.client").then((m) => m.getFirebaseAuth().catch(console.error));
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // Validación en vivo del correo (solo para el check verde; los errores formales
  // los sigue manejando zod al enviar).
  const emailValue = watch("email") || "";
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);

  // Recuperación de contraseña: no usamos correo (muchos colaboradores son cuentas
  // locales sin buzón accesible). En su lugar abrimos WhatsApp con el admin, que
  // restablece la clave y activa mustChangePassword. Prellenamos el correo si lo escribió.
  const recoveryUrl = buildWhatsappUrl(
    WHATSAPP_NUMBER,
    `Hola 👋, olvidé mi contraseña de Gyro Store.${
      emailValid ? ` Mi correo es: ${emailValue}.` : ""
    } ¿Me pueden ayudar a restablecerla?`,
  );

  // Tras un login exitoso: si venimos de una página concreta, regresa ahí;
  // de lo contrario, redirige según los roles del usuario.
  function redirectAfterLogin(roles: string[]) {
    // Respeta el origen, pero solo rutas internas (evita open-redirect) y nunca /login.
    if (
      redirectTo &&
      redirectTo.startsWith("/") &&
      !redirectTo.startsWith("//") &&
      !redirectTo.startsWith("/login")
    ) {
      return navigate(redirectTo);
    }
    return navigate(roleLandingPath(roles as Role[]));
  }

  async function run(kind: "google" | "microsoft" | "email", input?: LoginInput) {
    setBusy(kind);
    try {
      const strategy =
        kind === "google"
          ? new GoogleStrategy()
          : kind === "microsoft"
            ? new MicrosoftStrategy()
            : new EmailStrategy(input!.email, input!.password);
      const user = await login(strategy);
      toast.success(`Bienvenido, ${user.name}`);
      redirectAfterLogin(user.roles);
    } catch (err: any) {
      toast.error(err?.message || "No se pudo iniciar sesión.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Fondo aurora */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="animate-aurora absolute -left-1/4 top-0 h-[60vh] w-[60vh] rounded-full bg-accent blur-[120px]" />
        <div className="animate-aurora absolute -right-1/4 bottom-0 h-[50vh] w-[50vh] rounded-full bg-accent-2 blur-[120px]" />
      </div>

      {/* Marca de agua: wordmark repetido para que la pantalla se sienta "de Gyro" y no genérica. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -inset-1/4 flex flex-wrap content-center justify-center gap-x-12 gap-y-10 rotate-[-20deg] select-none text-3xl font-extrabold uppercase tracking-[0.3em] text-text opacity-[0.025]">
          {Array.from({ length: 80 }).map((_, i) => (
            <span key={i}>Gyro Store</span>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass relative z-10 w-full max-w-md rounded-card p-8"
      >
        <a href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
          <ArrowLeft className="h-4 w-4" /> Volver al catálogo
        </a>

        <div className="mb-5 flex flex-col items-center text-center">
          <div className="relative mb-3">
            <span className="pointer-events-none absolute inset-0 -z-10 animate-pulse rounded-full bg-accent/20 blur-2xl" />
            <Logo size={88} className="drop-shadow-[0_0_25px_rgba(124,131,255,0.35)]" />
          </div>
          {greeting && (
            <p className="mb-0.5 text-sm font-medium text-muted animate-in fade-in duration-500">
              {greeting.text} <span className="align-middle">{greeting.emoji}</span>
            </p>
          )}
          <h1 className="bg-gradient-accent bg-clip-text text-2xl font-bold text-transparent">
            Acceso Colaboradores
          </h1>
          <p className="mt-1 text-sm text-muted">Inicia sesión para gestionar Gyro Store.</p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface/60 px-2.5 py-1 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-accent-2" /> Conexión cifrada y segura
          </span>
        </div>

        {/* Email + contraseña */}
        <form onSubmit={handleSubmit((d) => run("email", d))} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Correo
            </label>
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl border bg-surface px-3 transition-colors",
                emailValid
                  ? "border-accent/60 focus-within:border-accent"
                  : "border-border focus-within:border-accent",
              )}
            >
              <Mail className={cn("h-4 w-4 transition-colors", emailValid ? "text-accent" : "text-muted")} />
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="tu@gyrostore.com"
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted"
                {...register("email")}
              />
              {emailValid && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-accent animate-in fade-in zoom-in duration-200" />
              )}
            </div>
            {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
              Contraseña
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-accent">
              <Lock className="h-4 w-4 text-muted" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="shrink-0 p-1 text-muted transition-colors hover:text-text"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
            )}
            {capsOn && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-warning animate-in fade-in duration-200">
                <AlertTriangle className="h-3.5 w-3.5" /> Bloq Mayús está activado
              </p>
            )}
            <div className="mt-1.5 text-right">
              <button
                type="button"
                onClick={() => setShowRecovery((v) => !v)}
                className="text-xs text-muted transition-colors hover:text-accent-2"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </div>

          {/* Panel de recuperación: sin correo, vía WhatsApp con el admin. */}
          {showRecovery && (
            <div className="rounded-xl border border-accent-2/30 bg-accent-2/5 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="mb-2 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-accent-2" />
                <span className="text-sm font-medium">Restablecer contraseña</span>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                Escríbele al administrador por WhatsApp. Él te asignará una clave temporal y, al
                entrar, el sistema te pedirá crear una nueva.
              </p>
              <a
                href={recoveryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-pill bg-whatsapp py-2.5 text-sm font-semibold text-[#04201a] transition-transform hover:scale-[1.02]"
              >
                <MessageCircle className="h-4 w-4" /> Escribir al administrador
              </a>
            </div>
          )}

          <Button type="submit" className="w-full" loading={busy === "email"}>
            Iniciar sesión
          </Button>
        </form>

        {/* Separador */}
        <div className="my-6 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" /> o continúa con <span className="h-px flex-1 bg-border" />
        </div>

        {/* Proveedores externos */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            loading={busy === "google"}
            onClick={() => run("google")}
            className="hover:border-[#4285F4]/70 hover:bg-[#4285F4]/5"
          >
            {busy !== "google" && <GoogleIcon className="h-4 w-4" />}
            Google
          </Button>
          {/* Hotmail/Outlook usa la estrategia de Microsoft por debajo (mismo OAuth que valida @hotmail/@outlook). */}
          <Button
            variant="outline"
            loading={busy === "microsoft"}
            onClick={() => run("microsoft")}
            className="hover:border-[#0078D4]/70 hover:bg-[#0078D4]/5"
          >
            {busy !== "microsoft" && <OutlookIcon className="h-4 w-4" />}
            Hotmail
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          Aceptamos cuentas <span className="text-text">@gmail</span>,{" "}
          <span className="text-text">@hotmail</span> y <span className="text-text">@outlook</span>.
        </p>
      </motion.div>
    </main>
  );
}

// Saludo según la franja horaria del navegador.
function getGreeting(): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 12) return { text: "Buenos días", emoji: "🌅" };
  if (h < 19) return { text: "Buenas tardes", emoji: "☀️" };
  return { text: "Buenas noches", emoji: "🌙" };
}

// Íconos de marca (inline para no depender de paquetes externos de logos).
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2.5" fill="#0078D4" />
      <path
        d="M3.2 7.2 12 13l8.8-5.8"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
