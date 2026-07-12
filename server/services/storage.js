// Subida de archivos a Firebase Storage (recibos de venta, screenshots de pago,
// fotos de paquetes de logística). Devuelve una URL pública de larga duración.
const { admin } = require('../firebase');

// sharp es opcional: si no está instalado, la subida sigue funcionando sin
// optimizar (así el server no truena antes de correr `npm install sharp`).
let sharp = null;
try { sharp = require('sharp'); } catch { /* sin sharp: se sube el original */ }

// Normaliza cualquier imagen a WebP redimensionada → peso y formato consistentes
// entre productos sembrados y subidos a mano. Si sharp no está, devuelve el buffer
// original sin tocar (contentType/ext = null para que el caller use los del archivo).
async function optimizeImageBuffer(buffer, { maxDim = 1200, quality = 82 } = {}) {
  if (!sharp) return { buffer, contentType: null, ext: null };
  try {
    const out = await sharp(buffer)
      .rotate() // respeta la orientación EXIF antes de redimensionar
      .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    return { buffer: out, contentType: 'image/webp', ext: '.webp' };
  } catch (err) {
    console.error('optimizeImageBuffer falló, se sube el original:', err.message);
    return { buffer, contentType: null, ext: null };
  }
}

// Limpia un segmento de ruta para usarlo como carpeta (nombre de vendedor, etc.).
function sanitizePathSegment(value) {
  return (
    String(value || 'sin-nombre')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // quita acentos (diacríticos combinados)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'sin-nombre'
  );
}

// Sube un buffer y devuelve su URL pública.
async function uploadFile(buffer, folder, filename, contentType) {
  const bucket = admin.storage().bucket();
  const filePath = `${folder}/${filename}`;
  const file = bucket.file(filePath);

  await file.save(buffer, {
    metadata: { contentType: contentType || 'application/octet-stream' },
    resumable: false,
  });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${encodeURI(filePath)}`;
}

async function deleteFileByUrl(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return;
  try {
    const bucket = admin.storage().bucket();
    const bucketPrefix = `https://storage.googleapis.com/${bucket.name}/`;
    if (!publicUrl.startsWith(bucketPrefix)) return;
    
    const filePath = decodeURI(publicUrl.slice(bucketPrefix.length));
    const file = bucket.file(filePath);
    await file.delete();
  } catch (err) {
    if (err.code !== 404) console.error('Error al borrar de Storage:', err.message);
  }
}

module.exports = {
  sanitizePathSegment,
  uploadFile,
  deleteFileByUrl,
  optimizeImageBuffer,
  isSharpAvailable: () => !!sharp,
};
