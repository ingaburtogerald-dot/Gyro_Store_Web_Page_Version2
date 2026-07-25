# CLAUDE.md — Server (Express)

> Convenciones específicas del backend. Ver también `../CLAUDE.md` para contexto global.

## Stack

- **Express 4** (CommonJS — `require`/`module.exports`)
- **Node ≥ 20.19** (soporta `require(esm)` para consumir `shared/schemas.mjs`)
- **Firebase Admin** (Firestore, Auth)
- **AWS S3** (storage de imágenes — via `@aws-sdk/client-s3`)
- **Zod** (validación de payloads)
- **Nodemailer** (envío de correos)
- **Sharp** (procesamiento de imágenes)
- **node-cron** (tareas programadas)

## Estructura

```
server/
├── index.js           # Entry point: middleware, rutas, arranque
├── config.js          # Configuración centralizada (env vars, constantes)
├── firebase.js        # Init Firebase Admin SDK
├── routes/            # Solo manejo HTTP
│   ├── auth.js
│   ├── catalog.js
│   ├── sales/         # Ejemplo modular (index, list, manage, payments…)
│   └── ...
├── services/          # Lógica de negocio (Firestore queries, cálculos)
│   ├── sales.js
│   ├── inventory.js
│   ├── email.js
│   └── ...
├── middleware/         # Auth guard, rate limiter
│   ├── auth.js
│   └── rateLimiter.js
├── utils/             # Helpers puros
│   ├── validators.js  # Zod schemas server-only
│   ├── asyncHandler.js
│   ├── logger.js
│   ├── pagination.js
│   ├── sanitize.js
│   ├── upload.js
│   └── zodError.js
└── cron/
    └── cleanup.js
```

## Capas

```
routes/     → services, utils, middleware, validators
services/   → firebase, config, utils
middleware/ → firebase, config
utils/      → config (o standalone)
```

**Regla**: `routes/` = solo HTTP (parsear request, llamar service, formatear response, manejar errores).
Toda lógica de negocio vive en `services/`.

## Convenciones

### Archivos
- Un router por recurso. Si un recurso tiene muchas operaciones → subdirectorio con `index.js` (como `routes/sales/`).
- `camelCase.js` para todos los archivos.

### Rutas
- `router.get/post/put/patch/delete` — verbos HTTP semánticos.
- Siempre wrappear handlers async con `asyncHandler()`.
- Validar payloads con Zod al inicio del handler (antes de llamar al service).
- Responder con JSON consistente: `{ data }` para éxito, `{ error }` para fallo.

### Validación
- **`utils/validators.js`** = schemas Zod que solo necesita el server.
- **`shared/schemas.mjs`** = schemas compartidos con frontend (contrato API).
- Server consume shared via: `const { lossApiSchema } = require('../shared/schemas.mjs');`

### Errores
- Zod errors se atrapan en el manejador central (`index.js`) → 400.
- Errores con `status` explícito se respetan.
- Todo lo demás → 500 con mensaje genérico (no filtrar detalles internos).

### Firebase
- `const { db, auth, admin } = require('../firebase');`
- Transacciones/batches para operaciones atómicas.
- Nunca confiar en datos del cliente para precios/stock — siempre recalcular desde Firestore.

## Comandos

```bash
# Desarrollo (con watch)
npm run dev:server
# equivale a: cross-env NODE_ENV=development node --watch-path=server --watch-path=shared server/index.js

# Producción
npm start
# equivale a: cross-env NODE_ENV=production node server/index.js

# Health check
curl http://localhost:3000/api/health
```
