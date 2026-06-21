import { useState } from "react";
import { useNavigate, useSearchParams } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Mail, Lock, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { Logo } from "~/components/ui/Logo";
import { useAuth } from "~/hooks/useAuth";
import { GoogleStrategy, MicrosoftStrategy, EmailStrategy } from "~/lib/authStrategies";
import { loginSchema, type LoginInput } from "~/lib/validators";
import { roleLandingPath, type Role } from "~/lib/constants";

export const meta: MetaFunction = () => [{ title: "Acceso Colaboradores · Gyro Store" }];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Página desde donde se inició el login (la dejó el header/footer o RequireRole).
  const redirectTo = searchParams.get("redirectTo");
  const [busy, setBusy] = useState<null | "google" | "microsoft" | "email">(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

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
          <Logo size={88} className="mb-3 drop-shadow-[0_0_25px_rgba(124,131,255,0.35)]" />
          <h1 className="text-2xl font-bold">Acceso Colaboradores</h1>
          <p className="mt-1 text-sm text-muted">Inicia sesión para gestionar Gyro Store.</p>
        </div>

        {/* Email + contraseña */}
        <form onSubmit={handleSubmit((d) => run("email", d))} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Correo
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-accent">
              <Mail className="h-4 w-4 text-muted" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="tu@gyrostore.com"
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted"
                {...register("email")}
              />
            </div>
            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
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
              <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>

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
          <Button variant="outline" loading={busy === "google"} onClick={() => run("google")}>
            Google
          </Button>
          <Button variant="outline" loading={busy === "microsoft"} onClick={() => run("microsoft")}>
            Microsoft
          </Button>
        </div>
      </motion.div>
    </main>
  );
}
