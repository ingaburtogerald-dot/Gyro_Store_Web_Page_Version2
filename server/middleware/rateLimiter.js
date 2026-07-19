// Rate limiting por IP. Límite general para toda la API y uno más estricto
// para endpoints sensibles (auth, invitaciones).
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 120, // 120 peticiones por IP por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intenta de nuevo en un momento.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos.' },
});

// Telemetría de búsqueda: acota las escrituras a Firestore por IP para no quemar la
// capa gratuita ni permitir que un bot infle la colección search_events.
const telemetryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados eventos.' },
});

module.exports = { apiLimiter, authLimiter, telemetryLimiter };
