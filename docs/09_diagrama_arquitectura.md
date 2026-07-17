---
tags: [arquitectura, diagrama, gyro-store]
---
# Diagrama de arquitectura (actualizado)

Vista de runtime del sistema tras el saneamiento de deuda técnica. Los elementos
marcados 🆕 / 🔒 son nuevos o endurecidos respecto a la versión anterior.

```mermaid
flowchart TB
    subgraph CLIENT["🖥️ Cliente (Navegador)"]
        B["Navegador del usuario<br/>(Móvil / Desktop)"]
    end

    subgraph RENDER["☁️ Servidor de Producción · Render (Monolito)"]
        direction TB
        FE["Frontend<br/>Remix / React / Redux<br/>(SSR + estáticos)"]
        API["Backend API<br/>Node.js / Express"]

        subgraph MW["🛡️ Capa de middleware / utilidades"]
            direction TB
            SEC["helmet · CORS · rate-limit · sanitizeBody"]
            AUTH["🔒 requireRole → authenticate<br/>verifyIdToken + resolución de rol<br/>(1 sola lectura por request)"]
            UPLOAD["🆕 multer + fileFilter<br/>(imagen / PDF)"]
            ZOD["🆕 Zod en ventas + órdenes + inventario"]
            OBS["🆕 logger estructurado (JSON)<br/>morgan · handler central de errores"]
        end
    end

    subgraph EXT["🌐 Servicios Externos"]
        WA["WhatsApp<br/>(cierre de venta manual)"]
        SMTP["SMTP Gmail<br/>(Nodemailer)"]
    end

    subgraph FB["🔥 Firebase · Plan Spark"]
        FS["Firestore (NoSQL)<br/>🔒 reglas deny-all versionadas"]
        FA["Firebase Auth"]
    end

    subgraph CF["☁️ Cloudflare"]
        R2["R2 · imágenes de producto<br/>🆕 Sharp→WebP + borrado de huérfanos"]
    end

    %% Flujos del cliente
    B -->|"Visita web (HTML/CSS/JS)"| FE
    B -->|"Peticiones AJAX (/api/*)"| API
    B -.->|"Login directo (Google/Email)"| FA
    B -.->|"Carga imágenes públicas"| R2
    FA -.->|"ID token (JWT)"| B

    %% El backend pasa por su middleware
    API --- MW

    %% Flujos del backend hacia afuera
    API -->|"Redirige a WhatsApp (checkout)"| WA
    API -->|"Envía notificaciones"| SMTP
    API -->|"Lee / Escribe (Admin SDK)"| FS
    API -->|"Verifica token JWT"| FA
    API -->|"Sube imágenes (S3 SDK)"| R2
```

## Leyenda de cambios
- 🔒 **Endurecido**: superficie de seguridad reforzada sobre algo que ya existía.
- 🆕 **Nuevo**: pieza que antes no estaba.

## Principio de seguridad clave (sin cambios, ahora blindado)
El navegador **solo** usa Firebase **Auth**. **Nunca** lee ni escribe Firestore
directamente: todo el dato pasa por el backend con el Admin SDK. Las reglas
**deny-all** cierran por completo el acceso directo del cliente a la base (ADR-008).
