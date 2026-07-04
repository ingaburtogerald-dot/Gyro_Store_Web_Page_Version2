// Lecturas de ventas: listado con filtros/paginación, resumen semanal,
// performance por vendedor y serie temporal para el dashboard.
const router = require('express').Router();
const { db } = require('../../firebase');
const { requireSeller, requireAdmin, requireAnyRole } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/asyncHandler');
const { computeFinancials, getCostosFijosPct, getCostosFijosConfig, round } = require('../../services/commission');
const { fifoForCode, realCostForItems } = require('../../services/sales');
const { ORDERS, isAdminLike, migratedFinancialsFromLines } = require('./helpers');

// GET /api/sales — obtiene las ventas (filtra por usuario según rol, y soporta paginación)
router.get('/', requireAnyRole, asyncHandler(async (req, res) => {
  const isUserAdmin = isAdminLike(req.user);
  let docs;

  // Filtro de base de datos rápido
  if (req.query.ids) {
    const ids = String(req.query.ids).split(',').filter(Boolean);
    if (ids.length > 0) {
      const refs = ids.map(id => db.collection(ORDERS).doc(id));
      const snaps = await db.getAll(...refs);
      docs = snaps.filter(s => s.exists);
    } else {
      docs = [];
    }
  } else if (isUserAdmin) {
    if (req.query.sellerEmail && req.query.sellerEmail !== 'all') {
      docs = (await db.collection(ORDERS).where('sellerEmail', '==', req.query.sellerEmail).get()).docs;
    } else {
      docs = (await db.collection(ORDERS).where('type', 'in', ['seller_report', 'admin_report']).get()).docs;
    }
  } else {
    docs = (await db.collection(ORDERS).where('sellerEmail', '==', req.user.email).get()).docs;
  }

  // Mapear a objetos planos reteniendo Timestamp para filtros
  let rawList = docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  // Filtro de fecha en memoria (compatible con YYYY-MM y YYYY-MM-DD)
  if (req.query.date && req.query.date !== 'all') {
    const dateStr = String(req.query.date);
    rawList = rawList.filter(o => {
      const iso = o.createdAt?.toDate?.()?.toISOString() || '';
      return iso.startsWith(dateStr);
    });
  }

  // Filtro de estado en memoria
  if (req.query.status && req.query.status !== 'all') {
    if (req.query.status === 'history') {
      rawList = rawList.filter(o => o.status === 'approved' || o.status === 'paid');
    } else {
      rawList = rawList.filter(o => o.status === req.query.status);
    }
  }

  // Ordenamiento en memoria por fecha (descendente)
  rawList.sort((a, b) => {
    const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
    const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
    return bTime - aTime;
  });

  // Aplicar paginación si se solicita
  const paginate = req.query.paginate === 'true';
  const total = rawList.length;
  let slicedList = rawList;
  let page = 1;
  let limit = 50;

  if (paginate) {
    page = Math.max(1, parseInt(req.query.page, 10) || 1);
    limit = Math.max(1, Math.min(100000, parseInt(req.query.limit, 10) || 50));
    slicedList = rawList.slice((page - 1) * limit, page * limit);
  }

  const list = [];
  const pct = isUserAdmin ? await getCostosFijosPct() : 0;

  // Procesar únicamente los ítems de la página actual (Optimización N+1)
  const costosFijosConfig = isUserAdmin ? await getCostosFijosConfig() : null;
  for (const o of slicedList) {
    const sanitized = {
      ...o,
      createdAt: o.createdAt?.toDate?.()?.toISOString() || null,
      approvedAt: o.approvedAt?.toDate?.()?.toISOString() || null,
      paidAt: o.paidAt?.toDate?.()?.toISOString() || null,
    };

    if (isUserAdmin && sanitized.status === 'pending_approval' && sanitized.saleOrigin === 'migrated') {
      // Migrado: financieros estimados desde el costo ya guardado en cada línea (sin FIFO).
      try {
        const est = migratedFinancialsFromLines(sanitized.items, sanitized.saleTotal);
        sanitized.totalCostReal = est.costReal;
        sanitized.totalUtilidadBruta = est.utilidadBruta;
        sanitized.totalCostosFijos = est.costosFijos;
        sanitized.totalUtilidadNeta = est.utilidadNeta;
        sanitized.comisionVendedor = est.comisionVendedor;
        sanitized.comisionPercent = est.comisionPercent;
        sanitized.gananciaTienda = est.gananciaTienda;
        sanitized.items = sanitized.items.map((it) => {
          const c = (Number(it.unitCostReal) || 0) * it.quantity;
          const ub = it.salePrice * it.quantity - c;
          return { ...it, costReal: round(c), utilidadBruta: round(ub), costosFijos: 0, utilidadNeta: round(ub) };
        });
      } catch (err) {
        sanitized.insufficientStockError = err.message;
      }
    } else if (isUserAdmin && sanitized.status === 'pending_approval') {
      try {
        for (const it of sanitized.items) {
          it.lineCost = await fifoForCode(it.code, it.quantity, false);
        }
        const est = computeFinancials({ lines: sanitized.items, costosFijosConfig });

        sanitized.totalCostReal = est.costReal;
        sanitized.totalUtilidadBruta = est.utilidadBruta;
        sanitized.totalCostosFijos = est.costosFijos;
        sanitized.totalUtilidadNeta = est.utilidadNeta;
        sanitized.comisionVendedor = est.comisionVendedor;
        sanitized.comisionPercent = est.comisionPercent;
        sanitized.gananciaTienda = est.gananciaTienda;

        sanitized.items = est.linesFinancials;
      } catch (err) {
        sanitized.insufficientStockError = err.message;
      }
    } else if (!isUserAdmin) {
      // Excluir campos financieros confidenciales
      delete sanitized.totalCostReal;
      delete sanitized.totalUtilidadBruta;
      delete sanitized.totalCostosFijos;
      delete sanitized.totalUtilidadNeta;
      delete sanitized.gananciaTienda;

      if (Array.isArray(sanitized.items)) {
        sanitized.items = sanitized.items.map((it) => {
          const copy = { ...it };
          delete copy.costReal;
          delete copy.utilidadBruta;
          delete copy.costosFijos;
          delete copy.utilidadNeta;
          delete copy.unitCostReal; // costo unitario migrado: confidencial
          return copy;
        });
      }
    }

    list.push(sanitized);
  }

  if (paginate) {
    let totalVendidoAmount = 0;
    let totalComisionAmount = 0;
    let totalGananciaTienda = 0;
    let totalInversionRecuperada = 0;
    let totalVentasAprobadas = 0;
    let totalVentasEnRevision = 0;

    for (const o of rawList) {
      if (o.status === 'approved' || o.status === 'paid') {
        totalVentasAprobadas++;
        totalVendidoAmount += o.saleTotal || 0;
        totalComisionAmount += o.comisionVendedor || 0;
        totalGananciaTienda += o.gananciaTienda || 0;
        totalInversionRecuperada += o.costReal || o.totalCostReal || 0;
      } else if (o.status === 'pending_approval') {
        totalVentasEnRevision++;
      }
    }

    res.json({
      data: list,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        ventasAprobadas: totalVentasAprobadas,
        totalVendido: totalVendidoAmount,
        comisiones: totalComisionAmount,
        // Ganancia de tienda e inversión/costo son confidenciales: solo admin.
        gananciaTienda: isUserAdmin ? totalGananciaTienda : 0,
        inversionRecuperada: isUserAdmin ? totalInversionRecuperada : 0,
        enRevision: totalVentasEnRevision
      }
    });
  } else {
    res.json(list);
  }
}));

// GET /api/sales/weekly-summary — ventas aprobadas agrupadas por vendedor/semana.
router.get('/weekly-summary', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await db.collection(ORDERS)
    .where('type', 'in', ['seller_report', 'admin_report'])
    .where('status', '==', 'approved')
    .get();

  const groups = {};

  snap.docs.forEach((doc) => {
    const o = doc.data();
    const week = o.weekOf || 'Sin Semana';
    const emailStr = o.sellerEmail || 'desconocido@gyrostore.com';
    const key = `${week}_${emailStr}`;

    if (!groups[key]) {
      groups[key] = {
        weekOf: week,
        sellerEmail: emailStr,
        sellerName: o.sellerName || emailStr.split('@')[0],
        sales: [],
        totalVendido: 0,
        comisionTotal: 0,
        ventasAprobadasCount: 0,
      };
    }

    groups[key].sales.push({
      id: doc.id,
      saleTotal: o.saleTotal || o.totalSaleAmount || 0,
      comisionVendedor: o.comisionVendedor || 0,
      items: o.items || [],
      createdAt: o.createdAt?.toDate?.()?.toISOString() || null,
    });

    groups[key].totalVendido += o.saleTotal || o.totalSaleAmount || 0;
    groups[key].comisionTotal += o.comisionVendedor || 0;
    groups[key].ventasAprobadasCount++;
  });

  const list = Object.values(groups).map((g) => {
    g.totalVendido = Math.round(g.totalVendido * 100) / 100;
    g.comisionTotal = Math.round(g.comisionTotal * 100) / 100;
    g.sales.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    return g;
  });

  list.sort((a, b) => b.weekOf.localeCompare(a.weekOf));
  res.json(list);
}));

// GET /api/sales/performance — comparativa por vendedor (admin y seller).
router.get('/performance', requireSeller, asyncHandler(async (req, res) => {
  const { year, month, allTime } = req.query;
  let q = db.collection(ORDERS).where('status', '==', 'approved');

  if (allTime !== 'true') {
    const d = new Date();
    const y = year ? Number(year) : d.getFullYear();
    const m = month !== undefined ? Number(month) : d.getMonth();
    const start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
    const end = new Date(Date.UTC(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, 1, 0, 0, 0));
    q = q.where('createdAt', '>=', start).where('createdAt', '<', end);
  }

  const snap = await q.get();
  const map = {};
  let companyTotalSales = 0;

  snap.forEach((doc) => {
    const d = doc.data();
    const email = d.sellerEmail;
    if (!map[email]) {
      map[email] = {
        sellerEmail: email,
        sellerName: d.sellerName,
        ventas: 0,
        totalVendido: 0,
        comisiones: 0,
      };
    }
    map[email].ventas += 1;
    map[email].totalVendido += d.saleTotal || 0;
    map[email].comisiones += d.comisionVendedor || 0;

    companyTotalSales += d.saleTotal || 0;
  });

  let results = Object.values(map).map((s) => ({
    ...s,
    comisionPromedio: s.ventas ? s.comisiones / s.ventas : 0,
  }));

  // Ordenar de mayor a menor totalVendido
  results.sort((a, b) => b.totalVendido - a.totalVendido);

  if (req.user.role !== 'admin') {
    results = results.filter((s) => s.sellerEmail === req.user.email);
    res.json({ data: results, companyTotalSales });
    return;
  }

  res.json({ data: results, companyTotalSales });
}));

// GET /api/sales/timeseries — serie temporal de ventas para el dashboard (Resumen).
// Granularidad y ventana derivadas del filtro `date` (relleno de ceros sin huecos):
//   - 'all'        → desde la 1ª venta hasta hoy, agrupado por MES (cap 24 meses)
//   - 'YYYY-MM'    → ese mes completo, agrupado por DÍA
//   - 'YYYY-MM-DD' → ese único día (1 punto)
// Solo cuenta ventas approved|paid. ventas = Σ saleTotal, ganancia = Σ gananciaTienda.
// Usa el MISMO acceso a datos que GET '/' (query simple + agregación en memoria) para
// no exigir índices compuestos nuevos; el dataset del negocio es chico.
router.get('/timeseries', requireAnyRole, asyncHandler(async (req, res) => {
  const isUserAdmin = isAdminLike(req.user);
  const sellerEmail = req.query.sellerEmail;
  const dateStr = req.query.date && req.query.date !== 'all' ? String(req.query.date) : null;

  // Granularidad + ventana [start, end) en UTC.
  let granularity = 'day';
  let start, end;
  // Sin filtro: vista por mes desde la PRIMERA venta hasta hoy (start se calcula
  // tras leer los datos, para no arrastrar meses vacíos previos al primer registro).
  const allTime = !dateStr;
  if (allTime) {
    granularity = 'month';
    const now = new Date();
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  } else if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [y, m] = dateStr.split('-').map(Number);
    start = new Date(Date.UTC(y, m - 1, 1));
    end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    start = new Date(Date.UTC(y, m - 1, d));
    end = new Date(Date.UTC(y, m - 1, d + 1));
  } else {
    return res.status(400).json({ error: 'Parámetro date inválido.' });
  }

  // Acceso a datos: idéntico a GET '/' (sin índices compuestos).
  let docs;
  if (isUserAdmin) {
    if (sellerEmail && sellerEmail !== 'all') {
      docs = (await db.collection(ORDERS).where('sellerEmail', '==', sellerEmail).get()).docs;
    } else {
      docs = (await db.collection(ORDERS).where('type', 'in', ['seller_report', 'admin_report']).get()).docs;
    }
  } else {
    docs = (await db.collection(ORDERS).where('sellerEmail', '==', req.user.email).get()).docs;
  }

  // Vista "todo el tiempo": el inicio es el mes de la primera venta aprobada/pagada
  // (cap de 24 meses para no generar un eje X gigante). Sin ventas → solo el mes actual.
  if (allTime) {
    let earliest = null;
    for (const doc of docs) {
      const o = doc.data();
      if (o.status !== 'approved' && o.status !== 'paid') continue;
      const created = o.createdAt?.toDate?.();
      if (created && created < end && (!earliest || created < earliest)) earliest = created;
    }
    start = earliest
      ? new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1))
      : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
    const cap = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 24, 1));
    if (start < cap) start = cap;
  }

  // Acumular en buckets (clave por mes YYYY-MM o por día YYYY-MM-DD), solo
  // aprobadas/pagadas dentro de la ventana.
  const sliceLen = granularity === 'month' ? 7 : 10;
  const buckets = new Map();
  for (const doc of docs) {
    const o = doc.data();
    if (o.status !== 'approved' && o.status !== 'paid') continue;
    const created = o.createdAt?.toDate?.();
    if (!created || created < start || created >= end) continue;
    const key = created.toISOString().slice(0, sliceLen);
    const acc = buckets.get(key) || { ventas: 0, ganancia: 0, comision: 0 };
    acc.ventas += o.saleTotal || 0;
    acc.comision += o.comisionVendedor || 0; // comisión del vendedor (no confidencial)
    acc.ganancia += isUserAdmin ? (o.gananciaTienda || 0) : 0; // ganancia tienda: confidencial
    buckets.set(key, acc);
  }

  // Relleno continuo de ceros entre start y end (serie sin huecos para el chart).
  const data = [];
  const cursor = new Date(start);
  while (cursor < end) {
    const key = cursor.toISOString().slice(0, sliceLen);
    const acc = buckets.get(key) || { ventas: 0, ganancia: 0, comision: 0 };
    // Siempre devolvemos `date` como YYYY-MM-DD (el primer día del bucket).
    data.push({ date: `${key}${granularity === 'month' ? '-01' : ''}`, ventas: round(acc.ventas), comision: round(acc.comision), ganancia: round(acc.ganancia) });
    if (granularity === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  res.json({ data, granularity, isMock: false });
}));

module.exports = router;
