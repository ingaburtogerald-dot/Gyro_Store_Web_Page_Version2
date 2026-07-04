// Cotizador: productos vendibles y cálculo financiero en tiempo real (no persiste).
const router = require('express').Router();
const { db } = require('../../firebase');
const { requireSeller } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/asyncHandler');
const { computeFinancials, getCostosFijosPct, getCostosFijosConfig } = require('../../services/commission');
const { realCostForItems, fifoForCode } = require('../../services/sales');
const { RATE } = require('../../services/inventory');
const {
  PRODUCTS, MIGRATED, isAdminLike, buildLines, migratedFinancialsFromLines, validatePriceFloor,
} = require('./helpers');

// GET /api/sales/products — productos vendibles (stock > 0) para el cotizador.
// Incluye AMBOS inventarios: nativo (origin:'native') y migrado (origin:'migrated').
router.get('/products', requireSeller, asyncHandler(async (req, res) => {
  const snap = await db.collection(PRODUCTS).get();
  const native = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => !p.deletedAt && (p.stock || 0) > 0)
    .map((p) => ({ id: p.id, code: p.code, name: p.name, price: p.price || 0, stock: p.stock || 0, origin: 'native' }));

  const migSnap = await db.collection(MIGRATED).get();
  const migrated = migSnap.docs
    .map((d) => {
      const m = d.data();
      const stock = Math.max(0, (m.quantity || 0) - (m.quantitySold || 0) - (m.quantityReserved || 0));
      const costReal = ((Number(m.costUnit) || 0) + (Number(m.shippingUnit) || 0)) * RATE;
      const price = Math.round((costReal * 1.40) / 10) * 10; // sugerido migrado (+40%)
      return { id: d.id, code: m.code, name: m.productName, price, stock, origin: 'migrated' };
    })
    .filter((p) => p.stock > 0);

  res.json([...native, ...migrated].sort((a, b) => String(a.name).localeCompare(String(b.name))));
}));

// POST /api/sales/quote — cotizador en tiempo real (no persiste, no consume stock).
router.post('/quote', requireSeller, asyncHandler(async (req, res) => {
  let built;
  try {
    built = await buildLines(req.body.items);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const { lines, saleTotal, saleOrigin } = built;
  if (!lines.length) return res.status(400).json({ error: 'Selecciona al menos un producto.' });

  try {
    let full;
    if (saleOrigin === 'migrated') {
      // Migrado: costo ya conocido, sin FIFO ni costos fijos (lógica M1/M2 por línea).
      full = { saleTotal, saleOrigin, costosFijosPct: 0, ...migratedFinancialsFromLines(lines, saleTotal) };
    } else {
      await validatePriceFloor(lines);
      // We must get the FIFO cost per line to pass to computeFinancials.
      // realCostForItems does it, but we can do it individually to keep it per line.
      for (const l of lines) {
         l.lineCost = await fifoForCode(l.code, l.quantity, false);
      }
      const pct = await getCostosFijosPct();
      const costosFijosConfig = await getCostosFijosConfig();
      full = { saleTotal, saleOrigin: 'native', costosFijosPct: pct, ...computeFinancials({ lines, costosFijosConfig }) };
    }
    // El vendedor solo ve el total y su comisión; el desglose de costo/utilidad es confidencial.
    if (!isAdminLike(req.user)) {
      return res.json({ saleTotal: full.saleTotal, saleOrigin: full.saleOrigin, comisionVendedor: full.comisionVendedor });
    }
    res.json(full);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

module.exports = router;
