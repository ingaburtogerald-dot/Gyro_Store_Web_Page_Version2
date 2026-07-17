---
tags: [arquitectura, diagramas, secuencia, gyro-store]
---
# Diagramas de secuencia — flujos principales

Diagramas Mermaid de los 3 flujos críticos, derivados del código real
(`server/middleware/auth.js`, `server/routes/catalog.js`, `server/routes/sales/*`).

---

## 1. Autenticación y autorización

El navegador **solo usa Firebase Auth**; todo el dato pasa por el backend con el
Admin SDK. Los roles se resuelven en el servidor por request (no hay custom claims).

```mermaid
sequenceDiagram
    autonumber
    participant B as Navegador (Remix)
    participant API as Express API
    participant FA as Firebase Auth
    participant FS as Firestore (Admin SDK)

    B->>API: GET /api/auth/config
    API-->>B: config pública de Firebase Web
    B->>FA: signIn (Google/Microsoft/email+pass)
    FA-->>B: ID token (JWT)

    Note over B: Guarda el token y lo manda en cada request
    B->>API: GET /api/... (Authorization: Bearer <token>)
    API->>FA: verifyIdToken(token)  [Admin SDK]
    FA-->>API: token decodificado (uid, email, email_verified)
    alt email no verificado y no es dominio interno
        API-->>B: 403 correo no verificado
    else
        API->>FS: fetchUserByEmail(email)  (1 lectura)
        FS-->>API: doc de usuario (roles, flags) o null
        Note over API: rolesFromEnvOrDoc: whitelist env → doc
        alt roles no autorizados para la sección
            API-->>B: 403 sin permisos
        else
            API-->>B: 200 (req.user poblado)
        end
    end
```

**Notas de implementación**
- `verifyIdToken` valida firma y expiración (no confía en el cliente).
- **Verificar ≠ autorizar**: `requireRole(...)` (`auth.js`) comprueba que los roles
  resueltos incluyan `global_admin` o alguno permitido antes de dejar pasar.
- La lectura del doc de usuario es **una sola** por request (antes eran dos).

---

## 2. Subida de imagen de producto (R2 + Sharp)

```mermaid
sequenceDiagram
    autonumber
    participant B as Navegador (admin)
    participant API as Express API
    participant M as multer (memoria + fileFilter)
    participant S as Sharp
    participant R2 as Cloudflare R2
    participant FS as Firestore

    B->>API: POST /api/catalog/upload (multipart, requireAdmin)
    API->>M: parsea archivos
    alt mimetype no es imagen
        M-->>API: Error (status 400)
        API-->>B: 400 tipo de archivo no permitido
    else
        loop cada imagen
            API->>S: optimizeImageBuffer (resize + WebP)
            S-->>API: buffer WebP
            Note over API: key = sha256(bufferOriginal) → idempotente
            API->>R2: PutObject(catalog-images/<hash>.webp)
            R2-->>API: OK
        end
        API-->>B: 201 { urls: [...] }
    end

    B->>API: POST/PUT /api/catalog (guarda urls en el doc)
    API->>FS: set/update catálogo
    Note over API,R2: En PUT/DELETE, las imágenes removidas se borran de R2
```

**Notas**
- Nombre por **hash de contenido** → reintentos no duplican objetos en R2.
- `fileFilter` centralizado en `server/utils/upload.js` (imagen; logística acepta PDF).
- Limpieza de huérfanos: `PUT` borra imágenes removidas; `DELETE` borra todas.

---

## 3. Registro y aprobación de una venta

Flujo de dos pasos humanos: el vendedor **registra** (reserva stock) y el admin
**aprueba** (consume stock). El cierre real de la venta ocurre por WhatsApp, fuera del sistema.

```mermaid
sequenceDiagram
    autonumber
    participant V as Vendedor/Admin
    participant API as Express API
    participant FS as Firestore
    participant R2 as R2

    V->>API: POST /api/sales (items + recibo, requireSeller)
    API->>API: Zod valida forma de items
    API->>FS: buildLines → lee productos/migrados (precios reales)
    Note over API: Totales y costos se calculan en el SERVIDOR
    API->>API: validatePriceFloor (piso de precio)
    opt hay recibo
        API->>R2: uploadFile(receipt)
    end
    API->>FS: reserveForItems [runTransaction]
    Note over FS: verifica stock ≥ cantidad y quantityReserved += q (atómico)
    API->>FS: crea orden status=pending_approval (con reservations)
    API-->>V: 201 venta pendiente

    Note over V,API: — Más tarde, un admin revisa —
    V->>API: POST /api/sales/:id/approve (requireAdmin)
    API->>FS: consumeReservation [runTransaction]
    Note over FS: quantityReserved -= q, quantitySold += q, product.stock -= q
    API->>API: computeFinancials (comisión, utilidades)
    API->>FS: update status=approved + financieros
    API-->>V: 200 aprobada
```

**Rechazo / edición / eliminación**
- **Rechazar** (`POST /:id/reject`): `releaseReservation` → `quantityReserved -= q`, status `rejected`.
- **Editar** (`PUT /:id`): libera reservas viejas y reserva nuevas; si la venta ya
  estaba aprobada/pagada, además reajusta stock y registra auditoría.
- **Eliminar** (`DELETE /:id`): si estaba aprobada/pagada, **devuelve** el stock
  (restock) y borra de R2 el recibo y el screenshot de pago.
