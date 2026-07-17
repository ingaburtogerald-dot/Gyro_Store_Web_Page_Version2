---
tags: [operacion, observabilidad, riesgos, gyro-store]
---
# Operación, observabilidad y riesgos

Notas operativas del despliegue en Render + Firebase + R2.

---

## Logging

- Logger estructurado sin dependencias: `server/utils/logger.js`.
  - **Producción:** una línea **JSON** por evento (`{ time, level, msg, ... }`),
    apta para los logs de Render / cualquier agregador.
  - **Desarrollo:** salida legible con icono.
  - Nivel configurable con `LOG_LEVEL` (`error|warn|info|debug`).
- Requests HTTP: `morgan('combined')` en producción se emite vía el logger; `morgan('dev')`
  en desarrollo (`server/index.js`).
- El manejador central de errores (`server/index.js`) loggea `unhandled_error` con
  método, ruta y stack, y normaliza la respuesta: `ZodError`/multer → 400,
  `err.status` explícito se respeta, resto → 500 genérico.
- **Descuadres de stock**: los fallos al liberar/restaurar reserva ahora se registran
  (`stock_release_failed`, `stock_restore_failed`) en vez de tragarse. Buscar estos
  eventos en los logs es la señal de un stock que necesita corrección manual.

## Cold starts de Render (⚠️ riesgo conocido)

- El plan **free de Render duerme** el servicio tras ~15 min de inactividad. El
  **primer request** tras dormir puede tardar **~30–50 s** (arranque del proceso).
- Impacto directo en la **primera impresión del cliente**: la primera carga del
  catálogo público la sufre.
- Además, el **caché en memoria del catálogo** (`catalogCache`) se pierde en cada
  arranque → el primer request tras despertar reconstruye el caché con lecturas extra
  a Firestore.
- **Mitigaciones posibles** (no implementadas aún, en orden de costo):
  1. Un ping externo periódico (cron-job.org / UptimeRobot) a `/api/health` cada
     ~10 min para mantener el proceso despierto. Gratis. Consume horas del plan.
  2. Subir al plan de pago de Render (sin sleep).
  3. Servir el catálogo público desde un CDN/edge cache si el tráfico crece.
- `GET /api/health` ya existe para health checks y para el ping de warm-up.

## Despliegue de reglas de Firestore

Las reglas viven en `firestore.rules` (deny-all, ver ADR-008) y se despliegan con:

```bash
firebase deploy --only firestore:rules
```

> Requiere Firebase CLI (`npm i -g firebase-tools`) y `firebase login`. **Pendiente
> de ejecutar** en este entorno (falta Node/CLI). Hasta desplegarlas, las reglas
> efectivas siguen siendo las que estén en la consola de Firebase.

## Variables de entorno críticas

Ver `.env.example`. Sin `SERVICE_ACCOUNT_PATH` o `FIREBASE_SERVICE_ACCOUNT_JSON` el
backend no arranca. R2 requiere `R2_*`. SMTP requiere `EMAIL_*`.

## Deuda técnica pendiente (priorizada)

| # | Ítem | Dónde | Prioridad |
|---|------|-------|-----------|
| 1 | Desplegar reglas Firestore deny-all | `firestore.rules` | 🔴 hacer ya |
| 2 | Migrar listados grandes a cursores | `server/utils/pagination.js` (ya existe) | 🟢 cuando el volumen lo pida |
| 3 | Roles en custom claims (quitar lectura por request) | `server/middleware/auth.js` | 🟡 cuando el costo lo justifique |
| 4 | Edición de venta en una sola transacción | `server/routes/sales/manage.js` | 🟡 bajo impacto con 1 admin |
| 5 | Script de limpieza de huérfanos en R2 | usar `storage.listFiles` | 🟢 mantenimiento |
