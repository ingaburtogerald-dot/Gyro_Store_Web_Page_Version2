// Helpers genéricos del frontend.
import { EXCHANGE_RATE, CURRENCY } from "./constants";

// Une clases condicionales (alternativa ligera a clsx).
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// Formatea un monto en Córdobas: 1710 → "C$1,710"
export function formatCordobas(amount: number): string {
  return `${CURRENCY}${Math.round(amount).toLocaleString("es-NI")}`;
}

// Formatea un monto en dólares: 12.5 → "$12.50"
// minDecimals permite forzar decimales fijos (ej. envío unitario: 4 → "$0.4100").
export function formatUsd(amount: number, maxDecimals: number = 2, minDecimals: number = 2): string {
  const max = Math.max(2, maxDecimals);
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: Math.min(Math.max(2, minDecimals), max),
    maximumFractionDigits: max
  })}`;
}

// Convierte USD a Córdobas usando el tipo de cambio fijo.
export function usdToCordobas(usd: number, rate: number = EXCHANGE_RATE): number {
  return usd * rate;
}

// Equivalente en USD (formateado) de un monto en C$ — para el subtítulo de los cards.
export function usdFromCordobas(cordobas: number): string {
  return formatUsd((cordobas || 0) / EXCHANGE_RATE);
}

// Equivalente en C$ (formateado) de un monto en USD — para el subtítulo de los cards.
export function cordobasFromUsd(usd: number): string {
  return formatCordobas((usd || 0) * EXCHANGE_RATE);
}

// Genera un mensaje de WhatsApp y devuelve la URL wa.me lista para abrir.
// wa.me exige solo dígitos en el número; el admin puede guardar el WhatsApp con
// formato humano ("+505 8594 4758") desde Configuración — se limpia acá para que
// TODOS los que llaman a esta función queden protegidos sin tocar cada sitio.
export function buildWhatsappUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// Crea un slug amigable para la URL (ej: "KZ EDX Pro X" -> "kz-edx-pro-x")
export function createSlug(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9]+/g, "-") // caracteres no alfanumericos por guion
    .replace(/(^-|-$)+/g, ""); // quita guiones en extremos
}

// Genera la URL del producto con slug SEO amigable (ej: /producto/kz-edx-pro-x--olkFjqrHZSnKnyqIDMa8)
export function getProductUrl(id: string, name: string): string {
  const slug = createSlug(name);
  return slug ? `/producto/${slug}--${id}` : `/producto/${id}`;
}
