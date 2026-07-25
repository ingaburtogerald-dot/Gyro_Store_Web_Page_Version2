# CLAUDE.md — Frontend (Remix)

> Convenciones específicas del frontend. Ver también `../CLAUDE.md` para contexto global.

## Stack

- **Remix v2** con Vite 5 (file-based routing, SSR)
- **React 18** + **TypeScript 5** (strict mode)
- **Tailwind CSS 4** (via `@tailwindcss/vite`)
- **Redux Toolkit** + **RTK Query** (state management + API cache)
- **React Hook Form** + **Zod** (formularios)
- **Framer Motion** (animaciones)
- **Lucide React** (iconos)
- **Recharts** (gráficos)
- **react-day-picker** v10 (calendario)

## Alias

```
~/*       → app/*          (todo el código fuente)
@shared/* → ../shared/*    (schemas compartidos con server)
```

Configurados en `tsconfig.json` (paths) y resueltos por `vite-tsconfig-paths`.

## Arquitectura de Capas

```
app/
├── types/         → Fuente canónica de interfaces/tipos de dominio
├── schemas/       → Zod schemas de formularios (extienden @shared/ donde aplique)
├── domain/        → Lógica de negocio PURA (sin React, sin side effects)
│   ├── sales/     → salesCalculations.ts, salesValidators.ts
│   └── reports/   → inventorySorter.ts, recordSummary.ts
├── hooks/         → TODOS los React hooks custom
│   ├── useAuth.ts, useTheme.ts, useMediaQuery.ts, useCatalogFilter.ts ...
│   ├── sales/     → useAdminSaleActions.ts, useSellerSales.ts
│   └── reports/   → useExpenseActions.ts, useLossActions.ts
├── lib/           → Utils sin estado + adaptadores externos + constantes (Cero React Hooks)
│   ├── firebase.client.ts  (adaptador)
│   ├── utils.ts, constants.ts, categories.ts ...
│   └── combo.ts   (conversión combo → cart item)
├── store/         → RTK Query + Redux slices
│   ├── api/       → Un archivo por recurso API (catalogApi, salesApi, etc.)
│   ├── slices/    → UI state, cart, etc.
│   ├── store.ts   → Configuración del store
│   └── hooks.ts   → useAppSelector, useAppDispatch tipados
├── components/    → React components organizados por feature
│   ├── ui/        → Primitivos reutilizables (Button, Modal, DatePicker, DataTable…)
│   ├── layout/    → AppShell, PublicHeader, Footer, etc.
│   ├── admin/     → Componentes del panel de administración
│   ├── catalog/   → Componentes del catálogo público
│   ├── cart/      → Carrito de compras
│   ├── product/   → Página de detalle de producto
│   ├── filters/   → Filtros del catálogo
│   ├── auth/      → Login, guards
│   ├── seller/    → Portal del vendedor
│   └── shared/    → Componentes compartidos entre features
├── routes/        → Páginas Remix (dot-nested flat routing)
└── styles/        → CSS global + tokens
```

## Reglas

### Archivos
- **Máx ~300–350 líneas** por archivo. Si crece → extraer subcomponentes, hooks, o utils.
- Un componente por archivo. El archivo se llama como el componente (PascalCase).

### Tipos
- **`types/`** = fuente canónica. Un archivo por dominio (`catalog.ts`, `cart.ts`).
- **`store/api/*.ts`** importa de `~/types/` y solo define payloads, tags, y response shapes propias de RTK Query.
- No redefinir interfaces de dominio en archivos de API.

### Schemas
- **`@shared/schemas.mjs`** = contrato API (verdad compartida server ↔ frontend).
- **`schemas/`** = Zod schemas de formularios del cliente. Extienden shared, nunca redefinen campos comunes.
- **`domain/*/validators.ts`** = validaciones de reglas de negocio puras (no Zod). Retornan datos, no lanzan.

### Componentes
- **`components/ui/`** = ÚNICO lugar para primitivos reutilizables.
- No crear mini-design-systems dentro de features (ej. no `admin/reports/_shared/MonthPicker`).
- Si un componente se usa en 2+ features → sube a `ui/`.

### Hooks
- **Todos** los hooks custom viven en `hooks/` (con subdirectorios por dominio si aplica).
- `lib/` NO debe contener hooks (nada con `use*` que dependa de React).

### Imports
- Usar alias `~/` siempre. Nunca imports relativos que crucen más de un nivel (`../../`).
- Orden: react → libs externas → ~/types → ~/lib → ~/store → ~/hooks → ~/components → ./local

## Comandos

```bash
npm run dev          # Remix dev server (Vite HMR)
npm run build        # Build producción
npm run typecheck    # tsc --noEmit
npm run test         # vitest run
npm run test:watch   # vitest (watch mode)
npm run lint         # ESLint
npm run lint:fix     # ESLint + auto-fix
npm run format       # Prettier write
npm run format:check # Prettier check (CI)
```
