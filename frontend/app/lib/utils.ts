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
export function formatUsd(amount: number, maxDecimals: number = 2): string {
  return `$${amount.toLocaleString("en-US", { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: Math.max(2, maxDecimals) 
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
export function buildWhatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
