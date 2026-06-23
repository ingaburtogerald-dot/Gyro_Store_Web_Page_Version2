// Servicio de correo con Nodemailer (SMTP Gmail). Plantillas HTML dark premium
// recicladas del proyecto anterior. Si no hay credenciales, las funciones
// devuelven false sin lanzar (el flujo principal no debe romperse por el email).
const nodemailer = require('nodemailer');
const config = require('../config');
const { db } = require('../firebase');

async function isLocalUser(email) {
  try {
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!snap.empty) {
      return snap.docs[0].data().provider === 'local';
    }
  } catch (e) {
    // ignorar error
  }
  return false;
}

const ROLE_NAMES = {
  global_admin: 'Administrador Global',
  admin: 'Administrador',
  seller: 'Vendedor',
  cashier: 'Cajero',
  logistics_admin: 'Admin. Gyro Logistics',
  logistics_customer: 'Cliente Gyro Logistics',
};

function createTransport() {
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: { user: config.email.user, pass: config.email.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    family: 4, // Forzar IPv4 (evita problemas de IPv6 en Render)
  });
}

// ── Bloques de plantilla (diseño dark premium) ──
const header = (title) => `
  <div style="background:linear-gradient(135deg,#7c83ff,#9aa0ff);padding:32px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;font-family:Arial,sans-serif;">${title}</h1>
  </div>`;

const footer = () => `
  <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
    <p style="margin:0;color:#717a9c;font-size:12px;">Gyro Store · Sistema Interno</p>
  </div>`;

const btn = (href, text) => `
  <div style="text-align:center;margin:28px 0;">
    <a href="${href}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c83ff,#9aa0ff);color:#fff;text-decoration:none;border-radius:99px;font-weight:700;font-size:15px;">${text} →</a>
  </div>`;

const wrap = (inner) => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0b0f19;color:#e2e8f0;border-radius:12px;overflow:hidden;">
    ${inner}
  </div>`;

function fromAddress() {
  return config.email.from || `"Gyro Store" <${config.email.user}>`;
}

// Invitación a usuario local (@gyrostore.com) — activación con link de reset.
async function sendLocalInvite({ to, displayName, email, roles, resetLink }) {
  if (!config.email.user) return false;
  const roleNames = (roles || []).map((r) => ROLE_NAMES[r] || r).join(', ');

  await createTransport().sendMail({
    from: fromAddress(),
    to,
    subject: 'Bienvenido a Gyro Store — Activa tu cuenta',
    html: wrap(`
      ${header('¡Bienvenido a Gyro Store!')}
      <div style="padding:32px;">
        <p>Hola <strong>${displayName}</strong>,</p>
        <p>Has sido agregado al sistema como <strong>${roleNames}</strong>.</p>
        <div style="background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:20px;margin:24px 0;">
          <p style="margin:0 0 6px;color:#717a9c;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Tu correo de acceso</p>
          <p style="margin:0;font-weight:700;color:#9aa0ff;">${email}</p>
        </div>
        <p>Haz clic para crear tu contraseña y activar tu cuenta:</p>
        ${btn(resetLink, 'Activar mi cuenta')}
        <p style="color:#717a9c;font-size:13px;">Este enlace expira en 24 horas.</p>
      </div>
      ${footer()}
    `),
  });
  return true;
}

// Invitación a usuario externo (Google/Microsoft).
async function sendGuestInvite({ to, displayName, roles, appUrl }) {
  if (!config.email.user) return false;
  const roleNames = (roles || []).map((r) => ROLE_NAMES[r] || r).join(', ');

  await createTransport().sendMail({
    from: fromAddress(),
    to,
    subject: 'Invitación para colaborar en Gyro Store',
    html: wrap(`
      ${header('¡Has sido invitado!')}
      <div style="padding:32px;">
        <p>Hola <strong>${displayName}</strong>,</p>
        <p>Has sido invitado a colaborar en <strong>Gyro Store</strong> como <strong>${roleNames}</strong>.</p>
        <p>Inicia sesión con tu cuenta de Google o Microsoft asociada a <strong>${to}</strong>:</p>
        ${btn(appUrl || config.appUrl, 'Acceder a Gyro Store')}
      </div>
      ${footer()}
    `),
  });
  return true;
}

// Mensaje del formulario de contacto público → llega al admin.
async function sendContactMessage({ to, name, email, phone, message }) {
  if (!config.email.user) return false;

  await createTransport().sendMail({
    from: fromAddress(),
    to,
    replyTo: email,
    subject: `Contacto web — ${name}`,
    html: wrap(`
      ${header('📬 Nuevo mensaje de contacto')}
      <div style="padding:32px;">
        <div style="background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:20px;margin-bottom:20px;">
          <p style="margin:0 0 6px;color:#717a9c;font-size:12px;text-transform:uppercase;letter-spacing:1px;">De</p>
          <p style="margin:0 0 14px;font-weight:700;">${name}</p>
          <p style="margin:0 0 6px;color:#717a9c;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Correo</p>
          <p style="margin:0 0 14px;font-weight:700;color:#9aa0ff;">${email}</p>
          ${phone ? `<p style="margin:0 0 6px;color:#717a9c;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Teléfono</p><p style="margin:0;font-weight:700;">${phone}</p>` : ''}
        </div>
        <p style="white-space:pre-wrap;">${message}</p>
      </div>
      ${footer()}
    `),
  });
  return true;
}

const c$ = (n) => `C$${Math.round(n).toLocaleString('es-NI')}`;

// Venta aprobada → notifica al vendedor con su comisión.
async function sendSaleApproved({ to, sellerName, products, comision }) {
  if (!config.email.user || await isLocalUser(to)) return false;
  await createTransport().sendMail({
    from: fromAddress(),
    to,
    subject: 'Tu venta fue aprobada ✅',
    html: wrap(`
      ${header('✅ Venta aprobada')}
      <div style="padding:32px;">
        <p>Hola <strong>${sellerName}</strong>,</p>
        <p>Tu venta de <strong>${products}</strong> fue aprobada.</p>
        <div style="background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
          <p style="margin:0 0 6px;color:#717a9c;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Comisión ganada</p>
          <p style="margin:0;font-size:24px;font-weight:800;color:#00d4aa;">${c$(comision)}</p>
        </div>
        <p style="color:#717a9c;font-size:13px;">Se pagará en el corte semanal correspondiente.</p>
      </div>
      ${footer()}
    `),
  });
  return true;
}

// Venta rechazada → notifica al vendedor con el motivo.
async function sendSaleRejected({ to, sellerName, products, reason }) {
  if (!config.email.user || await isLocalUser(to)) return false;
  await createTransport().sendMail({
    from: fromAddress(),
    to,
    subject: 'Tu venta fue rechazada',
    html: wrap(`
      ${header('Venta rechazada')}
      <div style="padding:32px;">
        <p>Hola <strong>${sellerName}</strong>,</p>
        <p>Tu venta de <strong>${products}</strong> fue rechazada.</p>
        <div style="background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:20px;margin:24px 0;">
          <p style="margin:0 0 6px;color:#717a9c;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Motivo</p>
          <p style="margin:0;">${reason || 'No se indicó un motivo.'}</p>
        </div>
      </div>
      ${footer()}
    `),
  });
  return true;
}

// Pago realizado → notifica al vendedor, con screenshot del depósito adjunto/visible.
async function sendPaymentMade({ to, sellerName, amount, screenshotUrl, ventasCount, paymentMethod, noReceiptComment, saldoAplicado }) {
  if (!config.email.user || await isLocalUser(to)) return false;

  const formattedMethod = paymentMethod === 'cash' ? '💵 Efectivo' : '🏦 Depósito';
  const portalUrl = `${config.appUrl}/admin/ventas`;
  const saldo = Number(saldoAplicado) || 0;
  const saldoBlock = saldo !== 0 ? `
        <div style="background:${saldo > 0 ? 'rgba(0,212,170,0.08)' : 'rgba(244,63,94,0.08)'};border:1px solid ${saldo > 0 ? 'rgba(0,212,170,0.25)' : 'rgba(244,63,94,0.25)'};border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 6px;color:${saldo > 0 ? '#00d4aa' : '#fb7185'};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${saldo > 0 ? 'Saldo a tu favor aplicado' : 'Saldo en contra descontado'}</p>
          <p style="margin:0;font-size:14px;color:#e2e8f0;">Por un ajuste en una venta ya pagada, este pago ${saldo > 0 ? 'incluye' : 'se le descontó'} <strong>${c$(Math.abs(saldo))}</strong>.</p>
        </div>` : '';

  await createTransport().sendMail({
    from: fromAddress(),
    to,
    subject: 'Pago de comisiones realizado 💸',
    html: wrap(`
      ${header('💸 Pago realizado')}
      <div style="padding:32px;">
        <p style="margin-top:0;">Hola <strong>${sellerName}</strong>,</p>
        <p>Se ha registrado un nuevo pago de comisiones a tu favor correspondiente a <strong>${ventasCount || 1} venta(s)</strong> aprobada(s).</p>
        
        <div style="background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
          <p style="margin:0 0 6px;color:#717a9c;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Total Pagado</p>
          <p style="margin:0;font-size:28px;font-weight:800;color:#00d4aa;">${c$(amount)}</p>
          <p style="margin:12px 0 0;color:#717a9c;font-size:13px;">Método: ${formattedMethod}</p>
        </div>

        ${saldoBlock}

        ${noReceiptComment ? `
        <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 6px;color:#fcd34d;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Nota sobre el pago</p>
          <p style="margin:0;font-size:13px;color:#fde68a;">${noReceiptComment}</p>
        </div>` : ''}

        ${screenshotUrl ? `<div style="text-align:center;margin:20px 0;"><a href="${screenshotUrl}" style="color:#9aa0ff;text-decoration:none;font-size:14px;font-weight:600;">Ver comprobante adjunto →</a></div>` : ''}
        
        ${btn(portalUrl, 'Ver mis ventas en Gyro Store')}
      </div>
      ${footer()}
    `),
  });
  return true;
}

const LOGISTICS_STATUS_COPY = {
  recibido_china: {
    subject: 'Tu paquete fue recibido en nuestra bodega en China',
    title: '📦 ¡Paquete recibido en China!',
    body: 'Tu paquete fue confirmado en nuestra bodega en China. El tiempo estimado de llegada a Managua es de <strong>45 a 60 días</strong>.',
  },
  recibido_nicaragua: {
    subject: 'Tu paquete llegó a Nicaragua',
    title: '🇳🇮 ¡Tu paquete llegó a Nicaragua!',
    body: 'Tu paquete ya está en Nicaragua. Nos pondremos en contacto para coordinar la entrega o retiro en Managua.',
  },
};

// Alerta a los admins de logística: un cliente registró un paquete nuevo.
async function sendLogisticsAdminAlert({ toEmails, customerName, trackingNumber, purchaseDate, photoUrl }) {
  if (!config.email.user || !toEmails?.length) return false;
  await createTransport().sendMail({
    from: fromAddress(),
    to: toEmails.join(','),
    subject: `Gyro Logistics — Nuevo paquete de ${customerName}`,
    html: wrap(`
      ${header('📦 Nuevo paquete registrado')}
      <div style="padding:32px;">
        <p><strong>${customerName}</strong> registró un nuevo paquete en Gyro Logistics:</p>
        <div style="background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:20px;margin:24px 0;">
          <p style="margin:0 0 6px;color:#717a9c;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Tracking</p>
          <p style="margin:0 0 14px;font-weight:700;color:#9aa0ff;">${trackingNumber || '—'}</p>
          <p style="margin:0 0 6px;color:#717a9c;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Fecha de compra</p>
          <p style="margin:0;font-weight:700;">${purchaseDate || '—'}</p>
        </div>
        ${photoUrl ? btn(photoUrl, 'Ver foto del paquete') : ''}
      </div>
      ${footer()}
    `),
  });
  return true;
}

// Alerta a los admins: el cliente marcó que el proveedor entregó en China (por validar).
async function sendLogisticsValidateAlert({ toEmails, customerName, trackingNumber }) {
  if (!config.email.user || !toEmails?.length) return false;
  await createTransport().sendMail({
    from: fromAddress(),
    to: toEmails.join(','),
    subject: `Gyro Logistics — Entrega por validar de ${customerName}`,
    html: wrap(`
      ${header('🏷️ Entrega en China por validar')}
      <div style="padding:32px;">
        <p><strong>${customerName}</strong> marcó que su proveedor ya entregó la mercadería en la bodega de China.</p>
        <p>Por favor validen la recepción en el portal de Gyro Logistics.</p>
        <div style="background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:20px;margin:24px 0;">
          <p style="margin:0 0 6px;color:#717a9c;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Tracking</p>
          <p style="margin:0;font-weight:700;color:#9aa0ff;">${trackingNumber || '—'}</p>
        </div>
      </div>
      ${footer()}
    `),
  });
  return true;
}

// Notifica al cliente que su paquete cambió de estado. En la llegada a Nicaragua incluye
// el costo total de envío y la foto si se adjuntaron.
async function sendLogisticsStatusEmail({ to, customerName, status, comment, shippingCost, shippingCurrency, photoUrl }) {
  if (!config.email.user || await isLocalUser(to)) return false;
  const copy = LOGISTICS_STATUS_COPY[status];
  if (!copy) return false;
  const sym = shippingCurrency === 'USD' ? '$' : 'C$';
  await createTransport().sendMail({
    from: fromAddress(),
    to,
    subject: `Gyro Logistics — ${copy.subject}`,
    html: wrap(`
      ${header(copy.title)}
      <div style="padding:32px;">
        <p>Hola <strong>${customerName}</strong>,</p>
        <p>${copy.body}</p>
        ${comment ? `<div style="background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:20px;margin:24px 0;"><p style="margin:0 0 6px;color:#717a9c;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Comentario del equipo</p><p style="margin:0;">${comment}</p></div>` : ''}
        ${Number.isFinite(shippingCost) && shippingCost > 0 ? `<div style="background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:20px;margin:24px 0;"><p style="margin:0 0 6px;color:#717a9c;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Costo total de envío</p><p style="margin:0;font-weight:700;">${sym}${shippingCost}</p></div>` : ''}
        ${photoUrl ? btn(photoUrl, 'Ver foto de la mercadería') : ''}
      </div>
      ${footer()}
    `),
  });
  return true;
}

module.exports = {
  ROLE_NAMES,
  sendLocalInvite,
  sendGuestInvite,
  sendContactMessage,
  sendSaleApproved,
  sendSaleRejected,
  sendPaymentMade,
  sendLogisticsAdminAlert,
  sendLogisticsValidateAlert,
  sendLogisticsStatusEmail,
};
