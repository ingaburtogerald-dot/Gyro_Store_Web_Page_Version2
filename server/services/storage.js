// Subida de archivos a Cloudflare R2 (recibos de venta, screenshots de pago,
// fotos de paquetes de logística). Devuelve una URL pública de larga duración.
// R2 es compatible con la API de S3, así que usamos el SDK @aws-sdk/client-s3.
// (Firebase Auth y Firestore siguen en el plan gratuito; aquí SOLO cambió el Storage.)
const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

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
    const err = new Error(
      'El almacenamiento de imágenes (Cloudflare R2) no está configurado en el servidor. ' +
      'Agrega las credenciales R2 (R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/' +
      'R2_BUCKET_NAME) en el .env y reinicia el servidor.'
    );
    // 503: dependencia no disponible. El handler central devuelve este mensaje al
    // cliente (los 500 se enmascaran con un genérico; los demás status sí pasan).
    err.status = 503;
    throw err;
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

// Sanitizador ligero para IDs (docId de Firestore, uid): conserva mayúsculas y
// solo deja caracteres seguros para una key. NO lo uses para nombres de persona
// (para eso está sanitizePathSegment, que además pasa a minúsculas y quita acentos).
function safeId(value, fallback = 'sin-id') {
  const s = String(value || '').replace(/[^A-Za-z0-9_-]+/g, '').slice(0, 80);
  return s || fallback;
}

// Partición por fecha (UTC) → "AAAA/MM". Mantiene manejables las carpetas que
// crecen sin fin (recibos, pagos) y habilita reglas de expiración por antigüedad.
function datePartition(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}/${m}`;
}

// ── TAXONOMÍA CANÓNICA del bucket (FUENTE ÚNICA DE VERDAD) ───────────────────
// Todo lo que se sube pasa por aquí para que el bucket tenga un orden lógico:
//   catalog/products/<id>/ · users/profile/<uid>/ · sales/{receipts,payments,
//   screenshots}/<AAAA>/<MM>/ · logistics/shipments/<cliente>/ · site/…
// Cambiar una ruta aquí la cambia en toda la app. (No renombra lo ya subido: es
// solo para subidas nuevas — el backfill de lo viejo sería un script aparte.)
const folders = {
  // Fotos de producto agrupadas por producto. Si aún no hay id (producto nuevo
  // sin guardar), caen a un bucket con fecha para no ensuciar la raíz.
  productImages: (productId) =>
    productId ? `catalog/products/${safeId(productId)}` : `catalog/products/_sin-asignar/${datePartition()}`,
  // Foto propia del combo (opcional — si no hay, la card arma el split de las
  // 2 fotos de los productos). Mismo patrón que productImages: sin id todavía
  // (combo nuevo, aún sin guardar) cae a un bucket temporal por fecha.
  comboImage: (comboId) =>
    comboId ? `catalog/combos/${safeId(comboId)}` : `catalog/combos/_sin-asignar/${datePartition()}`,
  templateImages: (templateId) => `catalog/templates/${safeId(templateId, 'sin-plantilla')}`,
  profilePhoto: (uid) => `users/profile/${safeId(uid)}`,
  // Media de las diapositivas del Hero de la landing, agrupada por slide (como los
  // productos) para que borrar un slide sea borrar su carpeta. El logo vive aparte
  // en site/logo/. Ambas rutas site/… las conoce el barredor de huérfanos.
  siteSlide: (slideId) => `site/slides/${safeId(slideId, 'sin-slide')}`,
  saleReceipt: () => `sales/receipts/${datePartition()}`,
  payment: () => `sales/payments/${datePartition()}`,
  paymentScreenshot: () => `sales/screenshots/${datePartition()}`,
  logisticsShipment: (customerSlug) => `logistics/shipments/${customerSlug || 'sin-cliente'}`,
};

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
  if (!R2_PUBLIC_URL || !publicUrl.startsWith(prefix)) {
    console.warn(`[storage] deleteFileByUrl ignorado: la URL no empieza con el prefijo correcto. URL: ${publicUrl}, Prefijo esperado: ${prefix}`);
    return;
  }
  const key = decodeURI(publicUrl.slice(prefix.length));
  console.log(`[storage] Intentando borrar archivo de R2. Key: ${key}`);
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
    );
    console.log(`[storage] Borrado exitoso en R2: ${key}`);
  } catch (err) {
    // R2 no distingue "no existe": un delete de una key ausente igual responde 204.
    console.error(`[storage] Error al borrar de R2 (${key}):`, err.message);
  }
}

// Lista objetos del bucket bajo un prefijo (maneja paginación). Devuelve
// [{ key, size, url }]. Pensado para scripts de mantenimiento (buscar huérfanos).
async function listFiles(prefix = '') {
  const out = [];
  let ContinuationToken;
  do {
    const res = await getClient().send(
      new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME, Prefix: prefix, ContinuationToken })
    );
    for (const obj of res.Contents || []) {
      out.push({
        key: obj.Key,
        size: Number(obj.Size) || 0,
        url: `${R2_PUBLIC_URL}/${encodeURI(obj.Key)}`,
      });
    }
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return out;
}

module.exports = {
  sanitizePathSegment,
  safeId,
  datePartition,
  folders,
  uploadFile,
  deleteFileByUrl,
  listFiles,
  optimizeImageBuffer,
  isSharpAvailable: () => !!sharp,
};
