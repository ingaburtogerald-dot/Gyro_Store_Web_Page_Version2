import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { toast } from "sonner";
import {
  Mail, Lock, ArrowLeft, ArrowRight, Eye, EyeOff, CheckCircle2, AlertTriangle,
  KeyRound, MessageCircle, Sunrise, Sun, Moon, Loader2,
} from "lucide-react";
import { Logo } from "~/components/ui/Logo";
import { cn, buildWhatsappUrl } from "~/lib/utils";
import { useAuth } from "~/hooks/useAuth";
import { GoogleStrategy, MicrosoftStrategy, EmailStrategy } from "~/lib/authStrategies";
import { loginSchema, type LoginInput } from "~/lib/validators";
import { roleLandingPath, type Role, WHATSAPP_NUMBER } from "~/lib/constants";

export const meta: MetaFunction = () => [{ title: "Iniciar Sesión · Gyro Store" }];

// Video de fondo del login (alojado en Cloudflare R2, bucket público). Se reproduce
// en bucle, silenciado y sin controles. Si el navegador no lo carga, el fondo negro
// del <main> queda de respaldo.
const LOGIN_BG_VIDEO = "https://pub-e5292366f3c04eb1a93d9a0b38928540.r2.dev/site/login/background.webm";

// Curva de salida exponencial (mismo lenguaje de motion que el resto de la app).
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_IN = [0.7, 0, 0.84, 0] as const;
// Duración de la animación de salida antes de navegar al dashboard.
const EXIT_MS = 520;


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
  const [greeting, setGreeting] = useState<{ text: string; icon: "sunrise" | "sun" | "moon" } | null>(null);
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

  // ── Variant de SALIDA (Framer) ─────────────────────────────────────────
  // La ENTRADA es CSS puro (clases login-enter-*, ver globals.css): robusta ante
  // fallo de JS y sin parpadeo. Framer solo orquesta la salida calmada al dashboard.
  const cardVariants: Variants = {
    exit: { opacity: 0, scale: reduce ? 1 : 0.98, y: reduce ? 0 : -8, transition: { duration: 0.42, ease: EASE_IN } },
  };
  // Delay escalonado para el wordmark + encabezado (entrada CSS).
  const itemDelay = (i: number): React.CSSProperties =>
    reduce ? {} : { animationDelay: `${0.1 + i * 0.07}s` };

  // Ícono del saludo (sin emojis; DESIGN.md §8).
  const GreetIcon = greeting?.icon === "sunrise" ? Sunrise : greeting?.icon === "moon" ? Moon : Sun;

  return (
    <main
      data-skin="store"
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black p-4 sm:p-6 lg:p-8"
    >
      {/* Fondo en video (Cloudflare R2): autoplay silenciado en bucle. Si el
          navegador no puede reproducirlo, el fondo negro del <main> es el respaldo. */}
      <video
        className="absolute inset-0 z-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden
      >
        <source src={LOGIN_BG_VIDEO} type="video/webm" />
      </video>

      {/* Scrim: oscurece el fondo y aplica una viñeta radial que enfoca el centro,
          para que la tarjeta resalte sin que el video compita. */}
      <div aria-hidden className="absolute inset-0 z-0 bg-black/45" />
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_38%,rgba(0,0,0,0.6)_100%)]"
      />

      {/* Line-art hairline en los márgenes (evoca las ondas de las referencias,
          pero es hairline esmeralda muy tenue, no glow → DESIGN.md §6). */}
      <DecorWaves />

      {/* Volver al catálogo: con fondo cristal para no perderse en la nueva imagen y animado. */}
      <motion.a
        href="/"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="group absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-bg shadow-lg shadow-accent/20 transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 sm:left-16 sm:top-8"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
        Volver al catálogo
      </motion.a>

      {/* Tarjeta split que flota sobre el fondo (marco + hairline + sombra neutra). */}
      <motion.div
        variants={cardVariants}
        initial={false}
        animate={exiting ? "exit" : undefined}
        aria-busy={exiting}
        className={cn(
          "login-enter-rise relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_30px_90px_-30px_rgba(0,0,0,0.75)] lg:min-h-[600px] lg:grid-cols-2",
          exiting && "pointer-events-none",
        )}
      >
        {/* ── PANEL FORMULARIO ──────────────────────────────────────────────── */}
        <div className="order-2 flex flex-col justify-center p-7 sm:p-10 lg:order-1 lg:p-14">
          <div className="mx-auto w-full max-w-sm">
            {/* Marca (visible solo en móvil) + encabezado con jerarquía. */}
            <div className="login-enter-item" style={itemDelay(0)}>
              <Logo size={50} className="lg:hidden object-contain" />
              <h1 className="mt-6 font-heading text-3xl font-extrabold tracking-tight text-text">
                Iniciar sesión
              </h1>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted">
                {greeting && <GreetIcon className="h-4 w-4 text-accent-2" aria-hidden />}
                {greeting ? `${greeting.text} — t` : "T"}e damos la bienvenida, ingresa tus datos
              </p>
            </div>

          {/* Email + contraseña */}
          <form onSubmit={handleSubmit((d) => run("email", d))} className="login-enter-item mt-8 space-y-4" style={itemDelay(1)}>
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
                  className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted"
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
                  className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted"
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

            <AnimatedPrimary type="submit" loading={busy === "email"} reduce={!!reduce}>
              Iniciar sesión
            </AnimatedPrimary>
          </form>

          {/* Separador */}
          <div className="login-enter-item my-6 flex items-center gap-3 text-xs text-muted" style={itemDelay(2)}>
            <span className="h-px flex-1 bg-border" /> o continúa con <span className="h-px flex-1 bg-border" />
          </div>

          {/* Proveedores externos */}
          <div className="login-enter-item grid grid-cols-2 gap-3" style={itemDelay(3)}>
            <SocialButton
              loading={busy === "google"}
              onClick={() => run("google")}
              reduce={!!reduce}
              icon={<GoogleIcon className="h-4 w-4" />}
              label="Google"
              hoverClass="hover:border-[#4285F4]/60 hover:bg-[#4285F4]/5"
            />
            {/* Hotmail/Outlook usa la estrategia de Microsoft por debajo (mismo OAuth que valida @hotmail/@outlook). */}
            <SocialButton
              loading={busy === "microsoft"}
              onClick={() => run("microsoft")}
              reduce={!!reduce}
              icon={<OutlookIcon className="h-4 w-4" />}
              label="Hotmail"
              hoverClass="hover:border-[#0078D4]/60 hover:bg-[#0078D4]/5"
            />
          </div>

            <p className="mt-4 text-center text-xs text-muted">
              Aceptamos cuentas <span className="text-text">@gmail</span>,{" "}
              <span className="text-text">@hotmail</span> y <span className="text-text">@outlook</span>.
            </p>
          </div>
        </div>

        {/* ── PANEL VISUAL · Marca (solo desktop) ──────────────────── */}
        <div className="relative order-1 hidden flex-col items-center justify-center overflow-hidden bg-black lg:order-2 lg:flex">
          {/* Logo principal centrado (obtenido de la config del admin automáticamente por el componente Logo) */}
          <div className="relative z-10 flex flex-1 items-center justify-center p-12 w-full max-w-lg mx-auto">
            <Logo size={90} className="w-full max-w-[280px] object-contain" />
          </div>

          {/* Declaración de marca al pie (sin el logo circular). */}
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/80 to-transparent p-12 pt-32">
            <p className="text-balance font-heading text-3xl font-extrabold leading-tight text-white">
              Acceso a Colaboradores
            </p>
            <p className="mt-3 max-w-md text-base font-light leading-relaxed text-white/70">
              Accede al centro de administración para la gestión de Gyro Store.
            </p>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

// Saludo según la franja horaria del navegador. Devuelve una clave de ícono lucide
// (no emoji; DESIGN.md §8) que el componente mapea a Sunrise/Sun/Moon.
function getGreeting(): { text: string; icon: "sunrise" | "sun" | "moon" } {
  const h = new Date().getHours();
  if (h < 12) return { text: "Buenos días", icon: "sunrise" };
  if (h < 19) return { text: "Buenas tardes", icon: "sun" };
  return { text: "Buenas noches", icon: "moon" };
}

// CTA primaria premium: relleno esmeralda con barrido de brillo (sheen) en hover,
// flecha que se desliza y press táctil con spring (solo tacto; DESIGN.md §5). El
// sheen se apaga con prefers-reduced-motion. Es <button> nativo → sirve de submit.
function AnimatedPrimary({
  children,
  loading,
  reduce,
  type = "button",
  onClick,
}: {
  children: React.ReactNode;
  loading?: boolean;
  reduce: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={loading}
      whileTap={reduce || loading ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      className="group relative w-full overflow-hidden rounded-lg bg-gradient-to-b from-accent to-accent-hover px-5 py-3 text-sm font-semibold text-bg shadow-md shadow-accent/20 transition-shadow duration-300 hover:shadow-lg hover:shadow-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {/* Barrido de brillo que cruza en hover. */}
      {!reduce && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
        />
      )}
      <span className="relative flex items-center justify-center gap-2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {children}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </>
        )}
      </span>
    </motion.button>
  );
}

// Botón social: hairline que se aclara + ícono con pop sutil en hover + press táctil.
function SocialButton({
  icon,
  label,
  loading,
  reduce,
  onClick,
  hoverClass,
}: {
  icon: React.ReactNode;
  label: string;
  loading?: boolean;
  reduce: boolean;
  onClick?: () => void;
  hoverClass?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={loading}
      whileTap={reduce || loading ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      className={cn(
        "group flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-2/40 px-4 py-2.5 text-sm font-medium text-text transition-colors hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60 disabled:cursor-not-allowed",
        hoverClass,
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <span className={cn("inline-flex transition-transform duration-200", !reduce && "group-hover:scale-110")}>
          {icon}
        </span>
      )}
      {label}
    </motion.button>
  );
}

// Line-art decorativo de fondo: dos trazos hairline esmeralda muy tenues en esquinas
// opuestas (evocan las ondas de las referencias sin caer en glow). Puramente estético.
function DecorWaves() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden text-accent/[0.06]">
      <svg className="absolute -left-24 -top-24 h-[520px] w-[520px]" viewBox="0 0 400 400" fill="none">
        <circle cx="200" cy="200" r="150" stroke="currentColor" strokeWidth="1" />
        <circle cx="200" cy="200" r="110" stroke="currentColor" strokeWidth="1" />
        <circle cx="200" cy="200" r="70" stroke="currentColor" strokeWidth="1" />
      </svg>
      <svg className="absolute -bottom-32 -right-24 h-[560px] w-[560px]" viewBox="0 0 400 400" fill="none">
        <path d="M0 300 Q100 220 200 300 T400 300" stroke="currentColor" strokeWidth="1" />
        <path d="M0 340 Q100 260 200 340 T400 340" stroke="currentColor" strokeWidth="1" />
      </svg>
    </div>
  );
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
