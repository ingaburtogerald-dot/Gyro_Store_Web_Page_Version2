---
tags: [api, backend, rutas, gyro-store]
---
# Rutas API del Backend

Todas las rutas de la API están bajo el prefijo `/api` y son manejadas por el servidor Express ubicado en `server/index.js`. 
Si una ruta no es API, es enviada al build de Remix para Server-Side Rendering (SSR).

El punto de salud de la API es: `GET /api/health`

## Endpoints Registrados
- `/api/auth`: Manejo de autenticación.
- `/api/config`: Configuración global o del sitio.
- `/api/catalog`: Obtención y manejo de productos para el catálogo público.
- `/api/templates`: Manejo de plantillas del sistema.
- `/api/orders`: Gestión de pedidos/órdenes.
- `/api/contact`: Formulario de contacto o mensajes de soporte.
- `/api/inventory`: Gestión del stock y bodegas (solo admin).
- `/api/sales`: Registro y manejo de ventas (solo admin).
- `/api/invoices`: Generación de facturas o comprobantes.
- `/api/reports`: Generación de reportes de negocio (gráficas, Excel).
- `/api/users`: Gestión de usuarios del sistema (solo admin).
- `/api/logistics`: Rastreo y logística de entregas.
- `/api/installments`: Cuotas o métodos de pago fraccionados.
- `/api/followups`: Seguimientos de clientes o leads.

## Manejo de Errores
Cualquier error de validación detectado por `Zod` (la librería de validación del backend) devuelve automáticamente un HTTP 400 con un JSON estructurado bajo la llave `issues`.
Cualquier otro error interno devuelve HTTP 500.
