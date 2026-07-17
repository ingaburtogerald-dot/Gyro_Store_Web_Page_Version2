---
tags: [changelog, deuda-tecnica, hardening, gyro-store]
---
# Changelog — Saneamiento de deuda técnica

Registro de los cambios aplicados en la ronda de code review de arquitectura.
Todos son **incrementales**: no hubo reescrituras. El flujo de inventario
(transacciones FIFO) se conservó intacto.

## Seguridad

| Cambio | Archivos | ADR |
|--------|----------|-----|
| Reglas de Firestore **deny-all** versionadas y referenciadas | `firestore.rules` (nuevo), `firebase.json` | ADR-008 |
| `fileFilter` de mimetype en TODAS las subidas (imagen / PDF) | `server/utils/upload.js` (nuevo); `routes/{auth,catalog,logistics}.js`, `routes/sales/helpers.js` | ADR-010 |
| Validación **Zod** de los ítems de venta (antes `JSON.parse` a mano) | `server/utils/validators.js` (`saleItemsSchema`); `routes/sales/{register,manage}.js` | ADR-010 |

## Consistencia de datos y costo

| Cambio | Archivos |
|--------|----------|
| Lectura del doc de usuario **1 vez por request** (antes 2) al autorizar | `server/middleware/auth.js` |
| **Borrado de imágenes huérfanas en R2** al eliminar producto y al eliminar venta | `routes/catalog.js` (DELETE), `routes/sales/manage.js` (DELETE) — ADR-009 |
| **Paginación por cursor** (`startAfter`) reutilizable, aplicada opt-in en pedidos públicos | `server/utils/pagination.js` (nuevo); `routes/orders.js` |

## Observabilidad

| Cambio | Archivos |
|--------|----------|
| **Logger estructurado** (JSON en prod, legible en dev, niveles por `LOG_LEVEL`) | `server/utils/logger.js` (nuevo) |
| `morgan` de requests activo también en **producción** | `server/index.js` |
| Manejador central de errores mejorado: respeta `err.status`, mapea Zod/multer → **400** | `server/index.js` |
| Fallos de stock ahora se **registran** (`stock_release_failed`, `stock_restore_failed`) en vez de tragarse | `routes/sales/manage.js`, `routes/sales/helpers.js` |

## Archivos nuevos
```
firestore.rules
server/utils/upload.js
server/utils/logger.js
server/utils/pagination.js
docs/04_diagramas_secuencia.md
docs/05_modelo_datos_firestore.md
docs/06_maquinas_estado.md
docs/07_adr.md
docs/08_operacion_y_riesgos.md
docs/09_diagrama_arquitectura.md
docs/10_changelog_hardening.md
```

## Pendientes operativos (no de código)
- **Desplegar** las reglas: `firebase deploy --only firestore:rules` (hasta hacerlo,
  rigen las reglas de la consola). Ver `08_operacion_y_riesgos.md`.
- **Nota de entorno:** durante la verificación se detectó que el service account key
  anterior estaba revocado (`UNAUTHENTICATED`); se reemplazó por una llave nueva en
  `server/serviceAccountKey.json`. No fue un cambio de código.
