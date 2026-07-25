const crypto = require('crypto');
const { db, FieldValue, Timestamp } = require('../firebase');
const config = require('../config');
const logger = require('../utils/logger');

const COL = config.collections.analyticsEvents;
const MAX_QUERY_LEN = 120;
const MAX_ID_LEN = 80;
const MAX_PAGE_LEN = 200;
const ANALYTICS_CAP = 8000; 
const DEFAULT_DAYS = 30;
const TOP_LIMIT = 20;

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (date) => date.toISOString().slice(0, 10); 

const PAGEVIEW_DEDUPE_WINDOW_MS = 30 * 60 * 1000;
const PAGEVIEW_DEDUPE_CLEANUP_MS = 10 * 60 * 1000;
const recentPageviews = new Map(); 

setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of recentPageviews) {
    if (expiresAt <= now) recentPageviews.delete(key);
  }
}, PAGEVIEW_DEDUPE_CLEANUP_MS).unref();

function pageviewDedupeKey(ip, sessionId, page) {
  return sessionId ? `sid:${sessionId}:${page}` : `ip:${ip}:${page}`;
}

function isDuplicatePageview(ip, sessionId, page) {
  const key = pageviewDedupeKey(ip, sessionId, page);
  const now = Date.now();
  const expiresAt = recentPageviews.get(key);
  const isDuplicate = Boolean(expiresAt && expiresAt > now);
  recentPageviews.set(key, now + PAGEVIEW_DEDUPE_WINDOW_MS);
  return isDuplicate;
}

function productIdFromPage(page) {
  if (!page || !page.startsWith('/producto/')) return null;
  const raw = page.slice('/producto/'.length).split(/[?#]/)[0];
  const id = raw.split('--').pop();
  return id || null;
}

const POPULAR_LIMIT = 12;
const POPULAR_TERMS_LIMIT = 8;
const POPULAR_DAYS = 30;
const POPULAR_CACHE_TTL_MS = 60 * 60 * 1000;
let popularCache = { data: null, timestamp: 0 };

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
  const termByLower = new Map(); 

  snap.forEach((doc) => {
    const d = doc.data();
    if (d.deviceType === 'Bot') return; 
    if (d.type === 'pageview') {
      bump(productIdFromPage(d.page));
      return;
    }
    if (d.clickedProductId) bump(d.clickedProductId);

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

async function getPopularData() {
  const now = Date.now();
  if (popularCache.data && now - popularCache.timestamp < POPULAR_CACHE_TTL_MS) {
    return { ok: true, ...popularCache.data, cached: true };
  }

  try {
    const data = await computePopularData();
    popularCache = { data, timestamp: now };
    return { ok: true, ...data, cached: false };
  } catch (err) {
    if (popularCache.data) return { ok: true, ...popularCache.data, cached: true, stale: true };
    logger.error('popular_products_failed', { message: err.message });
    return { ok: true, productIds: [], terms: [] };
  }
}

async function trackEvent(body, headers, ip) {
  const origin = headers.origin || '';
  const referer = headers.referer || '';
  const clientIp = (headers['x-forwarded-for'] || ip || '').split(',')[0].trim();
  
  if (
    origin.includes('localhost') || origin.includes('127.0.0.1') ||
    referer.includes('localhost') || referer.includes('127.0.0.1') ||
    clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.includes('::ffff:127.0.0.1')
  ) {
    return { ok: true, skipped: true };
  }

  const type = body?.type === 'pageview' ? 'pageview' : 'search';
  const rawSessionId = String(body?.visitorId ?? body?.sessionId ?? '').slice(0, 64) || null;
  const rawUserAgent = String(headers['user-agent'] || '');
  const userAgent = rawUserAgent.slice(0, 200);

  const isBot =
    rawUserAgent.trim().length < 10 ||
    /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|google|bing|yandex|lighthouse|headless|preview|python|curl|wget|axios|node-fetch|okhttp/i.test(rawUserAgent);
  const isMobile = /mobile|android|iphone|ipad|ipod|windows phone/i.test(userAgent);
  const deviceType = isBot ? 'Bot' : (isMobile ? 'Mobile' : 'Desktop');

  if (isBot) return { ok: true, skipped: true };

  const sessionId = rawSessionId && rawSessionId !== 'Desconocido'
    ? rawSessionId
    : `ip-${crypto.createHash('sha256').update(clientIp || 'unknown').digest('hex').slice(0, 16)}`;

  if (type === 'pageview') {
    const page = String(body?.page ?? '').trim().slice(0, MAX_PAGE_LEN);
    if (!page.startsWith('/')) return { ok: true, skipped: true };
    if (page === '/') return { ok: true, skipped: true };

    if (isDuplicatePageview(clientIp, sessionId, page)) return { ok: true, skipped: true };

    const ref = await db.collection(COL).add({
      type: 'pageview',
      page,
      sessionId,
      ip: clientIp,
      deviceType,
      userAgent,
      entryType: body?.entryType || null,
      isNewVisitor: body?.isNewVisitor ?? null,
      referrer: body?.referrer || null,
      utmSource: body?.utmSource || null,
      utmMedium: body?.utmMedium || null,
      utmCampaign: body?.utmCampaign || null,
      timestamp: FieldValue.serverTimestamp(),
    });
    return { ok: true, id: ref.id };
  }

  const query = String(body?.query ?? '').trim().slice(0, MAX_QUERY_LEN);
  const rawCount = Number(body?.resultsCount);
  const resultsCount = Number.isFinite(rawCount) ? Math.max(0, Math.floor(rawCount)) : 0;

  if (query.length < 2) return { ok: true, skipped: true };

  const ref = await db.collection(COL).add({
    type: 'search',
    query,
    queryLower: query.toLowerCase(), 
    resultsCount,
    clickedProductId: null,
    sessionId,
    ip: clientIp,
    deviceType,
    userAgent,
    timestamp: FieldValue.serverTimestamp(),
  });
  return { ok: true, id: ref.id };
}

async function markClick(id, clickedProductIdRaw) {
  const clickedProductId = String(clickedProductIdRaw ?? '').slice(0, MAX_ID_LEN);
  if (!clickedProductId) throw new Error('Falta clickedProductId.');

  await db.collection(COL).doc(id).set({ clickedProductId }, { merge: true });
}

async function getAnalytics(queryDays) {
  const days = Math.min(365, Math.max(1, Number(queryDays) || DEFAULT_DAYS));
  const cutoff = Timestamp.fromMillis(Date.now() - days * DAY_MS);

  const snap = await db
    .collection(COL)
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'desc')
    .limit(ANALYTICS_CAP)
    .get();

  const byTerm = new Map(); 
  const clicksByProduct = new Map(); 
  const viewsByProduct = new Map(); 
  const searchesByDay = new Map(); 
  const visitsByDay = new Map(); 
  let searchCount = 0;
  let pageviewCount = 0;

  snap.forEach((doc) => {
    const d = doc.data();
    if (d.deviceType === 'Bot') return; 
    const when = d.timestamp && d.timestamp.toDate ? d.timestamp.toDate() : null;
    const key = when ? dayKey(when) : null;

    if (d.type === 'pageview') {
      pageviewCount++;
      if (key) visitsByDay.set(key, (visitsByDay.get(key) || 0) + 1);
      const pid = productIdFromPage(d.page);
      if (pid) viewsByProduct.set(pid, (viewsByProduct.get(pid) || 0) + 1);
      return;
    }

    searchCount++;
    if (key) searchesByDay.set(key, (searchesByDay.get(key) || 0) + 1);
    const q = d.queryLower || String(d.query || '').toLowerCase();
    if (q) {
      const entry = byTerm.get(q) || { query: d.query || q, count: 0, lastResults: null };
      entry.count++;
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

  const trafficByProduct = [...viewsByProduct.entries()]
    .map(([productId, views]) => ({ productId, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, TOP_LIMIT);

  const timeseries = [];
  const startDay = Date.now() - (days - 1) * DAY_MS;
  for (let i = 0; i < days; i++) {
    const k = dayKey(new Date(startDay + i * DAY_MS));
    timeseries.push({ day: k, visits: visitsByDay.get(k) || 0, searches: searchesByDay.get(k) || 0 });
  }

  return {
    range: { days },
    totals: {
      events: snap.size,
      searches: searchCount,
      pageviews: pageviewCount,
      uniqueTerms: terms.length,
      zeroResultTerms: zeroResultSearches.length,
      capped: snap.size >= ANALYTICS_CAP,
    },
    timeseries,
    topSearches,
    zeroResultSearches,
    topClickedProducts,
    trafficByProduct,
  };
}

async function getSessions(queryDays) {
  const days = Math.min(365, Math.max(1, Number(queryDays) || DEFAULT_DAYS));
  const cutoff = Timestamp.fromMillis(Date.now() - days * DAY_MS);

  const snap = await db
    .collection(COL)
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'desc')
    .limit(3000)
    .get();

  const sessionsMap = new Map();

  snap.forEach((doc) => {
    const d = doc.data();
    if (d.deviceType === 'Bot') return;
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
    
    if (d.entryType) session.entryType = d.entryType;
    if (d.referrer) session.referrer = d.referrer;
    if (d.utmSource) session.utmSource = d.utmSource;
    if (d.utmMedium) session.utmMedium = d.utmMedium;
    if (d.utmCampaign) session.utmCampaign = d.utmCampaign;
    if (d.isNewVisitor !== undefined && d.isNewVisitor !== null) session.isNewVisitor = d.isNewVisitor;
    const time = d.timestamp && d.timestamp.toDate ? d.timestamp.toDate().toISOString() : new Date().toISOString();
    
    if (!session.startTime || time < session.startTime) {
      session.startTime = time;
    }

    if (d.type === 'pageview') {
      session.actions.push({ type: 'pageview', page: d.page, timestamp: time });
    } else {
      session.actions.push({ type: 'search', query: d.query, resultsCount: d.resultsCount, clickedProductId: d.clickedProductId, timestamp: time });
    }
  });

  const sessions = [...sessionsMap.values()];
  
  sessions.forEach(s => {
    s.actions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  });

  sessions.sort((a, b) => {
    const lastA = a.actions.length > 0 ? a.actions[a.actions.length - 1].timestamp : a.startTime;
    const lastB = b.actions.length > 0 ? b.actions[b.actions.length - 1].timestamp : b.startTime;
    return new Date(lastB) - new Date(lastA);
  });

  return sessions;
}

async function getRawSearches(queryDays) {
  const days = Math.min(365, Math.max(1, Number(queryDays) || DEFAULT_DAYS));
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
    if (d.deviceType === 'Bot') return; 

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

  return searches;
}

module.exports = {
  getPopularData,
  trackEvent,
  markClick,
  getAnalytics,
  getSessions,
  getRawSearches
};
