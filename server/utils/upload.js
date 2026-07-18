// Fábrica de multer con validación de tipo de archivo (fileFilter) centralizada.
// Antes cada ruta creaba su multer solo con límite de tamaño: cualquier archivo
// (no solo imágenes) pasaba y llegaba crudo a R2. Aquí se valida el mimetype.
// Todas las subidas van en memoria para entregar el buffer a R2/Sharp.
const multer = require('multer');

// Formatos de imagen que aceptamos (incluye los que producen los celulares).
const IMAGE_MIMES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
]);
// Formatos de video para la media del Hero (slides). object-cover en un <video>.
const VIDEO_MIMES = new Set([
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
]);
// Documentos permitidos donde además de imagen puede venir una factura.
const DOC_MIMES = new Set(['application/pdf']);

function makeFileFilter(allowed, label) {
  return (req, file, cb) => {
    if (allowed.has((file.mimetype || '').toLowerCase())) return cb(null, true);
    const err = new Error(`Tipo de archivo no permitido. Solo se aceptan ${label}.`);
    err.status = 400; // el manejador central de index.js lo respeta → 400, no 500
    cb(err);
  };
}

// Sube SOLO imágenes (recibos, screenshots de pago, fotos de perfil, catálogo).
function imageUpload({ maxSizeMb = 8 } = {}) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
    fileFilter: makeFileFilter(IMAGE_MIMES, 'imágenes'),
  });
}

// Sube imágenes o PDF (facturas de logística).
function imageOrPdfUpload({ maxSizeMb = 8 } = {}) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
    fileFilter: makeFileFilter(new Set([...IMAGE_MIMES, ...DOC_MIMES]), 'imágenes o PDF'),
  });
}

// Sube media del Hero: imágenes, GIF o video. Los videos pesan → límite más alto.
function mediaUpload({ maxSizeMb = 50 } = {}) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
    fileFilter: makeFileFilter(new Set([...IMAGE_MIMES, ...VIDEO_MIMES]), 'imágenes, GIF o video'),
  });
}

module.exports = { imageUpload, imageOrPdfUpload, mediaUpload, IMAGE_MIMES, VIDEO_MIMES, DOC_MIMES };
