# Product

## Register

product

## Users
Compradores en Nicaragua (Managua) buscando audio y accesorios tech: audífonos KZ in-ear, adaptadores Bluetooth, accesorios para PC/gaming. Llegan mayormente desde redes/WhatsApp, muchos en móvil. Quieren escanear el catálogo rápido, comparar variantes/precio y cerrar por WhatsApp. Un segundo tipo de usuario es el admin/vendedor (Gyro Store), que gestiona catálogo, inventario, ventas y logística en el portal `/admin`.

## Product Purpose
Storefront + back-office de una tienda real. El storefront público (home, categorías, ficha de producto, combos, carrito→WhatsApp) debe verse premium y de confianza para justificar precios y convertir; el checkout final ocurre por WhatsApp, así que la web es catálogo + captación. Éxito = catálogo navegable y creíble que genere pedidos de WhatsApp.

## Brand Personality
Premium, tech, nítido, confiable. Voz directa en español nicaragüense, sin relleno. Referencias: Apple Store (calma, aire, foco en producto), Nike/StockX (jerarquía fuerte, precio protagonista, densidad controlada), Sonos/Nothing (oscuro editorial, monocromo con un acento, materialidad sobre decoración).

## Anti-references
Nada de "plantilla de e-commerce genérica": pills con gradiente arcoíris, gradient-text decorativo, sombras difusas por todos lados, botones con degradado de dos tonos como acción principal, iconos con hit-area chica, filtros escondidos. Ni look SaaS-cream ni neón permanente.

## Design Principles
- **El producto manda**: la foto y el precio son el héroe; el chrome (nav, filtros) se calla.
- **Un solo acento con propósito**: esmeralda solo para acción/selección/estado, nunca decoración.
- **Tokens semánticos siempre**: cero colores crudos; superficie/borde/acento vía variables para que dark↔light sea un flip.
- **Jerarquía por peso y espacio**, no por color ni por cajas anidadas.
- **Táctil y accesible**: hit-areas ≥44px, foco visible, contraste AA, motion con propósito y respeto a reduced-motion.

## Accessibility & Inclusion
WCAG AA: texto ≥4.5:1, targets táctiles ≥44px, foco visible con ring de acento, `prefers-reduced-motion` respetado (ya hay un bloque global). Mayoría móvil → todo debe funcionar con el pulgar.
