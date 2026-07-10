# DESIGN.md — Gyro Store · Sistema de diseño "Editorial Dark"

> **Single source of truth** para el frontend del storefront (catálogo público).
> Cualquier IA o desarrollador que toque UI del storefront DEBE seguir este archivo.
> Ámbito: rutas públicas (`_index`, `producto.$id`, `contacto`) bajo `data-skin="store"`.
> El panel admin usa otra piel (Obsidian/Esmeralda) y NO se rige por este documento.

---

## 0. En una frase

Tienda de accesorios tecnológicos en Managua. La UI es **editorial oscura**: neutros
medianoche, **un** acento, hairlines de 1px, tipografía de alto contraste por **peso**
(no por tamaño), y motion físico solo donde hay tacto. El **producto es la estrella**;
el cromo nunca compite con la foto ni con el precio.

---

## 1. Atmósfera

- **Vibra:** "Daily App Balanced" — no galería vacía, no ruido. Densidad alta en la
  grilla (el cliente ve muchos productos y precios rápido), aireado en hero y PDP.
- **Variance:** media-alta vía **asimetría estructural** (bento con tiles anchos, hero
  con emblema protagonista), NO vía decoración.
- **Escena física:** se navega de noche, en el teléfono, con una mano. Por eso el fondo
  es oscuro (menos fatiga) y las acciones primarias viven abajo/al alcance del pulgar.

**Prohibido:** layouts centrados y simétricos "de plantilla", grillas de 3 columnas
idénticas repetidas, tarjetas apiladas en desorden.

---

## 2. Color (paleta cerrada, tokens en `tailwind.css` → `[data-skin="store"]`)

Todo color se consume vía **token semántico** (`bg-bg`, `text-accent`, `border-border`…).
**Nunca** colores crudos de Tailwind (`bg-slate-800`, `text-cyan-400`) en componentes.

### Superficies (neutros medianoche, no negro puro)
| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#0a0f1c` | Fondo de página (off-black azulado, nunca `#000`) |
| `--color-surface` | `#0f1728` | Paneles, tarjetas, dropdowns |
| `--color-surface-2` | `#17223a` | Stage de producto, controles, barra de categorías |
| `--color-surface-hover` | `#1b2845` | Hover de superficies |
| `--color-border` | `rgba(148,197,255,0.12)` | Hairline base |

Hairlines alternativas para el look editorial: `border-white/10` (reposo) →
`border-white/25` (hover). 1px SIEMPRE.

### Texto (contraste AA verificado sobre `--color-bg`)
| Token | Valor | Uso |
|---|---|---|
| `--color-text` | `#e8eefc` | Texto principal, nombres, precios |
| `--color-muted` | `#94a3b8` | Secundario, metadatos, descripciones (≥4.5:1) |

### Acento — **uno solo** (cyan calibrado, la firma de la marca)
| Token | Valor | Uso |
|---|---|---|
| `--color-accent` | `#22d3ee` | Precio, CTA, foco, estado activo |
| `--color-accent-2` | `#67e8f9` | Hover del nombre, íconos de confianza |
| `--color-accent-hover` | `#06b6d4` | Hover del CTA |

> **Nota de identidad:** el cyan ES la marca de Gyro (decisión deliberada, no default de
> IA). Es el ÚNICO acento. Contraste crítico: el cyan es claro → los CTAs planos llevan
> **texto oscuro** (`text-bg` sobre `bg-accent` ≈ 10:1). Nunca texto blanco sobre cyan plano.

### Badge secundario (solo oferta/novedad — uso escaso)
`--color-badge #8b5cf6` / `--color-badge-2 #c4b5fd`. Morado exclusivo para etiquetas
de oferta sobre la foto. No usar como acento general.

### Reglas de color
- **Máximo un acento.** Si algo necesita "otro color", casi siempre necesita **peso** o **jerarquía**, no color.
- Gris sobre fondo tintado se ve lavado: si el contraste está cerca, subir hacia `--color-text`.
- Placeholder = mismo 4.5:1 que el texto (usar `--color-muted`, no un gris más claro).

---

## 3. Tipografía

- **Familia única:** **Plus Jakarta Sans** (`--font-sans` y `--font-heading`). Grotesk
  moderna, limpia. **Prohibido** Inter, Times, Georgia, fuentes de sistema como marca.
- **Contraste por PESO y COLOR, no por tamaño.** El patrón del sistema:

| Rol | Peso | Color | Ejemplo |
|---|---|---|---|
| Display / titular | `font-extrabold` (800) | `text-text` | Hero, título PDP |
| Nombre de producto | `font-bold` (700) | `text-text` | Tarjeta |
| Precio | `font-extrabold` + `tabular-nums` | `text-accent` | Tarjeta, PDP |
| Cuerpo / descripción | `font-light` (300) | `text-muted` | Pills, descripciones |
| Eyebrow / label | `font-medium` + `uppercase tracking-[0.22em]` | `text-muted` | Categoría, secciones |

- **Display:** `tracking-[-0.03em]`, `leading-[1.02]`, `text-balance`. Techo `clamp()` ≤ 3.5rem en el storefront (no gritar).
- **Prosa larga:** máximo **65ch** (`max-w-[65ch]`), `leading-relaxed`, `text-pretty`.
- Cifras siempre `tabular-nums` (precios, stock, contadores).

---

## 4. Espaciado, radios, layout

- **Radios:** tarjetas `rounded-xl` (12px), controles/CTA `rounded-lg`, pills `rounded-pill`.
  El stage de imagen puede `rounded-2xl`. Crispado, no globo.
- **Grilla del catálogo (bento asimétrico determinista):**
  `grid grid-cols-2 [grid-auto-flow:dense] md:grid-cols-3 xl:grid-cols-4`, `gap-4/5`.
  Regla de tiles anchos (`col-span-2`, layout `list`): el **primero** abre como pieza
  destacada + las **ofertas** se ganan un tile ancho (ver `ProductGrid.catalogWide`).
  NUNCA todas iguales.
- **Flex para 1D, Grid para 2D.** Nada de Grid donde un `flex-wrap` basta.
- **z-index semántico:** dropdown(60) < sticky header(40)… sin `9999` arbitrarios.
- Dropdowns dentro de contenedores con `overflow`/`backdrop-filter` → **portal a `<body>`
  con `position: fixed`** (ver `CategoryChips`). Nunca `absolute` que se recorta.

---

## 5. Motion (calibrado, NO uniforme)

Regla de oro: **el motion encaja con lo que revela.** Prohibido el "spring en todo"
(reflejo uniforme = tell de IA) y prohibido el rebote/elástico.

| Situación | Técnica |
|---|---|
| Entradas / reveals (tarjetas, secciones) | `ease-expo` = `cubic-bezier(0.16,1,0.3,1)`, opacity + translate corto, `whileInView` con stagger |
| **Tactile push** (tacto físico) | Tarjeta: `whileTap={{ scale: 0.985 }}`. Botones: `active:translate-y-px active:scale-[0.98]` |
| Hover de tarjeta | **Se eleva** `y:-4` (spring `stiffness:260, damping:24`) — NO crece. El zoom es solo para la foto (`group-hover:scale-[1.06]`) |
| Hover-swap de foto | Crossfade a `images[1]` en 600ms si existe |
| Carrusel | Scroll nativo suave (`scrollBy behavior:smooth`), no reflow |

- **Springs:** permitidos SOLO en objetos táctiles (push, contador del carrito). Evitar
  overshoot visible. Para todo lo demás, ease-out exponencial.
- **`prefers-reduced-motion`: obligatorio.** Cada animación tiene alternativa (crossfade
  o instantáneo). Los `initial` de framer se anulan con `useReducedMotion()`.
- Reveals nunca ocultan contenido por defecto: si la animación no dispara (tab oculta,
  headless), la sección igual se ve.

---

## 6. Profundidad y bordes

- **Sin glow.** Prohibidas las sombras con resplandor exterior (`shadow-accent-*` quedan
  DEPRECADAS para el storefront editorial). La jerarquía la cargan el **borde hairline**
  que se aclara al hover y el **tipo**, no la sombra.
- Glass/`backdrop-blur` decorativo: **fuera** de las tarjetas. Permitido solo en el header
  sticky y velos funcionales (lightbox, barra móvil).
- Profundidad real = cambio de superficie (`bg-surface` panel sobre `bg-bg` página) +
  hairline. No sombras pesadas.

---

## 7. Componentes (contratos)

### `ProductCard` (unidad repetida)
- Panel `bg-surface` + `border-white/10` → hover `border-white/25`. Sin glass, sin glow.
- Foto en `product-stage` (foco radial sutil), `object-contain p-6`, blur-up al cargar,
  hover-swap a la 2ª foto, view-transition al PDP.
- Nombre `font-bold`; pills de variante `font-light`; precio `text-accent font-extrabold`.
- CTA "Agregar al carrito" SIEMPRE visible, `bg-accent text-bg` (texto oscuro, AA ~10:1),
  con tactile push. Si hay >1 variante, abre `QuickAddSheet`.
- Dos layouts: `grid` (vertical) y `list` (horizontal editorial para tiles anchos).

### `Hero`
- Emblema (mascota Gyro) protagonista, centrado, un solo gesto (flotar) + halo sereno.
- Titular display extrabold, subtítulo `font-light`, franja de confianza fina (íconos
  lucide, **sin emojis**), contador. Compacto en móvil (el producto asoma sobre el pliegue).

### `ProductCarousel`
- Fila con scroll-snap + flechas prev/next (se deshabilitan en extremos) + degradado de
  continuidad. Reusa `ProductCard`. Títulos: "Lo Más Nuevo", "Tal vez te pueda interesar".

### `CategoryChips`
- Fila scrollable (todos los tamaños) con degradados de borde. Chips pill: activo
  `bg-accent/12 text-accent-2`, reposo `text-muted` → hover `text-text`. Subcategorías en
  dropdown por **portal + fixed**. "Todo" abre el `PublicSidebar` con el árbol completo.

### `BrandStrip`
- Wordmarks tipográficos en fila (sin contenedores circulares, sin glow). Logo real (si
  existe) en escala de grises → color al hover.

### PDP (`producto.$id`)
- Galería sticky con zoom (sin glow ambiental). Título display Black. Specs en **grilla
  con hairlines** (`gap-px` sobre `bg-border`). Descripción a 65ch. CTA sólido + WhatsApp.
  Funcionalidad de mayoreo/variantes/compartir intacta.

---

## 8. Anti-patrones (rechazar en review)

- ❌ **Emojis** en UI de marca (categorías, botones, secciones). Usar íconos lucide.
- ❌ **Glow / sombras con resplandor.** Solo hairlines o flat.
- ❌ **Segundo acento** o colores crudos de Tailwind en componentes.
- ❌ **Grillas de 3–4 columnas idénticas** repetidas sin ritmo asimétrico.
- ❌ **Gradient-text**, glassmorphism decorativo, side-stripe borders, eyebrow tracked
  en CADA sección.
- ❌ **Spring en todo** / animaciones lineales / rebote-elástico.
- ❌ **Negro puro** `#000000`. Usar `--color-bg`.
- ❌ Copys de relleno: "Scroll to explore", "Unleash", "Next-Gen", "Descubre el futuro".
- ❌ Diferenciar elementos solo por color (usar peso/tamaño/jerarquía).
- ❌ Texto muted claro "por elegancia" que baja el contraste bajo 4.5:1.

---

## 9. Accesibilidad (piso, no opcional)

- Contraste: cuerpo ≥4.5:1, texto grande ≥3:1. Verificado en tokens actuales.
- Foco visible en todo interactivo: `focus-visible:ring-2 ring-accent`.
- `prefers-reduced-motion` respetado en cada animación.
- Touch targets ≥44px; acciones primarias al alcance del pulgar en móvil.
- `alt` significativo en fotos de producto; imágenes decorativas `aria-hidden`.

---

## 10. Deuda / pendientes de datos

- **`createdAt` en productos** → hoy "Lo Más Nuevo" usa un slice como proxy; con fecha
  real se ordena por novedad de verdad.
- **Marcas reales + logos** en `/public/brands` (hoy `STORE_BRANDS` es placeholder).
- **Migrar utilidades deprecadas** (`shadow-accent-cta/soft`) fuera del storefront.

---

_Este archivo refleja el sistema **vivo** en el código a la fecha de su escritura. Si el
código y este documento divergen, actualizar este documento en el mismo PR._
