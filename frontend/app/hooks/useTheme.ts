// Tema visual de la app. BLOQUEADO EN MODO OSCURO: el modo claro se retiró por
// completo (hasta nuevo aviso) porque daba problemas creativos. `data-theme` se fija
// siempre en "dark" y `setTheme` es un no-op — se conserva la firma del hook para no
// romper a los componentes que aún lo consumen.
import { useEffect } from "react";

export type ThemeId = "dark";

export const THEMES: { id: ThemeId; label: string; dark: boolean; swatch: [string, string] }[] = [
  { id: "dark", label: "Modo Oscuro", dark: true, swatch: ["#0f1714", "#10b981"] },
];

const DEFAULT_THEME: ThemeId = "dark";

export function useTheme() {
  // Fija el atributo en oscuro por si el script anti-flash o React lo alteran.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  // setTheme se mantiene por compatibilidad de firma, pero solo hay un tema.
  const setTheme = (_next?: ThemeId) => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  };

  return { theme: DEFAULT_THEME, setTheme };
}
