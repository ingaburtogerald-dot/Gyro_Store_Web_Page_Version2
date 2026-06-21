// Sanitización básica de inputs del servidor. Evita que strings con HTML/scripts
// se guarden tal cual en Firestore o se reflejen en respuestas.

function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return value
    .trim()
    .replace(/<\/?script[^>]*>/gi, '')
    .replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;'));
}

// Recorre un objeto plano y sanitiza todas sus strings (recursivo, sin tocar arrays de archivos).
function sanitizeObject(obj) {
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = sanitizeObject(v);
    return out;
  }
  return sanitizeString(obj);
}

// Middleware: sanitiza req.body antes de llegar a los handlers.
function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeObject(req.body);
  next();
}

module.exports = { sanitizeString, sanitizeObject, sanitizeBody };
