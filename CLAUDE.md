# CLAUDE.md — Gyro Store Monorepo

> Guía de contexto para agentes de IA y desarrolladores.
> Actualizado: julio 2026.

## Stack

| Capa | Tecnología |
|------|-----------|
| **Frontend** | Remix v2 + React 18 + Vite 5 + TypeScript 5 + Tailwind CSS 4 |
| **Server** | Express 4 (CommonJS, Node ≥ 20.19) |
| **Shared** | ESM (`.mjs`) — Zod schemas compartidos |
| **Base de datos** | Cloud Firestore (Firebase Admin en server, Firebase JS SDK en client) |
| **Storage** | AWS S3 (imágenes de productos) |
| **State mgmt** | Redux Toolkit + RTK Query |
| **Deploy** | Render (Express sirve SSR de Remix en producción) |

## Estructura del Monorepo

```
/
├── frontend/              # Remix app (TypeScript, ESM)
│   ├── app/
│   │   ├── types/         # Fuente canónica de tipos de dominio
│   │   ├── schemas/       # Zod schemas de formularios (extienden @shared/)
│   │   ├── domain/        # Lógica de negocio pura (sin React)
│   │   ├── hooks/         # Todos los React hooks custom
│   │   ├── lib/           # Utils sin estado + adaptadores externos + constantes
│   │   ├── store/         # RTK Query APIs + Redux slices
│   │   ├── components/    # React components (ui/, layout/, admin/, etc.)
│   │   ├── routes/        # Páginas Remix (file-based routing)
│   │   └── styles/        # CSS
│   ├── public/            # Assets estáticos
│   ├── eslint.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                # Express API (CommonJS)
│   ├── routes/            # Solo manejo HTTP (parseo, respuesta, errores)
│   ├── services/          # Lógica de negocio (Firestore, cálculos)
│   ├── middleware/        # Auth, rate limiting, sanitización
│   ├── utils/             # Helpers (logger, validators, pagination)
│   ├── cron/              # Tareas programadas
│   ├── config.js          # Configuración centralizada
│   ├── firebase.js        # Init Firebase Admin
│   └── index.js           # Entry point
├── shared/                # Código compartido server ↔ frontend
│   └── schemas.mjs        # Zod schemas = contrato de la API
├── scripts/               # Scripts manuales (NO son parte del runtime)
│   ├── seed/              # Seeders de datos iniciales
│   ├── migrations/        # Migraciones de datos one-shot
│   └── maintenance/       # Utilidades de mantenimiento
├── docs/                  # Documentación técnica
├── package.json           # Root: scripts dev/build/start + deps del server
└── CLAUDE.md              # ← Este archivo
```

## Alias de Importación

| Alias | Resuelve a | Dónde |
|-------|-----------|-------|
| `~/*` | `frontend/app/*` | Solo frontend (tsconfig paths) |
| `@shared/*` | `shared/*` | Solo frontend (tsconfig paths) |

El server usa rutas relativas (`require('../shared/schemas.mjs')` via `require(esm)` de Node 20.19+).

## Convenciones de Nombres

| Qué | Convención | Ejemplo |
|-----|-----------|---------|
| Componentes React | PascalCase `.tsx` | `ProductCard.tsx` |
| Hooks | camelCase con `use` prefix | `useAuth.ts` |
| Utils / lib | camelCase `.ts` / `.js` | `utils.ts`, `combo.ts` |
| Schemas Zod | camelCase con `Schema` suffix | `checkoutSchema` |
| Tipos | PascalCase | `CatalogProduct`, `CartItem` |
| Rutas Remix | kebab-case con dot-nesting | `admin.ventas.tsx` |
| Rutas Express | kebab-case | `discount-codes` |
| Server files | camelCase `.js` | `catalog.js`, `asyncHandler.js` |

## Capas del Frontend (dependencia de arriba a abajo)

```
routes/       → importa de todo
components/   → hooks, lib, store, domain, types, schemas
hooks/        → store, domain, types
store/        → types (RTK Query define payloads, re-exporta tipos de domain)
schemas/      → types, @shared/
domain/       → types (lógica pura, sin React)
lib/          → types (utils, constantes, adaptadores)
types/        → nada (fuente canónica)
```

**Regla**: una capa inferior NUNCA importa de una superior.

## Capas del Server

```
routes/       → services, utils, middleware
services/     → utils, firebase, config
middleware/   → firebase, config
utils/        → config (o nada)
```

## Comandos

```bash
# Desarrollo (server + frontend concurrentes)
npm run dev

# Solo frontend
npm run dev:frontend

# Solo server
npm run dev:server

# Typecheck (frontend)
cd frontend && npm run typecheck

# Tests (frontend)
cd frontend && npm test

# Lint (frontend)
cd frontend && npm run lint

# Format (frontend)
cd frontend && npm run format

# Build producción
npm run build

# Arrancar producción
npm start
```

## Reglas (NO commitear)

- ❌ `.env`, `.env.local` — secretos
- ❌ `serviceAccountKey.json` — credenciales Firebase
- ❌ `*.pem` — certificados
- ❌ `*.bak` — backups temporales
- ❌ Scripts one-off sueltos en raíz o dentro de `server/` — van a `scripts/`
- ❌ `node_modules/`, `build/`, `.cache/`

## Reglas de Código

- Máximo ~300–350 líneas por archivo. Si crece más → extraer subcomponentes/hooks.
- Todo primitivo UI reutilizable vive en `components/ui/`. No crear mini-design-systems en features.
- `types/` = fuente canónica de tipos de dominio. `store/api/*.ts` re-exporta, no redefine.
- `shared/schemas.mjs` = contrato API. Forms frontend extienden en `schemas/`, no redefinen.
- `domain/` = lógica pura sin React (validaciones de negocio, cálculos). Fácil de testear.
- Server `routes/` = solo HTTP. Lógica de negocio en `services/`.
