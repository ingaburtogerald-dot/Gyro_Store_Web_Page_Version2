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
const { db, FieldValue, Timestamp } = require('../firebase');
const config = require('../config');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAdmin } = require('../middleware/auth');

const COL = config.collections.analyticsEvents;
const MAX_QUERY_LEN = 120;
const MAX_ID_LEN = 80;
const MAX_PAGE_LEN = 200;
const ANALYTICS_CAP = 8000; // tope de docs por consulta de analíticas (acota lecturas)
const DEFAULT_DAYS = 30;
const TOP_LIMIT = 20;

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (date) => date.toISOString().slice(0, 10); // "AAAA-MM-DD" en UTC

// Extrae el id de producto de una ruta de ficha: "/producto/<slug>--<id>".
function productIdFromPage(page) {
  if (!page || !page.startsWith('/producto/')) return null;
  const raw = page.slice('/producto/'.length).split(/[?#]/)[0];
  const id = raw.split('--').pop();
  return id || null;
}

// POST /api/search-events
// Body búsqueda:  { type:'search', query, resultsCount, sessionId? }
// Body pageview:  { type:'pageview', page, sessionId? }
// Devuelve { id } (útil para marcar el clic de un resultado más tarde — CTR).
router.post('/', asyncHandler(async (req, res) => {
  const type = req.body?.type === 'pageview' ? 'pageview' : 'search';
  const sessionId = String(req.body?.sessionId ?? '').slice(0, 64) || null;

  if (type === 'pageview') {
    const page = String(req.body?.page ?? '').trim().slice(0, MAX_PAGE_LEN);
    if (!page.startsWith('/')) return res.json({ ok: true, skipped: true });
    const ref = await db.collection(COL).add({
      type: 'pageview',
      page,
      sessionId,
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
    timestamp: FieldValue.serverTimestamp(),
  });
  res.json({ ok: true, id: ref.id });
}));

// POST /api/search-events/:id/click
// Marca qué producto abrió el usuario tras esa búsqueda (CTR).
router.post('/:id/click', asyncHandler(async (req, res) => {
  const clickedProductId = String(req.body?.clickedProductId ?? '').slice(0, MAX_ID_LEN);
  if (!clickedProductId) return res.status(400).json({ error: 'Falta clickedProductId.' });

  // merge:true → no pisa el resto del documento; si el id no existe, lo crea vacío
  // con solo este campo (aceptable: es telemetría best-effort, no dato crítico).
  await db.collection(COL).doc(req.params.id).set({ clickedProductId }, { merge: true });
  res.json({ ok: true });
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

module.exports = router;
