import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { toast } from "sonner";
import {
  Mail, Lock, ArrowLeft, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertTriangle,
  KeyRound, MessageCircle, Gauge, LifeBuoy,
} from "lucide-react";
import { Button } from "~/components/ui/Button";
import { Logo } from "~/components/ui/Logo";
import { cn, buildWhatsappUrl } from "~/lib/utils";
import { useAuth } from "~/hooks/useAuth";
import { GoogleStrategy, MicrosoftStrategy, EmailStrategy } from "~/lib/authStrategies";
import { loginSchema, type LoginInput } from "~/lib/validators";
import { roleLandingPath, type Role, WHATSAPP_NUMBER } from "~/lib/constants";

export const meta: MetaFunction = () => [{ title: "Iniciar Sesión · Gyro Store" }];

// Curva de salida exponencial (mismo lenguaje de motion que el resto de la app).
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_IN = [0.7, 0, 0.84, 0] as const;
// Duración de la animación de salida antes de navegar al dashboard.
const EXIT_MS = 520;

// Beneficios del pie del panel de marca.
const BENEFITS = [
  { icon: ShieldCheck, label: "Conexión segura" },
  { icon: Gauge, label: "Gestión rápida" },
  { icon: LifeBuoy, label: "Soporte directo" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reduce = useReducedMotion();
  // Página desde donde se inició el login (la dejó el header/footer o RequireRole).
  const redirectTo = searchParams.get("redirectTo");
  const [busy, setBusy] = useState<null | "google" | "microsoft" | "email">(null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  // `exiting` dispara la animación de transición hacia el dashboard.
  const [exiting, setExiting] = useState(false);
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

  // Ruta destino tras un login exitoso: respeta el origen (solo rutas internas,
  // evita open-redirect y nunca /login); si no, según los roles del usuario.
  function resolveTarget(roles: string[]): string {
    if (
      redirectTo &&
      redirectTo.startsWith("/") &&
      !redirectTo.startsWith("//") &&
      !redirectTo.startsWith("/login")
    ) {
      return redirectTo;
    }
    return roleLandingPath(roles as Role[]);
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
      const target = resolveTarget(user.roles);
      // Con motion reducido no hay animación de salida: navega directo.
      if (reduce) {
        navigate(target);
        return;
      }
      // Reproduce la transición de salida (variants "exit" vía `exiting`) y navega
      // al terminar. `viewTransition` deja que el navegador haga el morph entre rutas.
      setExiting(true);
      window.setTimeout(() => navigate(target, { viewTransition: true }), EXIT_MS);
      // Mantenemos `busy` durante la salida (el panel se está yendo).
    } catch (err: any) {
      toast.error(err?.message || "No se pudo iniciar sesión.");
      setBusy(null);
    }
  }

  // ── Variants de SALIDA (Framer) ────────────────────────────────────────
  // La ENTRADA es CSS puro (clases login-enter-*, ver globals.css): robusta ante
  // fallo de JS y sin parpadeo. Framer solo orquesta la salida al dashboard.
  const brandVariants: Variants = {
    exit: { scale: reduce ? 1 : 1.08, transition: { duration: 0.5, ease: EASE_OUT } },
  };
  const cardVariants: Variants = {
    exit: { opacity: 0, x: reduce ? 0 : 96, transition: { duration: 0.42, ease: EASE_IN } },
  };
  // Delay escalonado para los items del panel de marca (entrada CSS).
  const itemDelay = (i: number): React.CSSProperties =>
    reduce ? {} : { animationDelay: `${0.15 + i * 0.08}s` };

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-bg lg:grid lg:grid-cols-[minmax(0,44%)_1fr]">
      {/* ── PANEL IZQUIERDO · Marca (oculto en móvil) ─────────────────────── */}
      {/* Panel de marca: fondo más luminoso y gradiente sutil */}
      <motion.aside
        variants={brandVariants}
        initial={false}
        animate={exiting ? "exit" : undefined}
        className="login-enter-slide relative hidden overflow-hidden bg-surface-2 text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-[#10b981]/25 via-transparent to-[#5eead4]/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="animate-aurora absolute -left-1/4 top-0 h-[55vh] w-[55vh] rounded-full bg-[#10b981] opacity-30 blur-[120px]" />
          <div className="animate-aurora absolute -right-1/4 bottom-0 h-[45vh] w-[45vh] rounded-full bg-[#5eead4] opacity-20 blur-[120px]" />
          {/* Glow central que ancla el emblema y llena el vacío con luz de marca. */}
          <div className="absolute left-1/3 top-2/5 h-[50vh] w-[50vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#10b981]/20 blur-[110px]" />
          {/* Wordmark tenue en diagonal para que se sienta "de Gyro". */}
          <div className="absolute -inset-1/4 flex flex-wrap content-center justify-center gap-x-12 gap-y-10 rotate-[-20deg] select-none text-3xl font-extrabold uppercase tracking-[0.3em] text-white opacity-[0.04]">
            {Array.from({ length: 60 }).map((_, i) => (
              <span key={i}>Gyro Store</span>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          {/* Lockup de marca arriba */}
          <div className="login-enter-item flex items-center gap-3" style={itemDelay(0)}>
            <Logo size={48} withText textClassName="text-xl" />
          </div>

          {/* Centro: emblema grande (ancla visual) + propuesta de valor */}
          <div className="flex flex-1 flex-col justify-center">
            {/* Emblema: llena el vacío y da foco de marca; halo esmeralda + anillo. */}
            <div className="login-enter-item relative mb-8 w-fit" style={itemDelay(1)}>
              <span aria-hidden="true" className="absolute -inset-6 rounded-full bg-[#10b981]/30 blur-2xl" />
              <img
                src="/logo.jpg"
                alt=""
                width={128}
                height={128}
                className="relative rounded-full object-cover shadow-2xl ring-1 ring-white/20"
                style={{ width: 128, height: 128 }}
              />
            </div>
            <p
              className="login-enter-item inline-flex w-fit items-center gap-1.5 rounded-none border border-[#5eead4]/25 bg-[#5eead4]/10 px-3 py-1 text-xs font-medium text-[#5eead4]"
              style={itemDelay(2)}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Gyro Store
            </p>
            {/* Título decorativo grande (el <h1> semántico vive en la tarjeta). */}
            <p
              aria-hidden="true"
              className="login-enter-item mt-5 text-balance font-heading text-4xl font-extrabold leading-[1.1] text-white xl:text-5xl"
              style={itemDelay(3)}
            >
              Iniciar<br />Sesión
            </p>
            <p
              className="login-enter-item mt-4 max-w-sm text-pretty text-base leading-relaxed text-white/60"
              style={itemDelay(4)}
            >
              Accede a tu cuenta para gestionar tus pedidos y disfrutar de todos los servicios.
            </p>
          </div>

          {/* Pie: 3 beneficios minimalistas */}
          <ul className="login-enter-item flex flex-wrap gap-x-8 gap-y-4" style={itemDelay(5)}>
            {BENEFITS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 text-sm text-white/70">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#5eead4]/15 bg-[#5eead4]/10 text-[#5eead4]">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </motion.aside>

      {/* ── PANEL DERECHO · Formulario ────────────────────────────────────── */}
      <div className="relative flex min-h-screen items-center justify-center p-6 sm:p-10">
        {/* Aura tenue detrás de la tarjeta en desktop (da profundidad al panel). */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 hidden lg:block">
          <div className="absolute left-1/2 top-1/2 h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-[140px]" />
        </div>

        <motion.div
          variants={cardVariants}
          initial={false}
          animate={exiting ? "exit" : undefined}
          aria-busy={exiting}
          className={cn(
            "login-enter-rise relative z-10 w-full max-w-md rounded-card border border-white/10 bg-surface/70 p-7 shadow-premium backdrop-blur-xl sm:p-8",
            exiting && "pointer-events-none",
          )}
        >
          <a
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 rounded-lg text-sm text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al catálogo
          </a>

          {/* Cabecera de marca COMPACTA — protagonista en móvil, sr-only en desktop
              (allí el panel izquierdo ya muestra la identidad en grande). */}
          <h1 className="text-center font-heading text-2xl font-bold text-text lg:sr-only">
            Iniciar Sesión
          </h1>
          {greeting && (
            <p className="mt-1 text-center text-sm text-muted lg:hidden">
              {greeting.text} <span className="align-middle">{greeting.emoji}</span> — inicia sesión en Gyro Store.
            </p>
          )}

          {/* Email + contraseña */}
          <form onSubmit={handleSubmit((d) => run("email", d))} className="mt-7 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                Correo
              </label>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl border bg-surface px-3 transition-colors focus-within:ring-2 focus-within:ring-accent/15",
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
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
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
                  className="shrink-0 rounded-md p-1 text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
                  className="rounded text-xs text-muted transition-colors hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
      </div>
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
