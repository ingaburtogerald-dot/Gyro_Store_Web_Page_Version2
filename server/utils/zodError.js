// Respuesta 400 uniforme para fallos de validación Zod: conserva `error` (primer
// mensaje — compatible con lo que el frontend ya muestra en toasts) y añade
// `details` con los errores por campo, para que los forms puedan pintar cada
// error junto al input correspondiente (react-hook-form setError).
function zodBadRequest(res, parsed) {
  return res.status(400).json({
    error: parsed.error.errors[0]?.message || 'Datos inválidos.',
    details: parsed.error.flatten().fieldErrors,
  });
}

module.exports = { zodBadRequest };
