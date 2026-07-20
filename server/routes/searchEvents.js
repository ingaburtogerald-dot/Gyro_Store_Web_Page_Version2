// Telemetría dual del storefront (costo $0). Registra en Firestore (colección
// analytics_events) dos tipos de evento:
//   · type:'search'   → qué buscan los usuarios (query + nº de resultados).
//   · type:'pageview' → qué páginas visitan (tráfico real).
//
// La escritura es PÚBLICA y fire-and-forget: el cliente la llama sin esperar. Va
// detrás de `telemetryLimiter` (además del apiLimiter global) para acotar escrituras
// por IP. El cliente ADEMÁS bloquea el envío en localhost (ver searchTelemetry.ts),
// así que las pruebas locales no ensucian los datos reales. La lectura agregada del
// dashboard exige rol admin.
const router = require('express').Router();
const crypto = require('crypto');
const { db, FieldValue, Timestamp } = require('../firebase');
const config = require('../config');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAdmin } = require('../middleware/auth');
const { telemetryLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

const COL = config.collections.analyticsEvents;
const MAX_QUERY_LEN = 120;
const MAX_ID_LEN = 80;
const MAX_PAGE_LEN = 200;
const ANALYTICS_CAP = 8000; // tope de docs por consulta de analíticas (acota lecturas)
const DEFAULT_DAYS = 30;
const TOP_LIMIT = 20;

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (date) => date.toISOString().slice(0, 10); // "AAAA-MM-DD" en UTC

// ── Deduplicación de pageviews (evita contar recargas como visitas nuevas) ──
// Ventana deslizante de 30 min en memoria (proceso único en Render, ver server/index.js).
// Clave preferida: sessionId (sessionStorage del cliente) + page — identifica la
// pestaña real y evita el problema de IP compartida (CGNAT/redes móviles/oficina)
// que colapsaría visitas de personas distintas. Si el cliente no manda sessionId
// (bloqueado, bot), se usa IP + page como respaldo. `req.ip` ya resuelve la IP real
// del cliente gracias a `app.set('trust proxy', 1)` en server/index.js.
const PAGEVIEW_DEDUPE_WINDOW_MS = 30 * 60 * 1000;
const PAGEVIEW_DEDUPE_CLEANUP_MS = 10 * 60 * 1000;
const recentPageviews = new Map(); // clave → timestamp (ms) de expiración

// Purga periódica en vez de un setTimeout por clave: evita acumular miles de
// temporizadores activos bajo tráfico alto.
setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of recentPageviews) {
    if (expiresAt <= now) recentPageviews.delete(key);
  }
}, PAGEVIEW_DEDUPE_CLEANUP_MS).unref();

function pageviewDedupeKey(req, sessionId, page) {
  return sessionId ? `sid:${sessionId}:${page}` : `ip:${req.ip}:${page}`;
}

// true si esta (sesión|IP) ya visitó `page` dentro de los últimos 30 min. Cada hit
// (nuevo o repetido) reinicia la ventana — es una expiración deslizante, no fija.
function isDuplicatePageview(req, sessionId, page) {
  const key = pageviewDedupeKey(req, sessionId, page);
  const now = Date.now();
  const expiresAt = recentPageviews.get(key);
  const isDuplicate = Boolean(expiresAt && expiresAt > now);
  recentPageviews.set(key, now + PAGEVIEW_DEDUPE_WINDOW_MS);
  return isDuplicate;
}

// Extrae el id de producto de una ruta de ficha: "/producto/<slug>--<id>".
function productIdFromPage(page) {
  if (!page || !page.startsWith('/producto/')) return null;
  const raw = page.slice('/producto/'.length).split(/[?#]/)[0];
  const id = raw.split('--').pop();
  return id || null;
}

// ── Caché de "populares" (GET /popular, público) ──
// Se sirve en el home (y en el header, para el panel del buscador) a CADA
// visitante, así que se cachea 1h en memoria para no gastar una lectura de
// Firestore por carga de página (proceso único en Render).
const POPULAR_LIMIT = 12;
const POPULAR_TERMS_LIMIT = 8;
const POPULAR_DAYS = 30;
const POPULAR_CACHE_TTL_MS = 60 * 60 * 1000;
let popularCache = { data: null, timestamp: 0 };

// Popularidad de PRODUCTOS = vistas de ficha (pageview a /producto/:id) + clics
// desde búsqueda, sumados. Popularidad de TÉRMINOS = búsquedas reales agrupadas
// case-insensitive (mismo criterio que /analytics). Un solo snapshot de Firestore
// alimenta ambos rankings — el panel de búsqueda del header no cuesta una lectura
// aparte.
async function computePopularData() {
  const cutoff = Timestamp.fromMillis(Date.now() - POPULAR_DAYS * DAY_MS);
  const snap = await db
    .collection(COL)
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'desc')
    .limit(ANALYTICS_CAP)
    .get();

  const scoreByProduct = new Map();
  const bump = (id) => id && scoreByProduct.set(id, (scoreByProduct.get(id) || 0) + 1);
  const termByLower = new Map(); // queryLower → { query, count }

  snap.forEach((doc) => {
    const d = doc.data();
    if (d.deviceType === 'Bot') return; // ignora basura ya almacenada (bots/crawlers)
    if (d.type === 'pageview') {
      bump(productIdFromPage(d.page));
      return;
    }
    if (d.clickedProductId) bump(d.clickedProductId);

    // type === 'search': agrega el término (case-insensitive, conserva el casing
    // original más reciente para mostrarlo bonito en el panel).
    const q = d.queryLower || String(d.query || '').toLowerCase();
    if (q) {
      const entry = termByLower.get(q) || { query: d.query || q, count: 0 };
      entry.count++;
      termByLower.set(q, entry);
    }
  });

  const productIds = [...scoreByProduct.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, POPULAR_LIMIT)
    .map(([productId]) => productId);

  const terms = [...termByLower.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, POPULAR_TERMS_LIMIT)
    .map((e) => e.query);

  return { productIds, terms };
}

// POST /api/search-events
// Body búsqueda:  { type:'search', query, resultsCount, sessionId? }
// Body pageview:  { type:'pageview', page, sessionId? }
// Devuelve { id } (útil para marcar el clic de un resultado más tarde — CTR).
router.post('/', telemetryLimiter, asyncHandler(async (req, res) => {
  // --- BLINDAJE Y DEFENSIVE PROGRAMMING ---
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const clientIp = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  
  // Rechazar tráfico local
  if (
    origin.includes('localhost') || origin.includes('127.0.0.1') ||
    referer.includes('localhost') || referer.includes('127.0.0.1') ||
    clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.includes('::ffff:127.0.0.1')
  ) {
    return res.json({ ok: true, skipped: true });
  }

  const type = req.body?.type === 'pageview' ? 'pageview' : 'search';
  const rawSessionId = String(req.body?.visitorId ?? req.body?.sessionId ?? '').slice(0, 64) || null;
  const rawUserAgent = String(req.headers['user-agent'] || '');
  const userAgent = rawUserAgent.slice(0, 200);

  // Análisis del User-Agent. Un UA vacío o mínimo (<10 chars) es señal fuerte de
  // script/bot: TODO navegador real manda un UA largo. Además de los crawlers y
  // clientes de vista previa (WhatsApp/Facebook), se descartan clientes headless
  // y herramientas de scripting (curl/wget/python/axios/node).
  const isBot =
    rawUserAgent.trim().length < 10 ||
    /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|google|bing|yandex|lighthouse|headless|preview|python|curl|wget|axios|node-fetch|okhttp/i.test(rawUserAgent);
  const isMobile = /mobile|android|iphone|ipad|ipod|windows phone/i.test(userAgent);
  const deviceType = isBot ? 'Bot' : (isMobile ? 'Mobile' : 'Desktop');

  // Barrera anti-basura: los bots/crawlers/link-preview y los clientes sin UA NO son
  // visitas orgánicas reales — solo ensuciarían las analíticas e inflarían "Visitas".
  // Se descartan aquí, ANTES de escribir en Firestore (no gastan una escritura).
  if (isBot) return res.json({ ok: true, skipped: true });

  // Resolución de identidad (Fallback a IP Hash)
  const sessionId = rawSessionId && rawSessionId !== 'Desconocido'
    ? rawSessionId
    : `ip-${crypto.createHash('sha256').update(clientIp || 'unknown').digest('hex').slice(0, 16)}`;

  if (type === 'pageview') {
    const page = String(req.body?.page ?? '').trim().slice(0, MAX_PAGE_LEN);
    if (!page.startsWith('/')) return res.json({ ok: true, skipped: true });
    if (page === '/') return res.json({ ok: true, skipped: true });

    // Recarga/reingreso a la misma página dentro de los 30 min → no ensucia Firestore.
    if (isDuplicatePageview(req, sessionId, page)) return res.json({ ok: true, skipped: true });

    const ref = await db.collection(COL).add({
      type: 'pageview',
      page,
      sessionId,
      ip: clientIp,
      deviceType,
      userAgent,
      entryType: req.body?.entryType || null,
      isNewVisitor: req.body?.isNewVisitor ?? null,
      referrer: req.body?.referrer || null,
      utmSource: req.body?.utmSource || null,
      utmMedium: req.body?.utmMedium || null,
      utmCampaign: req.body?.utmCampaign || null,
      timestamp: FieldValue.serverTimestamp(),
    });
    return res.json({ ok: true, id: ref.id });
  }

  // type === 'search'
  const query = String(req.body?.query ?? '').trim().slice(0, MAX_QUERY_LEN);
  const rawCount = Number(req.body?.resultsCount);
  const resultsCount = Number.isFinite(rawCount) ? Math.max(0, Math.floor(rawCount)) : 0;

  // Ignora ruido: consultas vacías o de una sola letra no aportan a las analíticas.
  if (query.length < 2) return res.json({ ok: true, skipped: true });

  const ref = await db.collection(COL).add({
    type: 'search',
    query,
    queryLower: query.toLowerCase(), // clave de agregación case-insensitive
    resultsCount,
    clickedProductId: null,
    sessionId,
    ip: clientIp,
    deviceType,
    userAgent,
    timestamp: FieldValue.serverTimestamp(),
  });
  res.json({ ok: true, id: ref.id });
}));


// POST /api/search-events/:id/click
// Marca qué producto abrió el usuario tras esa búsqueda (CTR).
router.post('/:id/click', telemetryLimiter, asyncHandler(async (req, res) => {
  const clickedProductId = String(req.body?.clickedProductId ?? '').slice(0, MAX_ID_LEN);
  if (!clickedProductId) return res.status(400).json({ error: 'Falta clickedProductId.' });

  // merge:true → no pisa el resto del documento; si el id no existe, lo crea vacío
  // con solo este campo (aceptable: es telemetría best-effort, no dato crítico).
  await db.collection(COL).doc(req.params.id).set({ clickedProductId }, { merge: true });
  res.json({ ok: true });
}));

// GET /api/search-events/popular  (público — lo consume el home vía SSR y el
// panel de búsqueda del header vía RTK Query)
// Devuelve hasta 12 ids de producto y hasta 8 términos de búsqueda, ambos
// ordenados por popularidad real (30 días). Cacheado 1h en memoria: bajo
// tráfico normal, ningún visitante dispara una lectura de Firestore.
router.get('/popular', asyncHandler(async (req, res) => {
  const now = Date.now();
  if (popularCache.data && now - popularCache.timestamp < POPULAR_CACHE_TTL_MS) {
    return res.json({ ok: true, ...popularCache.data, cached: true });
  }

  try {
    const data = await computePopularData();
    popularCache = { data, timestamp: now };
    return res.json({ ok: true, ...data, cached: false });
  } catch (err) {
    // Best-effort: si Firestore falla, sirve caché vencida antes que romper el home.
    if (popularCache.data) return res.json({ ok: true, ...popularCache.data, cached: true, stale: true });
    logger.error('popular_products_failed', { message: err.message });
    return res.json({ ok: true, productIds: [], terms: [] });
  }
}));

// GET /api/search-events/analytics?days=30  (SOLO admin)
// Lee los eventos recientes (con tope) y los agrega EN MEMORIA para el dashboard.
// `where(timestamp>=)` + `orderBy(timestamp)` usan el índice de un solo campo
// (automático): no requiere índice compuesto.
router.get('/analytics', requireAdmin, asyncHandler(async (req, res) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || DEFAULT_DAYS));
  const cutoff = Timestamp.fromMillis(Date.now() - days * DAY_MS);

  const snap = await db
    .collection(COL)
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'desc')
    .limit(ANALYTICS_CAP)
    .get();

  const byTerm = new Map(); // queryLower → { query, count, lastResults }
  const clicksByProduct = new Map(); // productId → clics desde búsqueda (CTR)
  const viewsByProduct = new Map(); // productId → nº de visitas a su ficha (tráfico)
  const searchesByDay = new Map(); // "AAAA-MM-DD" → nº de búsquedas
  const visitsByDay = new Map(); // "AAAA-MM-DD" → nº de pageviews
  let searchCount = 0;
  let pageviewCount = 0;

  snap.forEach((doc) => {
    const d = doc.data();
    if (d.deviceType === 'Bot') return; // ignora basura ya almacenada (bots/crawlers)
    const when = d.timestamp && d.timestamp.toDate ? d.timestamp.toDate() : null;
    const key = when ? dayKey(when) : null;

    if (d.type === 'pageview') {
      pageviewCount++;
      if (key) visitsByDay.set(key, (visitsByDay.get(key) || 0) + 1);
      const pid = productIdFromPage(d.page);
      if (pid) viewsByProduct.set(pid, (viewsByProduct.get(pid) || 0) + 1);
      return;
    }

    // type === 'search' (o legado sin type)
    searchCount++;
    if (key) searchesByDay.set(key, (searchesByDay.get(key) || 0) + 1);
    const q = d.queryLower || String(d.query || '').toLowerCase();
    if (q) {
      const entry = byTerm.get(q) || { query: d.query || q, count: 0, lastResults: null };
      entry.count++;
      // Docs en orden desc → el primero de cada término fija su nº de resultados actual.
      if (entry.lastResults === null && typeof d.resultsCount === 'number') entry.lastResults = d.resultsCount;
      byTerm.set(q, entry);
    }
    if (d.clickedProductId) {
      clicksByProduct.set(d.clickedProductId, (clicksByProduct.get(d.clickedProductId) || 0) + 1);
    }
  });

  const terms = [...byTerm.values()];
  const topSearches = [...terms]
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_LIMIT)
    .map((e) => ({ query: e.query, count: e.count, results: e.lastResults ?? 0 }));

  const zeroResultSearches = terms
    .filter((e) => (e.lastResults ?? 0) === 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_LIMIT)
    .map((e) => ({ query: e.query, count: e.count }));

  const topClickedProducts = [...clicksByProduct.entries()]
    .map(([productId, clicks]) => ({ productId, clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, TOP_LIMIT);

  // Tráfico por artículo (visitas a la ficha). El dashboard resuelve el nombre con
  // el catálogo que ya tiene en caché (aquí solo id + visitas).
  const trafficByProduct = [...viewsByProduct.entries()]
    .map(([productId, views]) => ({ productId, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, TOP_LIMIT);

  // Serie temporal continua (visitas vs búsquedas por día) para el gráfico de líneas.
  const timeseries = [];
  const startDay = Date.now() - (days - 1) * DAY_MS;
  for (let i = 0; i < days; i++) {
    const k = dayKey(new Date(startDay + i * DAY_MS));
    timeseries.push({ day: k, visits: visitsByDay.get(k) || 0, searches: searchesByDay.get(k) || 0 });
  }

  res.json({
    range: { days },
    totals: {
      events: snap.size,
      searches: searchCount,
      pageviews: pageviewCount,
      uniqueTerms: terms.length,
      zeroResultTerms: zeroResultSearches.length,
      capped: snap.size >= ANALYTICS_CAP, // aviso: hay más datos de los leídos
    },
    timeseries,
    topSearches,
    zeroResultSearches,
    topClickedProducts,
    trafficByProduct,
  });
}));

// GET /api/search-events/sessions?days=30  (SOLO admin)
router.get('/sessions', requireAdmin, asyncHandler(async (req, res) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || DEFAULT_DAYS));
  const cutoff = Timestamp.fromMillis(Date.now() - days * DAY_MS);

  // Consultar últimos eventos (cap 3000 para no reventar memoria)
  const snap = await db
    .collection(COL)
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'desc')
    .limit(3000)
    .get();

  const sessionsMap = new Map();

  snap.forEach((doc) => {
    const d = doc.data();
    if (d.deviceType === 'Bot') return; // no muestra sesiones de bots/crawlers
    // Resolución retroactiva para eventos antiguos sin ID
    const sessionId = (d.sessionId && d.sessionId !== 'Desconocido')
      ? d.sessionId 
      : (d.ip ? `ip-${crypto.createHash('sha256').update(d.ip).digest('hex').slice(0, 16)}` : 'Desconocido');
    
    if (!sessionsMap.has(sessionId)) {
      sessionsMap.set(sessionId, {
        id: sessionId,
        userAgent: d.userAgent || 'Desconocido',
        startTime: null,
        entryType: null,
        isNewVisitor: null,
        referrer: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        actions: []
      });
    }

    const session = sessionsMap.get(sessionId);
    
    // Al iterar en orden desc (más nuevo primero), sobreescribir nos garantiza 
    // quedarnos con el valor del evento más antiguo (el inicio de la sesión/visita).
    if (d.entryType) session.entryType = d.entryType;
    if (d.referrer) session.referrer = d.referrer;
    if (d.utmSource) session.utmSource = d.utmSource;
    if (d.utmMedium) session.utmMedium = d.utmMedium;
    if (d.utmCampaign) session.utmCampaign = d.utmCampaign;
    if (d.isNewVisitor !== undefined && d.isNewVisitor !== null) session.isNewVisitor = d.isNewVisitor;
    const time = d.timestamp && d.timestamp.toDate ? d.timestamp.toDate().toISOString() : new Date().toISOString();
    
    if (!session.startTime || time < session.startTime) {
      session.startTime = time; // El más antiguo de la sesión
    }

    if (d.type === 'pageview') {
      session.actions.push({ type: 'pageview', page: d.page, timestamp: time });
    } else {
      session.actions.push({ type: 'search', query: d.query, resultsCount: d.resultsCount, clickedProductId: d.clickedProductId, timestamp: time });
    }
  });

  const sessions = [...sessionsMap.values()];
  
  // Ordenar eventos dentro de cada sesión cronológicamente (más antiguo primero)
  sessions.forEach(s => {
    s.actions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  });

  // Ordenar sesiones por el evento más reciente (de más nuevo a más viejo global)
  sessions.sort((a, b) => {
    const lastA = a.actions.length > 0 ? a.actions[a.actions.length - 1].timestamp : a.startTime;
    const lastB = b.actions.length > 0 ? b.actions[b.actions.length - 1].timestamp : b.startTime;
    return new Date(lastB) - new Date(lastA);
  });

  res.json({ ok: true, sessions });
}));

// GET /api/search-events/raw-searches?days=30 (SOLO admin)
router.get('/raw-searches', requireAdmin, asyncHandler(async (req, res) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || DEFAULT_DAYS));
  const cutoff = Timestamp.fromMillis(Date.now() - days * DAY_MS);

  const snap = await db
    .collection(COL)
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'desc')
    .limit(1500)
    .get();

  const searches = [];
  snap.forEach(doc => {
    const d = doc.data();
    if (d.type !== 'search') return;
    if (d.deviceType === 'Bot') return; // no muestra búsquedas de bots/crawlers

    searches.push({
      id: doc.id,
      query: d.query || '',
      resultsCount: d.resultsCount || 0,
      clickedProductId: d.clickedProductId || null,
      timestamp: d.timestamp && d.timestamp.toDate ? d.timestamp.toDate().toISOString() : new Date().toISOString(),
      ip: d.ip || 'Desconocido',
      deviceType: d.deviceType || 'Desktop',
    });
  });

  res.json({ ok: true, searches });
}));

module.exports = router;
