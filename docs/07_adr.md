---
tags: [arquitectura, adr, decisiones, gyro-store]
---
# ADRs — Registro de Decisiones de Arquitectura

Decisiones cortas en formato ADR (contexto → decisión → consecuencias). Documentan
el *porqué* de la arquitectura actual, incluidas las decisiones tomadas a posteriori
durante el saneamiento de deuda técnica.

Estado: ✅ Aceptada · 🔁 Reversible · ⚠️ Con deuda conocida

---

## ADR-001 — Monolito Express que sirve API + Remix en Render ✅
**Contexto.** Un solo desarrollador, presupuesto bajo, necesidad de un catálogo
público (SSR para SEO) y un panel admin.
**Decisión.** Un proceso Express sirve `/api/*` y además hace de host del build de
Remix (SSR + estáticos) — ver `server/index.js`. Deploy único en Render.
**Consecuencias.** (+) Un solo deploy, un solo dominio, sin CORS entre front y API en
prod. (+) Costo mínimo. (−) No escala horizontalmente por separado front/back.
(−) El caché en memoria vive por instancia. ⚠️ Ver ADR-007 (cold starts).

## ADR-002 — Firestore (plan Spark) como base de datos ✅ ⚠️
**Contexto.** Sin equipo de infra; se quiere una BD gestionada con auth integrada.
**Decisión.** Firestore + Firebase Auth. El backend usa el Admin SDK.
**Consecuencias.** (+) Cero administración de servidores de BD; auth lista. (+) Tiempo
real disponible si se necesita. (−) Modelo NoSQL: hay que modelar por patrón de acceso.
(−) ⚠️ Límites de lectura diarios en Spark → obliga a cachear el catálogo y vigilar
los `.get()` de colección completa (ver `05_modelo_datos_firestore`).

## ADR-003 — El cliente NUNCA accede a Firestore directo; todo por el backend ✅
**Contexto.** Exponer Firestore al navegador obliga a escribir toda la lógica de
seguridad y validación en reglas de Firestore, difíciles de testear.
**Decisión.** El frontend solo usa Firebase **Auth**. Toda lectura/escritura de datos
pasa por endpoints Express que validan, autorizan y recalculan en el servidor.
**Consecuencias.** (+) Lógica de negocio y validación centralizada y testeable en Node.
(+) Los precios/totales/costos nunca se confían al cliente. (−) Todo el tráfico de
datos pasa por el server (un punto de carga). Habilita ADR-008 (reglas deny-all).

## ADR-004 — Checkout manual por WhatsApp (no pasarela de pago) ✅ 🔁
**Contexto.** Mercado local (Nicaragua), pagos por transferencia/efectivo, relación
directa por WhatsApp. Integrar pasarela añade costo y fricción.
**Decisión.** El catálogo arma el pedido, recalcula el total en servidor
(`POST /api/orders/public`) y genera un **link de WhatsApp** con el detalle. El cierre
y el cobro son manuales; luego se registra la venta en el panel, que descuenta stock.
**Consecuencias.** (+) Cero comisiones de pasarela; se adapta al comportamiento real
del cliente. (+) Control humano antes de comprometer inventario. (−) No hay captura de
pago automática; el registro de venta es un paso manual. (−) Doble entrada de datos
posible (pedido público vs. venta registrada). 🔁 Reversible si se añade pasarela.

## ADR-005 — Cloudflare R2 para imágenes (no Firebase Storage) ✅
**Contexto.** Firebase Storage en Spark tiene límites y egress con costo.
**Decisión.** Imágenes en R2 vía API S3 (`@aws-sdk/client-s3`), optimizadas con Sharp
a WebP y nombradas por hash de contenido (`server/services/storage.js`).
**Consecuencias.** (+) Egress barato/gratis en R2; bucket público con CDN. (+) Nombres
por hash → subidas idempotentes, sin duplicados. (−) Otra credencial/servicio que
gestionar. (−) La limpieza de huérfanos es responsabilidad del backend (ver ADR-009).

## ADR-006 — Autorización por roles resueltos en cada request (sin custom claims) ⚠️
**Contexto.** Se necesita distinguir admin/seller/cashier/logística. Firebase permite
custom claims (en el token) o resolver contra la BD.
**Decisión.** Los roles se resuelven por request: whitelist por variables de entorno
y, si no, el doc de `users` en Firestore (`server/middleware/auth.js`).
**Consecuencias.** (+) Cambios de rol tienen efecto inmediato (no hay que refrescar el
token). (+) Arranque sin depender de Firestore (whitelist env). (−) ⚠️ Una lectura de
`users` por request autenticado (ya deduplicada de 2→1). **Deuda:** migrar a custom
claims eliminaría esa lectura; se difiere hasta que el costo lo justifique.

## ADR-007 — Reservar-luego-consumir stock en dos pasos con transacciones ✅
**Contexto.** El cierre de venta es manual (humano), pero el stock no puede sobrevenderse.
**Decisión.** Al **registrar** la venta se **reserva** stock (`quantityReserved`) dentro
de `runTransaction`; al **aprobar** se **consume** (reserved→sold) en otra transacción.
Rechazo/eliminación liberan o devuelven stock.
**Consecuencias.** (+) La verificación `available ≥ q` y la escritura son atómicas → sin
sobreventa por concurrencia. (+) El stock queda "apartado" mientras el admin decide.
(−) La edición de una venta (liberar viejas → reservar nuevas) no es una única
transacción: ventana pequeña, mitigada por logging (deuda conocida, bajo impacto con 1 admin).

## ADR-008 — Reglas de Firestore deny-all, versionadas ✅
**Contexto.** No existía `firestore.rules` en el repo; las reglas vivían solo en la
consola, sin versionar. Cualquier usuario logueado con un ID token válido podría, con
el SDK cliente, pegarle directo a Firestore si las reglas estuvieran abiertas.
**Decisión.** `firestore.rules` con `allow read, write: if false;` versionado y
referenciado en `firebase.json`. Como el cliente nunca accede directo (ADR-003) y el
Admin SDK ignora las reglas, deny-all no rompe nada.
**Consecuencias.** (+) Cierra por completo el acceso directo del cliente a los datos.
(+) Reglas versionadas y desplegables (`firebase deploy --only firestore:rules`).
(−) Si algún día el front necesitara leer Firestore directo, hay que abrir rutas puntuales.

## ADR-009 — Limpieza de imágenes huérfanas en R2 al eliminar ✅
**Contexto.** `DELETE` de catálogo y de venta no borraban las imágenes de R2 →
almacenamiento huérfano acumulado (costo).
**Decisión.** `DELETE /catalog/:id` borra todas las imágenes del producto; `DELETE`
de venta borra recibo y screenshot de pago. Borrado best-effort con log en fallo.
**Consecuencias.** (+) Se detiene la fuga de almacenamiento. (−) El borrado no es
transaccional con Firestore (si el borrado en R2 falla, queda un huérfano registrado
en logs para limpieza posterior con `storage.listFiles`).

## ADR-010 — Validación con Zod + `fileFilter` en subidas ✅
**Contexto.** Las rutas de venta parseaban `items` a mano; los `multer` no validaban
el tipo de archivo (cualquier archivo llegaba a R2).
**Decisión.** Schema Zod para los ítems de venta (`saleItemsSchema`) y un `multer`
centralizado con `fileFilter` de mimetype (`server/utils/upload.js`; imagen, o
imagen/PDF para logística). Errores de subida → HTTP 400 en el handler central.
**Consecuencias.** (+) Entrada validada declarativamente y de forma consistente.
(+) Nada que no sea imagen (o PDF donde aplica) llega a R2. (−) Ninguna relevante.
