---
tags: [stack, dependencias, gyro-store]
---
# Stack Tecnológico

Este proyecto utiliza tecnologías modernas y está dividido en dos partes principales.

## Frontend (Directorio `/frontend`)
- **Framework Core**: [Remix](https://remix.run/) v2.15 (SSR / Fullstack framework) + React 18.
- **Bundler**: Vite.
- **Estilos**: TailwindCSS v4 + Framer Motion (para animaciones).
- **Manejo de Estado / Datos**: React Redux (@reduxjs/toolkit) y `@tanstack/react-table` para tablas complejas.
- **Formularios**: React Hook Form + Zod (para validación) + `@hookform/resolvers`.
- **UI & Iconos**: Lucide React, Sonner (para notificaciones/toast), React Day Picker (calendarios).
- **Arrastrar y Soltar**: `@dnd-kit/core` y `sortable`.
- **Gráficos**: Recharts.
- **Utilidades**: `xlsx` (para manejo de Excel), `react-to-print` (para impresión).

## Backend (Directorio `/server` y Raíz)
- **Servidor**: Node.js v20+ con Express v4.21.
- **Integración con Remix**: `@remix-run/express` para servir la app en producción.
- **Base de Datos / Autenticación**: Firebase Admin v13 (Firestore, Auth).
- **Seguridad**: Helmet, express-rate-limit, CORS, sanitización de inputs.
- **Validación de Datos**: Zod.
- **Tareas Programadas**: node-cron (para limpiezas periódicas).
- **Emails**: Nodemailer.
- **Manejo de Archivos**: Multer.
