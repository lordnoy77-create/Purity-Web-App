const { clearSessionCookie, createToken, getSession, sessionCookie } = require('./_shared/auth');

const APP_SCRIPT_URL = process.env.APP_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbxoxuV0Q8DcMASguKTsd6R7r6IgR8Gt-DpgNbUfHIm1r1VeLk236WbudUK0pLIEK-MaIg/exec';
const API_PROXY_KEY = 'purity-netlify-proxy-2026-v1';

function json(statusCode, body, cookie) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return { statusCode, headers, body: JSON.stringify(body) };
}

async function appsScriptLogin(username, password) {
  const response = await fetch(APP_SCRIPT_URL, {
    method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'login', proxyKey: API_PROXY_KEY, username, password }),
    signal: AbortSignal.timeout(25000)
  });
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { throw new Error('กรุณาอัปเดตและ Deploy Apps Script เวอร์ชันล่าสุด'); }
}

exports.handler = async event => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    const action = body.action || 'status';
    if (action === 'status') {
      const session = getSession(event);
      return session ? json(200, { authenticated: true, user: session }) : json(401, { authenticated: false });
    }
    if (action === 'logout') return json(200, { success: true }, clearSessionCookie());
    if (action !== 'login') return json(400, { error: 'action ไม่ถูกต้อง' });

    const result = await appsScriptLogin(String(body.username || ''), String(body.password || ''));
    if (!result.success || !result.user) return json(401, { error: result.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    const user = { ...result.user, mustChangePassword: false };
    return json(200, { success: true, user }, sessionCookie(createToken(user)));
  } catch (error) {
    console.error(error);
    if (error.name === 'TimeoutError') return json(504, { error: 'ระบบ Login ใช้เวลาตอบกลับนานเกินไป' });
    return json(error instanceof SyntaxError ? 400 : 502, { error: error.message || 'ระบบเข้าสู่ระบบขัดข้อง' });
  }
};
