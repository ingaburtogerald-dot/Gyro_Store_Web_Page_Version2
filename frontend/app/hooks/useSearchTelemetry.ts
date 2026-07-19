// Observa la búsqueda activa y la registra con DEBOUNCE cuando el usuario deja de
// teclear (~800ms). Así se captura la búsqueda "orgánica" sin loguear cada tecla ni
// quemar la cuota de Firestore. Se monta donde se conocen los resultados (ProductGrid)
// para poder enviar `resultsCount` — clave para el módulo de "búsquedas fallidas".
import { useEffect, useRef } from "react";
import { useAppSelector } from "~/store/hooks";
import { logSearch } from "~/lib/searchTelemetry";

const DEBOUNCE_MS = 800;

export function useSearchTelemetry(resultsCount: number) {
  const query = useAppSelector((s) => s.ui.search);
  // resultsCount cambia en cada render; lo leemos por ref para no reprogramar el
  // timer con cada cambio de conteo (solo el cambio de `query` reinicia el debounce).
  const countRef = useRef(resultsCount);
  countRef.current = resultsCount;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => logSearch(q, countRef.current), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);
}
