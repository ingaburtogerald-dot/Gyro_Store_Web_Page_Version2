// Registro de ventas (vendedor o admin en nombre de un vendedor), con foto opcional.
// La venta nace 'pending_approval' con su stock RESERVADO (FIFO nativo o lote migrado).
const router = require('express').Router();
const { db, FieldValue } = require('../../firebase');
const { requireSeller } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/asyncHandler');
const { reserveForItems, reserveForMigratedItems } = require('../../services/sales');
const storage = require('../../services/storage');
const {
  ORDERS, upload, isAdminLike, publicItems, buildLines, migratedFinancialsFromLines, validatePriceFloor,
} = require('./helpers');

// Agrupa las líneas en UNA VENTA POR PRODUCTO (código): productos distintos no se
// mezclan en la misma venta. Dentro del mismo código, las líneas idénticas
// (mismo precio y modo) se consolidan sumando cantidades; si el precio difiere,
// quedan como líneas separadas de esa misma venta.
function groupLinesByCode(lines) {
  const groups = new Map(); // code → líneas de ese producto
  for (const line of lines) {
    const group = groups.get(line.code) || [];
    const same = group.find((l) => l.salePrice === line.salePrice && l.mode === line.mode);
    if (same) {
      same.quantity += line.quantity;
      same.lineTotal += line.lineTotal;
    } else {
      group.push({ ...line });
    }
    groups.set(line.code, group);
  }
  return [...groups.values()];
}

// POST /api/sales/report — registra una venta (pendiente de aprobación), con foto opcional.
router.post('/report', requireSeller, upload.single('receipt'), asyncHandler(async (req, res) => {
  let items;
  try {
    items = typeof req.body.items === 'string' ? JSON.parse(req.body.items) : req.body.items;
  } catch {
    return res.status(400).json({ error: 'Datos de la venta inválidos.' });
  }

  const { lines, saleTotal } = await buildLines(items);
  if (!lines.length) return res.status(400).json({ error: 'La venta no tiene productos válidos.' });

  try {
    await validatePriceFloor(lines);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  let receiptPhotoUrl = '';
  if (req.file) {
    const slug = storage.sanitizePathSegment(req.user.name || req.user.email.split('@')[0]);
    const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0];
    receiptPhotoUrl = await storage.uploadFile(req.file.buffer, `sales-receipts/${slug}`, `${Date.now()}${ext}`, req.file.mimetype);
  }

  let reservations = [];
  try {
    reservations = await reserveForItems(lines.map((l) => ({ code: l.code, quantity: l.quantity })));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const order = {
    type: 'seller_report',
    sellerUid: req.user.uid,
    sellerEmail: req.user.email,
    sellerName: req.user.name || req.user.email.split('@')[0],
    registeredBy: req.user.uid,
    items: lines,
    saleTotal,
    totalSaleAmount: saleTotal,
    status: 'pending_approval',
    receiptPhotoUrl,
    reservations,
    rejectionReason: null,
    invoiceId: null,
    paymentScreenshotUrl: null,
    createdAt: FieldValue.serverTimestamp(),
    approvedAt: null,
    paidAt: null,
    weekOf: null,
  };

  if (req.body.saleDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(req.body.saleDate));
    if (m) {
      order.createdAt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
    }
  }

  const ref = await db.collection(ORDERS).add(order);
  // No filtrar costos de las líneas migradas al vendedor que registra la venta.
  const responseItems = isAdminLike(req.user) ? order.items : publicItems(order.items);
  res.status(201).json({ id: ref.id, ...order, items: responseItems });
}));

// POST /api/sales — registra una venta (seller, admin), con foto opcional y admin register on behalf.
router.post('/', requireSeller, upload.single('receipt'), asyncHandler(async (req, res) => {
  let items;
  try {
    items = typeof req.body.items === 'string' ? JSON.parse(req.body.items) : req.body.items;
  } catch {
    return res.status(400).json({ error: 'Datos de la venta inválidos.' });
  }

  let built;
  try {
    built = await buildLines(items);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const { lines, saleTotal, saleOrigin } = built;
  if (!lines.length) return res.status(400).json({ error: 'La venta no tiene productos válidos.' });

  // Validación de piso de precio: solo para inventario nativo (el migrado tiene reglas propias).
  if (saleOrigin === 'native') {
    try {
      await validatePriceFloor(lines);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  } else {
    // Migrado: rechaza de una vez modos no soportados (p. ej. M2).
    try {
      migratedFinancialsFromLines(lines, saleTotal);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  let receiptPhotoUrl = '';
  if (req.file) {
    const slug = storage.sanitizePathSegment(req.user.name || req.user.email.split('@')[0]);
    const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0];
    receiptPhotoUrl = await storage.uploadFile(req.file.buffer, `sales-receipts/${slug}`, `${Date.now()}${ext}`, req.file.mimetype);
  }

  let sellerUid = req.user.uid;
  let sellerEmail = req.user.email;
  let sellerName = req.user.name || req.user.email.split('@')[0];
  let type = 'seller_report';

  const isUserAdmin = isAdminLike(req.user);
  if (isUserAdmin && req.body.sellerEmail) {
    sellerEmail = req.body.sellerEmail;
    sellerUid = req.body.sellerUid || '';
    sellerName = req.body.sellerName || sellerEmail.split('@')[0];
    type = 'admin_report';
  }

  // Reservar stock: FIFO (nativo) o sobre el lote migrado.
  let reservations = [];
  try {
    reservations = saleOrigin === 'migrated'
      ? await reserveForMigratedItems(lines.map((l) => ({ migratedId: l.migratedId, quantity: l.quantity })))
      : await reserveForItems(lines.map((l) => ({ code: l.code, quantity: l.quantity })));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Fecha efectiva de la venta (compartida por todas las ventas del registro).
  let createdAt = FieldValue.serverTimestamp();
  if (req.body.saleDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(req.body.saleDate));
    if (m) {
      createdAt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
    }
  }

  // ── Una venta por producto: el stock ya quedó reservado atómicamente arriba;
  // aquí solo se reparten líneas y reservas (ambas llevan `code`) entre las ventas.
  const lineGroups = groupLinesByCode(lines);
  const reservationsByCode = new Map();
  for (const r of reservations) {
    const arr = reservationsByCode.get(r.code) || [];
    arr.push(r);
    reservationsByCode.set(r.code, arr);
  }

  const batch = db.batch();
  const created = [];
  for (const groupLines of lineGroups) {
    const groupTotal = groupLines.reduce((s, l) => s + l.lineTotal, 0);
    const order = {
      type,
      saleOrigin,
      sellerUid,
      sellerEmail,
      sellerName,
      registeredBy: req.user.uid,
      items: groupLines,
      saleTotal: groupTotal,
      totalSaleAmount: groupTotal,
      status: 'pending_approval',
      receiptPhotoUrl,
      reservations: reservationsByCode.get(groupLines[0].code) || [],
      rejectionReason: null,
      invoiceId: null,
      paymentScreenshotUrl: null,
      createdAt,
      approvedAt: null,
      paidAt: null,
      weekOf: null,
    };
    const ref = db.collection(ORDERS).doc();
    batch.set(ref, order);
    created.push({ id: ref.id, order });
  }
  await batch.commit();

  // Respuesta compatible con la anterior (la primera venta) + ids/count del lote.
  const first = created[0];
  // No filtrar costos de las líneas migradas al vendedor que registra la venta.
  const responseItems = isAdminLike(req.user) ? first.order.items : publicItems(first.order.items);
  res.status(201).json({
    id: first.id,
    ids: created.map((c) => c.id),
    count: created.length,
    ...first.order,
    items: responseItems,
  });
}));

module.exports = router;
