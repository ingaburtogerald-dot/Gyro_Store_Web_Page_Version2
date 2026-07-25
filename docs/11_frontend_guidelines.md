---
tags: [arquitectura, frontend, reglas, hardening]
---
# Directrices de Frontend (Hardening)

Durante la fase de limpieza y "hardening" de julio 2026, se establecieron varias reglas de oro para mantener el frontend limpio, mantenible y libre de desorden (spaghetti code).

## 1. Imports y Aliases (Path Aliases)

- **USAR SIEMPRE** el alias `~/` para cualquier importación dentro de `frontend/app`.
- **PROHIBIDO** usar rutas relativas ascendentes como `../../components/ui/Button` (salvo que sea inevitable en archivos de configuración como `vite.config.ts`).
- **USAR** `@shared/` para importar del paquete compartido (ej. schemas de Zod).
- Esto garantiza que al mover un componente, sus imports no se rompan y sean consistentes globalmente.

## 2. Re-exports (Barrel Files) Prohibidos en Componentes

- **PROHIBIDO** el uso de archivos `index.ts` que simplemente hagan "re-export" de múltiples componentes (`export * from './Button'`).
- **Razón**: Los archivos "barril" generan dependencias circulares complejas, aumentan el tamaño del bundle inicial y rompen el code-splitting (tree-shaking) de Vite en desarrollo, forzando la recarga de módulos no relacionados.
- **Solución**: Importar siempre el archivo específico: `import { Button } from "~/components/ui/Button"`.

## 3. Límite de Tamaño de Archivos

- **Regla**: Ningún componente o archivo debe exceder las **~300-350 líneas**.
- Si un componente supera este tamaño, significa que tiene demasiada responsabilidad. Se debe extraer en sub-componentes (ej. modales, items de listas, sub-formularios).
- Los subcomponentes extraídos de una página grande (ej. `admin.configuracion.tsx`) deben ubicarse en una subcarpeta dedicada (ej. `~/components/admin/config/`).

## 4. Estructura de Componentes (`~/components/`)

La carpeta `components` sigue una organización estricta por dominio/responsabilidad:

- `/ui`: Primitivas reutilizables, "dumb components" (Botones, Modales, Inputs). No conocen del estado global ni de RTK Query.
- `/layout`: Componentes estructurales de página (Header, Sidebar, AppShell, Footer, UserMenu).
- `/admin`: Subcomponentes específicos de las páginas del panel de administración (ej. CRM, Configuración, Inventario).
- `/public`: Subcomponentes específicos de las páginas públicas (Landing, Producto, Checkout).
- `/cart`: Componentes exclusivos de la funcionalidad del carrito de compras.
- `/forms`: Componentes genéricos o wrappers de formularios.

## 5. Lógica de Negocio y Hooks

- **Cero lógica compleja en UI**: La lógica de negocio pura (cálculos, ordenamientos) va en `~/domain/`.
- **Cero hooks gigantes en componentes**: Si un componente necesita orquestar llamadas a API, estado local complejo o side-effects, extraer a un custom hook en `~/hooks/`.
- Los componentes deben limitarse a orquestar UI (recibir datos, pintar).

## 6. Prohibido CJS en el Frontend

- El frontend usa ESM puro (`import/export`).
- Nunca usar `require()` en ningún archivo dentro de `frontend/app`.
- Si se necesita un paquete de Node puro, usar el Backend o crear un script aparte.
