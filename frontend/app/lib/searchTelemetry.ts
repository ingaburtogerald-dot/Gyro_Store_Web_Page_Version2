// Telemetría del storefront (costo $0). Envía dos tipos de evento al server
// (POST /api/search-events → colección analytics_events):
//   · 'search'   → qué buscan los usuarios (con debounce, ver useSearchTelemetry).
//   · 'pageview' → qué páginas visitan (ver usePageviewTelemetry en root).
// Todo es FIRE-AND-FORGET: nunca bloquea ni rompe la UI si la red falla.
//
// CANDADO DE LOCALHOST: en desarrollo (localhost / 127.0.0.1) la telemetría se
// desactiva por completo, para que las pruebas locales NO ensucien los datos reales
// de Render. Solo se registran eventos desde el dominio real hospedado.

const VISITOR_KEY = "gyro_analytics_vid";

function telemetryEnabled(): boolean {
  if (typeof window === "undefined") return false; // Bloquea en SSR
  const host = window.location.hostname;
  
  // Bloquear localhost y cualquier IP (ej. 192.168.x.x o 10.x.x.x para pruebas locales)
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1" || /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(host);
  return !isLocal;
}

// Id anónimo de visitante (sin PII). Vive en localStorage → persiste entre sesiones/días.
function getVisitorId(): string {
  try {
    let vid = localStorage.getItem(VISITOR_KEY);
    if (!vid) {
      vid = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(VISITOR_KEY, vid);
      localStorage.setItem(VISITOR_KEY + "_first", Date.now().toString());
    }
    return vid;
  } catch {
    return "";
  }
}

function send(body: Record<string, unknown>): Promise<Response> {
  const payload = { ...body, visitorId: getVisitorId() };
  
  if (!telemetryEnabled()) {
    if (typeof window !== "undefined") {
      console.log("[Telemetry Bloqueado en Localhost]", payload);
    }
    return Promise.resolve(new Response(JSON.stringify({ ok: true, skipped: true })));
  }

  return fetch("/api/search-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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
  if (typeof window === "undefined" || q.length < 2) return;
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
  if (typeof window === "undefined") return;
  const eventId = loggedThisSession.get(query.trim().toLowerCase());
  if (!eventId) return;

  if (!telemetryEnabled()) {
    console.log("[Telemetry Click Bloqueado]", { clickedProductId: productId });
    return;
  }

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
 *  consecutiva para no contar doble por re-render.
 *  Captura origen de tráfico y tipo de entrada en el primer pageview de la SPA. */
export function logPageview(page: string): void {
  if (typeof window === "undefined" || !page || page === lastPageviewPath) return;
  
  const isFirstPageview = lastPageviewPath === null;
  const entryType = isFirstPageview ? "direct_landing" : "internal_click";
  
  const firstVisitAt = parseInt(localStorage.getItem(VISITOR_KEY + "_first") || "0", 10);
  const isNewVisitor = firstVisitAt ? (Date.now() - firstVisitAt < 24 * 60 * 60 * 1000) : true;
  
  const payload: Record<string, unknown> = { type: "pageview", page, entryType, isNewVisitor };

  if (isFirstPageview) {
    payload.referrer = document.referrer || "";
    const params = new URLSearchParams(window.location.search);
    payload.utmSource = params.get("utm_source") || "";
    payload.utmMedium = params.get("utm_medium") || "";
    payload.utmCampaign = params.get("utm_campaign") || "";
  }

  lastPageviewPath = page;
  send(payload).catch(() => {});
}
