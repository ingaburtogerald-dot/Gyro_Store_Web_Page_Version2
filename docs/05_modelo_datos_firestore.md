---
tags: [arquitectura, datos, firestore, gyro-store]
---
# Modelo de datos de Firestore — colecciones y patrones de acceso

Fuente única de nombres: `server/config.js → collections`. El **cliente nunca lee
Firestore directo**: todo pasa por el backend con el Admin SDK. Por eso el modelado
está orientado a los patrones de acceso del backend (NoSQL), no a normalización SQL.

> Convención: 🔑 = se consulta por este campo · 🧮 = se calcula/deriva · ⚠️ = nota de costo/riesgo.

---

## Catálogo público

### `catalog` — ítems publicados (lo que ve el cliente)
| Campo | Tipo | Notas |
|-------|------|-------|
| `templateId` | string 🔑 | referencia a `templates` |
| `basePrice` / `price` | number | precio base; override por variante en `variantMappings` |
| `variantMappings` | map | `"opt / opt": { sku, price? }` → mapea combinación → SKU de bodega |
| `axisOptions` | map | qué opciones ofrece el producto por eje |
| `images`, `imagesByColor` | array/map | URLs en R2 |
| `published`, `isPromo`, `order` | bool/number 🔑 | filtros de la lista |

**Patrón de acceso:** `GET /api/catalog` trae **toda** la colección + `templates`
**una vez** y la cachea en memoria (`catalogCache`), filtrando por categoría/promo
en memoria. Se invalida al escribir. ⚠️ Es la mejor optimización del proyecto para
los límites de lectura de Spark. El caché es por-instancia y no expira por tiempo.

### `templates` — plantillas de variantes (ejes, opciones, specs)
Se leen junto al catálogo (mismo caché). Definen el producto cartesiano de variantes.

### `combos` — paquetes con precio propio
Leídos por `getComboEnrichedById` en el checkout público.

---

## Inventario (bodega)

### `purchases` — lotes de compra (inventario NATIVO)
| Campo | Tipo | Notas |
|-------|------|-------|
| `code` | string 🔑 | se consulta por código (FIFO) |
| `status` | `china`\|`pending`\|`received` 🔑 | solo `received` tiene stock vendible |
| `purchaseDate` | string ISO 🔑 | orden FIFO y filtro `?period=YYYY-MM` |
| `quantity`, `quantitySold`, `quantityReserved` | number 🧮 | `available = quantity - sold - reserved` |
| `priceUnit`, `shippingUnit` | number USD | costo real (× tipo de cambio) |

**Patrón:** `getLots(code)` filtra `code == X AND status == received` y ordena FIFO
por `purchaseDate` en memoria. ⚠️ Consulta de dos igualdades → cubierta por índices
de campo único; sin índice compuesto. Las lecturas de inventario hacen `.get()` de
la colección completa y filtran en memoria (aceptable con volumen bajo).

### `products` — stock por SKU (vista de bodega)
| Campo | Tipo | Notas |
|-------|------|-------|
| `code` / `sku` | string 🔑 | resolución de stock por variante del catálogo |
| `stock` | number 🧮 | descontado atómicamente al aprobar ventas |

**Patrón:** el detalle de catálogo resuelve stock con `where('sku','in', <=10)` por
lotes de 10 (límite de Firestore para `in`).

### `migrated_inventory` — inventario histórico (Excel viejo)
Aislado de `purchases`; lleva `origin:'migrated'`. Costo real ya dado (no corre FIFO).

---

## Ventas y facturación

### `orders` — ventas registradas
| Campo | Tipo | Notas |
|-------|------|-------|
| `status` | 🔑 | `pending_approval`→`approved`→`paid` / `rejected` (ver `06_maquinas_estado`) |
| `saleOrigin` | `native`\|`migrated` | de qué inventario sale |
| `reservations` | array | `{ lotId, code, quantity, unitFinalUsd }` — enlaza la venta al stock reservado |
| `items` | array | líneas con precio, costo (solo admin), comisión |
| `sellerUid`/`sellerEmail`, `weekOf` 🔑 | | agrupación de pagos por semana ISO |

**Patrón:** listados por vendedor/semana/estado. Los campos de costo se **filtran**
antes de responder a no-admin (`publicItems`).

### `invoices` — tickets de facturación (caja)
`status`: `unlinked`→`linked`. La vinculación a una venta corre en `runTransaction`
para garantizar **1 ticket = 1 uso**.

### `public_orders` — pedidos del catálogo (checkout WhatsApp)
Se crean sin auth; se recalcula el total en servidor. Admin los lista/paginación
por cursor sobre `createdAt` (`GET /api/orders/public?limit=`).

---

## Soporte

| Colección | Uso |
|-----------|-----|
| `users` / `users_deleted` | 🔑 por `email`. Fuente de roles fuera de la whitelist env |
| `app_config` | doc `pricing` (descuentos por volumen), costos fijos |
| `audit_logs` | ediciones/eliminaciones de ventas (motivo, autor, montos) |
| `installments` / `payments` / `commission_adjustments` | cuotas, pagos, ajustes de saldo |
| `contacts` (+ subcolección `activities`) / `followups` | CRM ligero |
| `logistics_shipments` | paquetes de logística (flujo China→Nicaragua) |
| `counters` | contadores (numeración) |

---

## Oportunidades de optimización (documentadas, no urgentes)
1. **Paginación por cursor** (`server/utils/pagination.js`) — adoptar en listados que
   hoy hacen `.get()` completo (`inventory`, `sales`) cuando el volumen crezca.
2. **Caché backend** extendible a `templates`/`app_config` (hoy solo catálogo).
3. **Roles en custom claims** para eliminar la lectura de `users` por request.
