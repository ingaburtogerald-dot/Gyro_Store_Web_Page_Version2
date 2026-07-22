---
tags: [saas, multi-tenant, action-plan, gyro-marketplace, roadmap]
---
# Action Plan — De Gyro Store (mono-tienda) a Gyro Marketplace (SaaS multi-tenant)

> Documento de **ideas y decisiones**, no de código. Sirve como índice maestro:
> cada módulo listado aquí se documentará después en su propia nota para pensar su
> lógica interna y cómo se conecta con los demás.
>
> Convención: 🎯 = objetivo · ⚠️ = limitante/riesgo a resolver · ❓ = decisión que tú
> debes tomar antes de construir · 🔧 = cambio sobre código existente · ✨ = módulo nuevo.

---

## 0. Punto de partida — qué tengo HOY (diagnóstico honesto)

Antes de sumar, hay que ver con claridad de dónde parto. El código actual es
**excelente para una sola tienda**, y ese es exactamente el punto que hay que
"abrir".

### Lo que ya existe y sirve como activo
- **Storefront público**: catálogo con filtros/búsqueda, ficha de producto con
  variantes, combos, carrito → checkout por WhatsApp.
- **Back-office completo** (8 fases ya implementadas): inventario (flujo China→
  pending→received, FIFO), ventas (cotizador, comisiones progresivas, aprobación,
  pago semanal), facturación POS 80mm, reportes (Recharts + export Excel/PDF),
  logística con timeline y emails, CRM ligero (contactos, seguimientos), cuotas,
  códigos de descuento, gestión de usuarios con papelera 30 días.
- **Buenas decisiones de arquitectura ya tomadas**: el cliente NUNCA lee Firestore
  directo (todo pasa por el backend con Admin SDK; reglas `deny-all`), caché de
  catálogo en memoria, roles server-side, sanitización con Zod, rate limiting.

### Los 3 supuestos "mono-tienda" que hay que romper
Estos tres son la raíz de casi todo el trabajo del SaaS:

1. ⚠️ **Datos sin dueño.** Todas las colecciones son **planas y globales**
   (`PRODUCTS`, `ORDERS`, `INVOICES`, `PURCHASES`, `CATALOG`, `USERS`…). No hay un
   campo que diga "esto es del negocio X". Hoy *todo* el dato ES de Gyro Store.
2. ⚠️ **Identidad por lista blanca.** Los permisos salen de `ADMIN_EMAILS` /
   `SELLER_EMAILS` en variables de entorno + un doc `users` único. No hay registro
   self-service ni concepto de "usuario que pertenece a un negocio".
3. ⚠️ **Configuración única.** Hay UN branding, UN WhatsApp, UNA moneda, UNA regla
   de comisiones, UNA numeración de facturas. Todo hardcodeado a Gyro Store.

### El insight que ordena todo el plan
El código de hoy son **dos productos fusionados**. Al volverse SaaS, se separan en
**tres audiencias/superficies** distintas:

| Superficie | Quién la usa | Qué es hoy | Qué será |
|---|---|---|---|
| **Marketplace público** | Compradores finales | El storefront de Gyro Store | Vitrina compartida donde publican TODOS los negocios |
| **Panel del negocio (tenant)** | Cada dueño de tienda | El `/admin` de Gyro Store | El mismo back-office, pero aislado por negocio |
| **Panel de plataforma** | Yo (dueño del SaaS) | No existe | Super-admin: alta de negocios, planes, cobros, moderación |

Todo el resto del documento cuelga de esta separación.

---

## 1. Decisiones fundacionales (❓ resolver ANTES de tocar código)

Estas decisiones condicionan todo. No se puede empezar a construir sin contestarlas.

### 1.1 ❓ Modelo de negocio (¿cómo gano dinero?)
De esto depende medio producto (billing, límites, checkout). Opciones:
- **Suscripción mensual** (SaaS puro): cada negocio paga un plan por usar las
  herramientas. Simple, ingreso predecible. No necesito tocar el dinero de sus ventas.
- **Comisión por venta**: cobro un % de lo que venden. Implica que el dinero pase por
  la plataforma → necesito pasarela de pago y payouts (mucho más complejo, legal-pesado).
- **Freemium / híbrido**: plan gratis limitado + planes de pago; quizá comisión solo
  si uso el checkout centralizado.
- 💡 Recomendación para arrancar: **suscripción mensual con plan free limitado**. Evita
  manejar dinero ajeno (lo más riesgoso legal y técnicamente) en la v1.

### 1.2 ❓ ¿Qué ES "el marketplace" exactamente?
- **Opción A — Vitrina compartida (marketplace real):** una sola web donde el comprador
  ve productos de muchas tiendas mezclados, busca, compara. Más valor para el comprador,
  más complejo (búsqueda cross-tenant, ranking, moderación fuerte).
- **Opción B — Microsites (SaaS de tiendas):** cada negocio tiene su propia tienda
  (`gyromarketplace.com/mitienda` o `mitienda.gyro.com`). No hay mezcla. Es más un
  "Shopify" que un "Amazon". Más simple, más control para cada dueño.
- **Opción C — Híbrido:** cada quien tiene su microsite Y además aparece en un
  directorio/vitrina común opcional.
- 💡 Esta decisión cambia radicalmente el módulo de "Marketplace público" (§4). Definirla
  temprano evita rehacer.

### 1.3 ❓ Estrategia de aislamiento de datos (multi-tenancy)
Cómo separo los datos de cada negocio en Firestore. Tres patrones:

| Patrón | Cómo | Pros | Contras |
|---|---|---|---|
| **A. Campo `tenantId`** en colecciones planas | `orders` con `tenantId` + `where('tenantId','==',X)` | Menor cambio de estructura | ⚠️ Un bug de scope filtra datos entre negocios (grave: costos/utilidades). Todos los índices necesitan `tenantId`. |
| **B. Subcolecciones por tenant** | `tenants/{tid}/orders/...` | Aislamiento natural, difícil filtrar mal | Reescribir todas las rutas de acceso; colección-group queries para lo global |
| **C. Base/proyecto por tenant** | Un Firestore por negocio | Aislamiento máximo | Costoso, complejo de operar, no escala a muchos negocios pequeños |
| 💡 Recomendación | **B (subcolecciones) para datos de negocio + una capa de contexto de tenant obligatoria en el backend.** Da aislamiento fuerte con costo operativo razonable. |

⚠️ **Regla de oro no negociable:** ninguna consulta al backend debe poder ejecutarse sin
un `tenantId` resuelto. El aislamiento se vuelve un *middleware*, no una responsabilidad
de cada ruta (si depende de que cada ruta "se acuerde" de filtrar, tarde o temprano una
se olvida y filtra datos entre negocios).

### 1.4 ❓ Enrutamiento e identidad de cada tienda
- ¿Subdominios (`mitienda.gyro.com`), subpaths (`gyro.com/mitienda`), o dominios propios
  (`mitienda.com`)?
- 💡 Arrancar con **subpath o subdominio** (más simple); dominios propios como feature
  premium más adelante (implica SSL automático, verificación DNS).

---

## 2. Módulos — Bloque A: Fundación multi-tenant
> Sin esto no hay SaaS. Es la base sobre la que se adapta todo lo demás.

### ✨ M1 — Modelo de Tenant y contexto de aislamiento
🎯 Introducir la entidad "Negocio/Tenant" y garantizar que todo dato y toda request
sepan a qué negocio pertenecen.
- Nueva colección raíz `tenants/{tenantId}` (nombre, slug, estado, plan, dueño, fechas).
- Middleware de resolución de tenant: de subdominio/subpath/JWT → `tenantId` → inyectado
  en cada request. **Ninguna operación de datos sin tenant.**
- 🔧 Refactor de `server/config.js → collections`: pasar de rutas planas a rutas
  scopeadas por tenant.
- 🔧 Refactor del caché de catálogo (hoy global en memoria) → caché **por tenant**
  (ver ⚠️ en §6).

### 🔧 M2 — Identidad, cuentas y membresías
🎯 Reemplazar la whitelist de correos por un modelo de usuarios que pertenecen a negocios.
- Un usuario puede pertenecer a 1+ negocios con un rol en cada uno (membresía =
  `{ userId, tenantId, roles }`).
- Separar **rol de plataforma** (yo, super-admin) de **roles dentro del tenant**
  (admin, seller, cashier, logistics…). Hoy están mezclados en un solo array de roles.
- 🔧 Reescribir `server/middleware/auth.js`: hoy resuelve rol por email global; debe
  resolver rol **en el contexto del tenant actual**.
- 💡 Mover roles a **custom claims** de Firebase (ya está anotado como pendiente en
  `05_modelo_datos`) para no leer `users` en cada request — más crítico aún con multi-tenant.

### ✨ M3 — Onboarding / registro self-service de negocios
🎯 Que un dueño de tienda se registre solo, cree su negocio y empiece, sin que yo toque nada.
- Flujo: registro → crear negocio (nombre, slug único, categoría, moneda, WhatsApp) →
  seed inicial (config por defecto, catálogo vacío, roles) → tour.
- ⚠️ Validación de slug único, reserva de nombres, anti-abuso (evitar registros basura).
- Estados del tenant: `trial` → `active` → `suspended` → `cancelled`.

### ✨ M4 — Enrutamiento, dominios y resolución de tienda
🎯 Que cada tienda sea alcanzable por su URL y que el backend sepa de quién es el request.
- 🔧 El frontend Remix hoy tiene rutas fijas (`_index`, `admin.*`); necesita segmento de
  tenant o detección por host.
- Manejo de dominio raíz (marketplace) vs. dominio/subdominio de tienda vs. panel de plataforma.

---

## 3. Módulos — Bloque B: Monetización y gobierno de la plataforma
> Lo que convierte "software multi-tienda" en "negocio SaaS".

### ✨ M5 — Planes, suscripciones y facturación del SaaS
🎯 Cobrar a los negocios por usar la plataforma.
- Definición de planes (free/pro/…), ciclo de cobro, pruebas, upgrades/downgrades.
- ❓ Pasarela: ¿qué acepta pagos en Nicaragua/región? (tarjeta internacional, transferencia,
  billeteras). ⚠️ Limitante real de mercado local — investigar temprano.
- Estados de suscripción → afectan acceso (impago = degradar a solo lectura, no borrar datos).

### ✨ M6 — Límites de uso, cuotas y feature flags por plan
🎯 Que el plan free tenga techo y que features premium se activen/desactiven.
- Límites: nº de productos, usuarios, almacenamiento de imágenes, pedidos/mes.
- ⚠️ Los límites protegen también **mis costos de Firebase/R2** (un tenant no puede
  hacerme explotar la factura). Ligar cuotas a costo real de infra.
- Feature flags por plan (ej. reportes avanzados, dominio propio, logística solo en pro).

### ✨ M7 — Panel de plataforma (super-admin)
🎯 Mi centro de control como dueño del SaaS.
- Alta/baja/suspensión de negocios, ver métricas globales, gestionar planes, soporte,
  impersonar un tenant para dar soporte (con auditoría), ver salud del sistema.
- Es un panel **nuevo**, separado del `/admin` de cada tenant.

### ✨ M8 — Moderación, confianza y calidad de contenido
🎯 Que lo publicado en el marketplace no me meta en problemas.
- Revisión/aprobación de tiendas o productos nuevos, reportes de abuso, baneo,
  detección de contenido prohibido.
- ⚠️ Si es vitrina compartida (§1.2 opción A), la moderación es **crítica** — mi marca
  responde por lo que publican terceros. Si son microsites aislados, es más ligera.

---

## 4. Módulos — Bloque C: El Marketplace público (superficie nueva)
> Depende 100% de la decisión §1.2. Aquí asumo que hay al menos vitrina + página de tienda.

### ✨ M9 — Discovery / catálogo unificado
🎯 Que un comprador encuentre productos across tiendas (si aplica opción A/C).
- Búsqueda y filtros **cross-tenant** → ⚠️ requiere consultas de grupo de colección o,
  mejor, un **índice de búsqueda dedicado** (el patrón actual de "traer toda la colección
  y filtrar en memoria" NO escala a N tiendas).
- Ranking, destacados, categorías globales, homepage del marketplace.

### 🔧 M10 — Página/storefront de cada tienda
🎯 La vitrina individual de cada negocio (reutiliza el storefront actual, con branding propio).
- 🔧 Parametrizar branding, logo, colores, WhatsApp, textos por tenant (hoy es fijo Gyro).
- Reutiliza casi todo el storefront existente → **alto reúso**, es el módulo más barato.

### ✨ M11 — Carrito y checkout multi-tienda
🎯 Cómo compra el cliente final.
- ❓ ¿Sigue siendo checkout por WhatsApp (cada tienda su número) o checkout centralizado
  con pago en la plataforma?
- ⚠️ Si un carrito mezcla productos de varias tiendas, el checkout debe **separar por
  tienda** (cada una despacha y cobra lo suyo). El carrito actual asume una sola tienda.
- 💡 Arrancar manteniendo **WhatsApp por tienda** (cero manejo de dinero) alinea con §1.1.

---

## 5. Módulos — Bloque D: Adaptar las herramientas actuales a multi-tenant
> Aquí no invento; **adapto** lo que ya funciona para que viva por-tenant. Patrón común:
> agregar contexto de tenant + hacer configurable lo que hoy está hardcodeado.

Para cada uno el trabajo es el mismo patrón (scope por tenant + config por tenant), así
que los agrupo. La complejidad varía por cuánta lógica de negocio "asume Gyro" cada uno.

| # | Módulo | Ruta/servicio actual | Trabajo principal de adaptación | Dificultad |
|---|---|---|---|---|
| 🔧 M12 | **Catálogo/Productos** | `routes/catalog.js`, `templates.js`, `combos.js` | Scope por tenant + caché por tenant | Media |
| 🔧 M13 | **Inventario** | `routes/inventory.js`, `services/inventory.js` | Scope por tenant; flujo "China→NI" quizá no aplica a otros negocios → hacerlo **opcional/configurable** | Media-alta |
| 🔧 M14 | **Ventas y comisiones** | `routes/sales/`, `services/commission.js`, `sales.js` | ⚠️ Las reglas de comisión progresiva son de Gyro; cada negocio necesita **sus propias reglas** → mover a config por tenant | Alta |
| 🔧 M15 | **Facturación POS** | `routes/invoices.js`, `services/invoice.js` | ⚠️ Numeración de facturas: **contador por tenant** (hoy `counters` es global). Formato/datos fiscales por negocio | Media |
| 🔧 M16 | **Reportes** | `routes/reports.js`, `services/reports.js` | Scope por tenant; nada de datos cruzados entre negocios | Media |
| 🔧 M17 | **Logística** | `routes/logistics.js` | Scope por tenant; probablemente feature premium/opcional | Media |
| 🔧 M18 | **CRM / Contactos / Seguimientos** | `routes/contacts.js`, `followups.js` | Scope por tenant | Baja-media |
| 🔧 M19 | **Cuotas / Códigos descuento / Feedback** | `routes/installments.js`, `discountCodes.js`, `feedback.js` | Scope por tenant | Baja |
| 🔧 M20 | **Configuración del negocio** | `routes/config.js` | Se vuelve **la config del tenant**: branding, moneda, WhatsApp, reglas de comisión, datos fiscales, feature toggles | Alta (es el corazón de la personalización) |

⚠️ **Nota transversal de este bloque:** varias herramientas asumen la *realidad de Gyro*
(importación de China, tipo de cambio USD, comisiones progresivas, pago semanal). Para el
SaaS hay que decidir por cada una: ¿es **universal** (todos la usan igual), **configurable**
(cada quien la ajusta), u **opcional** (solo algunos negocios la activan)? Esa clasificación
es media documentación de cada módulo.

---

## 6. Módulos — Bloque E: Transversales (cross-cutting)

### 🔧 M21 — Almacenamiento de imágenes (Cloudflare R2) multi-tenant
- Namespacing de objetos por tenant (`tenants/{tid}/...`), cuotas de storage por plan,
  limpieza al cancelar. ⚠️ Contabilizar uso por tenant para límites y costos.

### 🔧 M22 — Email y notificaciones por tenant
- ⚠️ Hoy hay UN SMTP (Gmail de Gyro). Multi-tenant necesita: remitente por tenant o
  remitente de plataforma con branding por tenant, plantillas por negocio, y no mezclar
  correos entre tiendas. Considerar proveedor transaccional (deliverability a escala).

### 🔧 M23 — Roles y permisos (rework profundo)
- Modelo de permisos de dos niveles: **plataforma** (super-admin) + **tenant** (roles del
  negocio). ⚠️ `global_admin` actual da acceso total — en SaaS eso NO puede cruzar tenants.
- Reescribir `requireRole(...)` → `requireTenantRole(tenantId, ...)`.

### ✨ M24 — Observabilidad, auditoría y seguridad de aislamiento
- Logs y métricas **por tenant**, auditoría de accesos (sobre todo del super-admin
  impersonando), y **tests de aislamiento** (probar activamente que el tenant A no puede
  leer datos del tenant B). ⚠️ Esto es lo que evita el peor escenario: fuga de datos entre
  negocios (costos, clientes, utilidades).

### ✨ M25 — Migración de datos: Gyro Store → primer tenant
- 🎯 Gyro Store real se convierte en el **tenant #0**. Migrar sus colecciones planas
  actuales a la estructura por-tenant sin downtime y sin perder historial.
- Es a la vez la primera migración y la prueba de fuego del modelo de datos nuevo.

---

## 7. Limitantes y riesgos a resolver (checklist para no olvidar)

- [ ] ⚠️ **Fuga de datos entre tenants** — el riesgo #1. Aislamiento como middleware +
  tests activos, no como buena intención por ruta.
- [ ] ⚠️ **Costos de Firebase/R2 que escalan con tenants** — el patrón actual de "leer
  colección completa y filtrar en memoria" (catálogo, inventario, ventas) era barato con
  UNA tienda; con N tiendas hay que migrar a paginación por cursor e índices (`pagination.js`
  ya existe pero se usa poco). Ligar cuotas de plan a costo real.
- [ ] ⚠️ **Búsqueda cross-tenant** — Firestore no es buen buscador; si hay vitrina común,
  se necesita índice de búsqueda dedicado.
- [ ] ⚠️ **Caché de catálogo global** — hoy es una sola caché en memoria por instancia;
  debe volverse por-tenant y con invalidación correcta (y ojo si hay varias instancias).
- [ ] ⚠️ **Pagos en el mercado local** — ¿qué pasarela funciona en NI/región? Condiciona
  billing (M5) y checkout centralizado (M11).
- [ ] ⚠️ **Numeración/contadores globales** (`counters`) — deben ser por tenant (facturas).
- [ ] ⚠️ **Un solo servicio en Render sirviendo API + frontend** — revisar escalado,
  límites de conexión y si conviene separar cuando crezca la carga.
- [ ] ⚠️ **SMTP único** — no escala ni en deliverability ni en branding.
- [ ] ⚠️ **Lógica "muy-Gyro"** (China, USD, comisiones, pago semanal) — decidir universal/
  configurable/opcional por cada herramienta antes de generalizar.
- [ ] ⚠️ **Reglas de Firestore** — hoy `deny-all` al cliente (bien). Mantener ese principio;
  si algún día el cliente lee directo, jamás abrir sin scope de tenant.

---

## 8. Aspectos de negocio/estrategia a pensar (no técnicos, pero bloqueantes)

- ❓ **Modelo de ingreso** (§1.1) — define billing, límites y si toco dinero ajeno.
- ❓ **¿Vitrina o microsites?** (§1.2) — define el marketplace entero.
- ❓ **¿Checkout centralizado o WhatsApp por tienda?** — centralizado implica pasarela +
  payouts + responsabilidad sobre el dinero (legal-pesado). WhatsApp evita todo eso.
- ⚠️ **Legal / responsabilidad**: si terceros publican en mi marca, necesito Términos,
  política de contenido, política de datos, y claridad de que cada negocio responde por
  sus productos y por los datos de SUS clientes (privacidad multi-tenant).
- ⚠️ **Impuestos / facturación fiscal**: cada negocio puede tener sus propios requisitos
  fiscales; la facturación (M15) debe ser configurable, no la de Gyro.
- ⚠️ **Soporte y onboarding**: a más tenants, más soporte. Diseñar autoservicio desde el día 1.
- ⚠️ **Migración sin downtime** de la tienda real que ya opera y factura.

---

## 9. Roadmap sugerido por fases (orden de construcción)

> No construir todo a la vez. El orden minimiza retrabajo: primero la base de aislamiento,
> luego convertir Gyro en tenant #0, luego abrir a terceros, luego monetizar, luego vitrina.

| Fase | Meta | Módulos clave | Por qué en este orden |
|---|---|---|---|
| **F0 — Decisiones** | Cerrar los ❓ de §1 y §8 | — | Sin esto, cualquier código puede ser retrabajo |
| **F1 — Fundación de tenancy** | Datos y auth con dueño | M1, M2, M23 | Es el cimiento; todo lo demás lo asume |
| **F2 — Gyro como tenant #0** | Migrar la tienda real al modelo nuevo, funcionando igual | M25, M12–M20 (scope), M20 config | Valida el modelo con datos reales y un solo tenant controlado |
| **F3 — Multi-tenant real** | Onboarding self-service + panel de plataforma | M3, M4, M7, M21, M22, M24 | Ya se puede dar de alta un segundo negocio |
| **F4 — Monetización** | Planes, límites, cobro | M5, M6, M8 | Convertirlo en negocio; proteger costos |
| **F5 — Marketplace público** | Vitrina/discovery + checkout | M9, M10, M11 | Lo más visible, pero lo último: depende de todo lo anterior |

💡 **Regla de secuencia:** cada módulo del Bloque D (herramientas) solo se "abre" a
multi-tenant después de que M1 (contexto de tenant) esté sólido. Convertir Gyro en
tenant #0 (F2) es el mejor pretexto para probar el aislamiento con bajo riesgo antes
de dejar entrar a extraños.

---

## 10. Cómo seguir documentando (siguiente paso para ti)

Para cada módulo `Mx`, crear una nota propia que responda:
1. **Qué asume hoy** (mono-tienda) y qué hay que romper.
2. **Datos**: qué colecciones toca y cómo quedan scopeadas por tenant.
3. **Config por tenant**: qué se vuelve personalizable.
4. **Universal / configurable / opcional** (para las herramientas del Bloque D).
5. **Conexiones**: de qué otros módulos depende y quién depende de él.
6. **Limitantes propias** y decisiones abiertas (❓).

> Este documento es el índice. Las notas por módulo son la lógica fina.
