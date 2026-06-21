// Verificación de tokens de Firebase + resolución de roles desde Firestore.
// Reciclado del proyecto anterior: whitelist por env → Firestore → array de roles.
const { auth, db } = require('../firebase');
const config = require('../config');

const VALID_ROLES = config.validRoles;

function primaryRole(roles) {
  return config.rolePriority.find((r) => roles.includes(r)) || roles[0] || null;
}

// Resuelve los roles de un correo. Env vars primero (rápido, sin índice),
// luego Firestore (usuarios creados desde el panel). Siempre devuelve un array.
async function resolveRoles(email) {
  const lower = email.toLowerCase();

  // 1. Whitelist por variables de entorno
  if (config.adminEmails.includes(lower)) {
    return lower === config.protectedEmail ? ['global_admin'] : ['admin'];
  }
  if (config.sellerEmails.includes(lower)) return ['seller'];

  // 2. Firestore — query de un solo campo para no requerir índice compuesto
  try {
    const snap = await db
      .collection(config.collections.users)
      .where('email', '==', lower)
      .limit(1)
      .get();
    if (!snap.empty) {
      const data = snap.docs[0].data();
      if (data.status !== 'disabled' && !data.deletedAt) {
        const roles = Array.isArray(data.roles) && data.roles.length
          ? data.roles.filter((r) => VALID_ROLES.includes(r))
          : VALID_ROLES.includes(data.role) ? [data.role] : [];
        if (roles.length) return roles;
      }
    }
  } catch (err) {
    console.error('⚠️  resolveRoles Firestore error:', err.message);
  }

  return [];
}

// Verifica el Bearer token y devuelve { user } o { error, message }.
async function authenticate(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return { error: 401, message: 'Falta el token de sesión.' };

  try {
    const decoded = await auth.verifyIdToken(token);
    if (!decoded.email) return { error: 403, message: 'Token sin correo electrónico.' };

    // Usuarios internos (@gyrostore.com) se consideran verificados por dominio.
    // Externos (Google/Microsoft) deben tener email verificado.
    const isInternal = decoded.email.toLowerCase().endsWith(`@${config.internalDomain}`);
    if (!isInternal && decoded.email_verified === false) {
      return { error: 403, message: 'El correo de la cuenta no está verificado.' };
    }

    const roles = await resolveRoles(decoded.email);
    let mustChangePassword = false;
    let whatsapp = '';
    try {
      const snap = await db.collection(config.collections.users).where('email', '==', decoded.email.toLowerCase()).limit(1).get();
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data();
        mustChangePassword = data.mustChangePassword === true;
        whatsapp = data.whatsapp || '';

        // Sincronizar foto de perfil y nombre de proveedores (Google/Microsoft) a Firestore
        // para que se vea en el panel de Gestión de Usuarios.
        const updateData = {};
        if (decoded.picture && data.photoURL !== decoded.picture) {
          updateData.photoURL = decoded.picture;
        }
        if (decoded.name && data.name !== decoded.name) {
          updateData.name = decoded.name;
        }
        if (Object.keys(updateData).length > 0) {
          docSnap.ref.update(updateData).catch(() => {});
        }
      }
    } catch {}

    return {
      user: {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name || '',
        photoURL: decoded.picture || '',
        roles,
        role: primaryRole(roles),
        mustChangePassword,
        whatsapp,
      },
    };
  } catch (err) {
    console.error('❌ Error al verificar token:', err.message);
    return { error: 401, message: 'Sesión inválida o expirada.' };
  }
}

// Factory: deja pasar si el usuario tiene alguno de los roles indicados,
// o si es global_admin (acceso total).
function requireRole(...allowed) {
  return async function (req, res, next) {
    const result = await authenticate(req);
    if (result.error) return res.status(result.error).json({ error: result.message });

    const { roles } = result.user;
    const ok = roles.includes('global_admin') || allowed.some((r) => roles.includes(r));
    if (!ok) return res.status(403).json({ error: 'Esta cuenta no tiene permisos para esta sección.' });

    req.user = result.user;
    next();
  };
}

// Atajos por portal
const requireAdmin = requireRole('admin');
const requireSeller = requireRole('admin', 'seller');
const requireCashier = requireRole('admin', 'cashier');
const requireLogisticsAdmin = requireRole('admin', 'logistics_admin');
const requireLogisticsAny = requireRole('admin', 'logistics_admin', 'logistics_customer');
// Cualquier rol válido — usado por /auth/me, donde solo importa saber quién es.
const requireAnyRole = requireRole(...VALID_ROLES);

module.exports = {
  authenticate,
  resolveRoles,
  primaryRole,
  requireRole,
  requireAdmin,
  requireSeller,
  requireCashier,
  requireLogisticsAdmin,
  requireLogisticsAny,
  requireAnyRole,
};
