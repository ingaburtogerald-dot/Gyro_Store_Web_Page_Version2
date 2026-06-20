# Gyro Store

Sistema web unificado de Gyro Store (Managua, Nicaragua): **catálogo público** +
**Centro de Administración** con portales de inventario, ventas, facturación,
reportes, logística y usuarios.

## Stack

| Capa        | Tecnología                                              |
| ----------- | ------------------------------------------------------- |
| Frontend    | Remix (React) · Tailwind CSS v4 · Redux Toolkit + RTK Query · Framer Motion · Lucide · TanStack Table · React Hook Form + Zod · dnd-kit · Recharts · Sonner |
| Backend     | Node.js · Express (CommonJS) · Zod                       |
| Datos       | Firebase Firestore · Firebase Auth (Google/Email/Microsoft) · Firebase Storage |
| Email       | Nodemailer (SMTP Gmail)                                  |
| Hosting     | Render (un Web Service sirve API + frontend buildeado)   |

## Estructura

```
gyro-store/
├── frontend/      # App Remix (TypeScript)
│   └── app/       # rutas, componentes, store (Redux), lib, hooks
├── server/        # API Express (JavaScript / CommonJS)
│   ├── routes/    # auth, config, ... (inventario/ventas/etc. por fase)
│   ├── middleware/# auth (roles), rate limiting
│   ├── services/  # email, ...
│   └── utils/     # asyncHandler, sanitize, validators (Zod)
├── render.yaml
└── .env.example
```

## Puesta en marcha (local)

1. **Variables de entorno**

   ```bash
   cp .env.example .env
   # Completar Firebase, SMTP y ADMIN_EMAILS
   ```

   Coloca el service account de Firebase en `server/serviceAccountKey.json`
   (o pega su JSON en `FIREBASE_SERVICE_ACCOUNT_JSON`).

2. **Instalar dependencias**

   ```bash
   npm install                 # backend
   cd frontend && npm install  # frontend
   ```

3. **Desarrollo** (servidor + frontend con proxy `/api`)

   ```bash
   npm run dev
   ```

   - Frontend (Vite): http://localhost:5173
   - API (Express):   http://localhost:3000/api/health

4. **Producción**

   ```bash
   npm run build   # buildea el frontend
   npm start       # Express sirve API + build
   ```

## Autenticación y roles

El backend verifica el token de Firebase y resuelve roles desde Firestore
(o desde `ADMIN_EMAILS` / `SELLER_EMAILS` para el arranque). Roles del sistema:

`global_admin` · `admin` · `seller` · `cashier` · `logistics_admin` · `logistics_customer`

El primer correo de `ADMIN_EMAILS` (o `PROTECTED_ADMIN_EMAIL`) queda como
`global_admin` protegido. Las rutas se protegen con `requireRole(...)` en el
servidor y con `<RequireRole>` en la UI (la verificación real es del lado servidor).

## Estado del proyecto

Las 8 fases están implementadas:

1. ✅ **Fundación** — scaffolding, auth (Google/Email/Microsoft), layouts.
2. ✅ **Catálogo público** — grid con filtros/búsqueda, detalle, carrito + checkout WhatsApp, contacto.
3. ✅ **Inventario** — compras China, flujo `china → pending → received`, KPIs, inventario actual.
4. ✅ **Ventas** — cotizador en vivo, comisiones (escala progresiva), aprobación FIFO, pago semanal.
5. ✅ **Facturación** — tickets POS 80mm (react-to-print), vinculación ticket ↔ venta.
6. ✅ **Reportes** — KPIs, gráficos Recharts, pérdidas, exportación Excel/PDF.
7. ✅ **Usuarios + Logística** — CRUD con papelera 30 días, Gyro Logistics con timeline y emails.
8. ✅ **Polish** — modo edición del catálogo (drag & drop, CRUD de productos, imágenes, promo), cron de limpieza.

## Checklist de despliegue (Render)

1. **Firebase**
   - Crear proyecto; habilitar **Authentication** (Google, Microsoft, Email/Password).
   - Crear **Firestore** y **Storage**; reglas que permitan lectura pública de
     imágenes del catálogo y escritura solo autenticada.
   - Generar el **service account** (JSON) para `FIREBASE_SERVICE_ACCOUNT_JSON`.
   - Copiar la **config web** a `FIREBASE_WEB_CONFIG`.
2. **Render** — crear un Web Service desde `render.yaml`; cargar las variables
   `sync: false` (Firebase, SMTP, `ADMIN_EMAILS`, `PROTECTED_ADMIN_EMAIL`, `CORS_ORIGIN`, `APP_URL`).
3. **Primer admin** — poner tu correo en `ADMIN_EMAILS`; el primero queda como
   `global_admin` protegido. Desde el portal de Usuarios se crean los demás.
4. **Build/Start** — Render ejecuta `npm install && cd frontend && npm install && npm run build`
   y arranca con `node server/index.js` (sirve API + frontend).
