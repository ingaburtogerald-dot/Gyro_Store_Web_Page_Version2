// Telemetría del storefront (costo $0). Envía dos tipos de evento al server
// (POST /api/search-events → colección analytics_events):
//   · 'search'   → qué buscan los usuarios (con debounce, ver useSearchTelemetry).
//   · 'pageview' → qué páginas visitan (ver usePageviewTelemetry en root).
// Todo es FIRE-AND-FORGET: nunca bloquea ni rompe la UI si la red falla.
//
// CANDADO DE LOCALHOST: en desarrollo (localhost / 127.0.0.1) la telemetría se
// desactiva por completo, para que las pruebas locales NO ensucien los datos reales
// de Render. Solo se registran eventos desde el dominio real hospedado.

const SESSION_KEY = "gyro_analytics_sid";

// ¿Debe registrarse telemetría en este entorno? Falso en local/SSR.
function telemetryEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host !== "localhost" && host !== "127.0.0.1" && host !== "0.0.0.0" && host !== "::1";
}

// Id anónimo de sesión (sin PII). Vive en sessionStorage → uno nuevo por pestaña/visita.
function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "";
  }
}

function send(body: Record<string, unknown>): Promise<Response> {
  return fetch("/api/search-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, sessionId: getSessionId() }),
    keepalive: true,
  });
}

// ── Búsquedas ───────────────────────────────────────────────────────────────
// Términos ya registrados en esta sesión → evita duplicados. Guarda el id del
// evento que devuelve el server para poder marcar el clic (CTR) más tarde.
const loggedThisSession = new Map<string, string | null>(); // queryLower → eventId | null

/** Registra una búsqueda (una vez por término/sesión). No lanza si falla. */
export async function logSearch(query: string, resultsCount: number): Promise<void> {
  const q = query.trim();
  if (!telemetryEnabled() || q.length < 2) return;
  const key = q.toLowerCase();
  if (loggedThisSession.has(key)) return;
  loggedThisSession.set(key, null); // marca optimista para evitar registros en carrera

  try {
    const res = await send({ type: "search", query: q, resultsCount });
    const data = (await res.json().catch(() => null)) as { id?: string } | null;
    if (data?.id) loggedThisSession.set(key, data.id);
  } catch {
    loggedThisSession.delete(key); // best-effort: permite reintentar más tarde
  }
}

/** Marca qué producto abrió el usuario tras buscar `query` (CTR). No-op si esa
 *  búsqueda aún no tiene un id de evento asociado. */
export function logResultClick(query: string, productId: string): void {
  if (!telemetryEnabled()) return;
  const eventId = loggedThisSession.get(query.trim().toLowerCase());
  if (!eventId) return;
  fetch(`/api/search-events/${eventId}/click`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clickedProductId: productId }),
    keepalive: true,
  }).catch(() => {});
}

// ── Pageviews ───────────────────────────────────────────────────────────────
let lastPageviewPath: string | null = null;

/** Registra una visita a una página (tráfico real). Deduplica la misma ruta
 *  consecutiva para no contar doble por re-render. */
export function logPageview(page: string): void {
  if (!telemetryEnabled() || !page || page === lastPageviewPath) return;
  lastPageviewPath = page;
  send({ type: "pageview", page }).catch(() => {});
}
