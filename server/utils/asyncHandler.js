// Envuelve handlers async de Express para que cualquier promesa rechazada
// pase al manejador central de errores sin try/catch repetido en cada ruta.
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
