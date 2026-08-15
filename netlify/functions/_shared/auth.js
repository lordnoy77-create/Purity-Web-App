const crypto = require('crypto');

const COOKIE_NAME = 'purity_session';
const SESSION_SECONDS = 60 * 60;
const BUILT_IN_SESSION_SECRET = 'purity-static-login-2026-ronnakorn-session-key';

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(data) {
  const secret = process.env.JWT_SECRET || BUILT_IN_SESSION_SECRET;
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

function createToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub: user.username,
    name: user.displayName,
    role: user.role,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    canEdit: user.role === 'admin' || user.canEdit === true,
    canDelete: user.role === 'admin' || user.canDelete === true,
    mustChangePassword: user.mustChangePassword,
    iat: now,
    exp: now + SESSION_SECONDS
  });
  const data = `${header}.${payload}`;
  return `${data}.${sign(data)}`;
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function verifyToken(token) {
  try {
    const [header, payload, signature] = String(token || '').split('.');
    if (!header || !payload || !signature) return null;
    const expected = sign(`${header}.${payload}`);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.exp || decoded.exp <= Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function getSession(event) {
  const cookies = parseCookies(event.headers?.cookie || event.headers?.Cookie || '');
  return verifyToken(cookies[COOKIE_NAME]);
}

function sessionCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  // ไม่มี Max-Age/Expires เพื่อให้เป็น Session Cookie และหายเมื่อปิด Browser
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict${secure}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex');
}

function verifyPassword(password, salt, expectedHash) {
  const actual = Buffer.from(hashPassword(password, salt), 'hex');
  const expected = Buffer.from(String(expectedHash), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = {
  clearSessionCookie,
  createToken,
  getSession,
  hashPassword,
  sessionCookie,
  verifyPassword
};
