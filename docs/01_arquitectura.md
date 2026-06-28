---
tags: [arquitectura, gyro-store, monorepo]
---
# Arquitectura del Proyecto Gyro Store

## Resumen
Gyro Store es un sistema web unificado que contiene tanto un **catálogo público** como un **centro de administración**. 
Está estructurado como un **Monorepo** en el que un solo comando de `package.json` arranca tanto el Backend (Express) como el Frontend (Remix/Vite).

## Estructura de Carpetas

- `/server`: Contiene todo el código del backend (Node.js + Express).
  - `/server/routes`: Controladores y rutas de la API REST.
  - `/server/middleware`: Middlewares (como `rateLimiter.js` y sanitización).
  - `/server/utils`: Utilidades (ej. `sanitize.js`).
  - `/server/cron`: Tareas programadas (ej. `cleanup.js`).
  - `/server/services`: Lógica de negocio y conexión a bases de datos/Firebase.
  - `index.js`: Punto de entrada del servidor.

- `/frontend`: Contiene la aplicación web (React + Remix + Vite).
  - `/frontend/app`: Código fuente de la app web de Remix.
  - `/frontend/public`: Assets estáticos.
  - `vite.config.ts`: Configuración del bundler, configurado para proxear `/api` al servidor de Express en el puerto 3000 durante el desarrollo.

- `/scripts`: Scripts auxiliares (ej. `seedAdmin.js`, `seedTemplate.js` para inicializar la base de datos).

## Flujo de Trabajo (Dev vs Prod)
- **Desarrollo**: `npm run dev` usa `concurrently` para ejecutar `dev:server` (Express en puerto 3000) y `dev:frontend` (Vite en puerto 5173). Vite envía las llamadas `/api` al backend mediante un proxy.
- **Producción**: El servidor Express (en `server/index.js`) carga los estáticos generados en `frontend/build/client` y maneja el SSR de Remix sirviendo las vistas desde `frontend/build/server`.
