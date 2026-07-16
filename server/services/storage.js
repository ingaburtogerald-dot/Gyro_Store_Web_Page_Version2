// Subida de archivos a Cloudflare R2 (recibos de venta, screenshots de pago,
// fotos de paquetes de logística). Devuelve una URL pública de larga duración.
// R2 es compatible con la API de S3, así que usamos el SDK @aws-sdk/client-s3.
// (Firebase Auth y Firestore siguen en el plan gratuito; aquí SOLO cambió el Storage.)
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// sharp es opcional: si no está instalado, la subida sigue funcionando sin
// optimizar (así el server no truena antes de correr `npm install sharp`).
let sharp = null;
try { sharp = require('sharp'); } catch { /* sin sharp: se sube el original */ }

// ── Config de R2 (desde variables de entorno) ──────────────────────────────
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
// URL pública del bucket (dominio r2.dev o dominio propio). Sin barra final.
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
// Endpoint S3 de la cuenta. Si no se define, se arma con el account id.
const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');

// Cliente S3 perezoso: se crea al primer uso y se cachea. Si faltan credenciales
// avisamos con un error claro en vez de fallar con un mensaje críptico del SDK.
let _client = null;
function getClient() {
  if (_client) return _client;
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new Error(
      'Cloudflare R2 no está configurado: faltan R2_ENDPOINT/R2_ACCESS_KEY_ID/' +
      'R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME en el .env.'
    );
  }
  _client = new S3Client({
    region: 'auto', // R2 ignora la región pero el SDK la exige
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

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

// Sube un buffer a R2 y devuelve su URL pública.
async function uploadFile(buffer, folder, filename, contentType) {
  const key = `${folder}/${filename}`;
  await getClient().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    })
  );
  // El bucket es público (r2.dev o dominio propio); no hace falta ACL por objeto.
  return `${R2_PUBLIC_URL}/${encodeURI(key)}`;
}

async function deleteFileByUrl(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return;
  const prefix = `${R2_PUBLIC_URL}/`;
  if (!R2_PUBLIC_URL || !publicUrl.startsWith(prefix)) return;
  const key = decodeURI(publicUrl.slice(prefix.length));
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
    );
  } catch (err) {
    // R2 no distingue "no existe": un delete de una key ausente igual responde 204.
    console.error('Error al borrar de R2:', err.message);
  }
}

module.exports = {
  sanitizePathSegment,
  uploadFile,
  deleteFileByUrl,
  optimizeImageBuffer,
  isSharpAvailable: () => !!sharp,
};
