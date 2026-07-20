// Enlaces del negocio compartidos por varias piezas (menú, footer, banner de
// reseñas). Centralizados aquí para no duplicar la URL en cada componente.

// Ficha de Google Maps del negocio — desde ahí el cliente toca "Escribir una
// reseña" directamente en Google. La misma URL se usa en AboutUsModal y LeadCapture.
export const GOOGLE_REVIEW_URL = "https://maps.app.goo.gl/G7t4aYcJ8Npu4eY46";

// Ficha de Facebook del negocio para opiniones.
export const FACEBOOK_REVIEW_URL = "https://www.facebook.com/profile.php?id=61589182888082&sk=reviews";

// Mensaje por defecto del CTA genérico de WhatsApp (cuando no es específico de un
// producto). El número real vive en /api/config (BusinessConfig.whatsapp).
export const WHATSAPP_DEFAULT_MESSAGE = "Hola, quiero más información sobre un producto.";
