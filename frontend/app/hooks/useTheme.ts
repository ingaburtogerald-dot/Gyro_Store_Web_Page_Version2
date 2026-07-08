// Tema visual de la app. Persiste en localStorage y se aplica como
// atributo data-theme en <html> (los tokens de color se sobre-escriben en CSS).
// El script anti-flash en root.tsx aplica el valor guardado antes del primer paint.
import { useCallback, useEffect, useState } from "react";

export type ThemeId = "dark" | "light";

export const THEMES: { id: ThemeId; label: string; dark: boolean; swatch: [string, string] }[] = [
  { id: "dark", label: "Modo Oscuro", dark: true, swatch: ["#0f1714", "#10b981"] },
  { id: "light", label: "Modo Claro", dark: false, swatch: ["#059669", "#34d399"] },
];

const STORAGE_KEY = "gyro-theme";
const DEFAULT_THEME: ThemeId = "dark";

function readStored(): ThemeId {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-theme") as ThemeId | null;
    if (attr) return attr;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (saved) return saved;
  } catch {
    /* noop */
  }
  return DEFAULT_THEME;
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  // Sincroniza con lo que ya aplicó el script anti-flash al montar.
  // Re-aplicamos el atributo por si React hydration lo elimina.
  useEffect(() => {
    const saved = readStored();
    setThemeState(saved);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", next);
    }
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* noop */
    }
  }, []);

  return { theme, setTheme };
}
