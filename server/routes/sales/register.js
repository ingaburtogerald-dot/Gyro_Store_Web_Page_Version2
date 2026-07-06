// Registro de ventas (vendedor o admin en nombre de un vendedor), con foto opcional.
// La venta nace 'pending_approval' con su stock RESERVADO (FIFO nativo o lote migrado).
const router = require('express').Router();
const { db, FieldValue } = require('../../firebase');
const config = require('../../config');
const { requireSeller } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/asyncHandler');
const { reserveForItems, reserveForMigratedItems } = require('../../services/sales');
const storage = require('../../services/storage');
const {
  ORDERS, upload, isAdminLike, publicItems, buildLines, migratedFinancialsFromLines, validatePriceFloor,
  distributeReservations,
} = require('./helpers');

const INVOICES = config.collections.invoices;

// Agrupa las líneas en UNA VENTA POR COMBINACIÓN de código + precio: si el mismo
// producto se vende a precios distintos, cada precio genera una venta independiente.
// Solo se consolidan (sumando cantidades) líneas con el mismo código, precio y modo.
function groupLinesByCode(lines) {
  const groups = new Map(); // "code|salePrice" → líneas consolidadas
  for (const line of lines) {
    const key = `${line.code}|${line.salePrice}`;
    const group = groups.get(key) || [];
    const same = group.find((l) => l.mode === line.mode);
    if (same) {
      same.quantity += line.quantity;
      same.lineTotal += line.lineTotal;
    } else {
      group.push({ ...line });
    }
    groups.set(key, group);
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

// Registra la venta DESDE un ticket de facturación: las líneas y reservas se
// heredan del ticket (inmutables para el vendedor); NO se re-reserva stock.
// La transacción re-verifica el estado del ticket → 1 ticket = 1 uso garantizado.
// Nota: si luego todas las órdenes hijas se rechazan/eliminan, el stock se libera
// por el flujo normal pero el ticket queda 'linked' (trazable); para reintentar,
// la cajera emite un ticket nuevo.
async function registerFromInvoice(req, res) {
  const invRef = db.collection(INVOICES).doc(String(req.body.invoiceId));
  const invSnap = await invRef.get();
  if (!invSnap.exists) return res.status(404).json({ error: 'Ticket no encontrado.' });
  const inv = invSnap.data();
  if (inv.status !== 'unlinked') {
    return res.status(400).json({ error: 'Este ticket ya fue usado o está anulado.' });
  }
  const assigned = inv.assignedSeller || {};
  if (assigned.uid !== req.user.uid && !isAdminLike(req.user)) {
    return res.status(403).json({ error: 'Este ticket está asignado a otro vendedor.' });
  }

  // Líneas desde el ticket, con la misma forma que produce buildLines (nativo).
  const lines = (inv.items || []).map((it) => ({
    productId: it.productId || '',
    origin: 'native',
    code: it.productCode,
    name: it.productName,
    variantName: 'Estándar',
    quantity: it.quantity,
    salePrice: it.unitPrice,
    lineTotal: it.lineTotal,
  }));
  if (!lines.length) return res.status(400).json({ error: 'El ticket no tiene productos.' });

  let receiptPhotoUrl = '';
  if (req.file) {
    const slug = storage.sanitizePathSegment(assigned.name || req.user.email.split('@')[0]);
    const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0];
    receiptPhotoUrl = await storage.uploadFile(req.file.buffer, `sales-receipts/${slug}`, `${Date.now()}${ext}`, req.file.mimetype);
  }

  // La venta queda a nombre del vendedor asignado al ticket, aunque la registre un admin.
  const type = assigned.uid === req.user.uid ? 'seller_report' : 'admin_report';

  let createdAt = FieldValue.serverTimestamp();
  if (req.body.saleDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(req.body.saleDate));
    if (m) {
      createdAt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
    }
  }

  const lineGroups = groupLinesByCode(lines);
  const reservationsForGroup = distributeReservations(lineGroups, inv.reservations || []);

  const created = [];
  try {
    await db.runTransaction(async (tx) => {
      // Re-verificar DENTRO de la transacción: elimina la carrera de doble uso.
      const fresh = await tx.get(invRef);
      if (!fresh.exists || fresh.data().status !== 'unlinked') {
        throw new Error('Este ticket ya fue usado o está anulado.');
      }
      created.length = 0; // la transacción puede reintentar
      for (let gi = 0; gi < lineGroups.length; gi++) {
        const groupLines = lineGroups[gi];
        const groupTotal = groupLines.reduce((s, l) => s + l.lineTotal, 0);
        const order = {
          type,
          saleOrigin: 'native',
          sellerUid: assigned.uid,
          sellerEmail: assigned.email,
          sellerName: assigned.name,
          registeredBy: req.user.uid,
          items: groupLines,
          saleTotal: groupTotal,
          totalSaleAmount: groupTotal,
          status: 'pending_approval',
          receiptPhotoUrl,
          reservations: reservationsForGroup.get(gi) || [],
          rejectionReason: null,
          invoiceId: invRef.id,
          paymentScreenshotUrl: null,
          createdAt,
          approvedAt: null,
          paidAt: null,
          weekOf: null,
        };
        const ref = db.collection(ORDERS).doc();
        tx.set(ref, order);
        created.push({ id: ref.id, order });
      }
      tx.update(invRef, {
        status: 'linked',
        linkedOrderIds: created.map((c) => c.id),
        linkedToOrder: created[0].id,
        linkedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const first = created[0];
  const responseItems = isAdminLike(req.user) ? first.order.items : publicItems(first.order.items);
  return res.status(201).json({
    id: first.id,
    ids: created.map((c) => c.id),
    count: created.length,
    ...first.order,
    items: responseItems,
  });
}

// POST /api/sales — registra una venta (seller, admin), con foto opcional y admin register on behalf.
router.post('/', requireSeller, upload.single('receipt'), asyncHandler(async (req, res) => {
  // Venta desde ticket de facturación: rama aparte (hereda reservas del ticket).
  if (req.body.invoiceId) return registerFromInvoice(req, res);

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

  // ── Una venta por código+precio: el stock ya quedó reservado atómicamente arriba;
  // aquí se reparten líneas y reservas entre las ventas (helper compartido con
  // la venta desde ticket).
  const lineGroups = groupLinesByCode(lines);
  const reservationsForGroup = distributeReservations(lineGroups, reservations);

  const batch = db.batch();
  const created = [];
  for (let gi = 0; gi < lineGroups.length; gi++) {
    const groupLines = lineGroups[gi];
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
      reservations: reservationsForGroup.get(gi) || [],
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
