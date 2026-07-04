// Gestión de Ventas — router compuesto. Antes era un solo sales.js de ~1700
// líneas; ahora cada dominio vive en su módulo y los helpers compartidos
// (buildLines, validatePriceFloor, etc.) en ./helpers.
//
// El orden de montaje es seguro: no existe ninguna ruta GET/:id "atrapa-todo",
// y las rutas con parámetro (/:id/approve, /:id/pay…) tienen distinto número de
// segmentos que las literales (/approve-and-pay, /pay-week…), así que ningún
// sub-router puede hacerle sombra a otro.
const router = require('express').Router();

router.use(require('./quotes'));       // GET /products · POST /quote
router.use(require('./register'));     // POST /report · POST /
router.use(require('./sellerPortal')); // GET /my-summary · /my-balance · /my-payments
router.use(require('./payments'));     // lotes de pago, saldos, approve-and-pay, pay-week, /:id/pay
router.use(require('./list'));         // GET / · /weekly-summary · /performance · /timeseries
router.use(require('./manage'));       // /:id/approve · /:id/reject · PUT/DELETE /:id · /:id/warranty

module.exports = router;
