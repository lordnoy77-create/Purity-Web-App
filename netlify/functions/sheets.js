const { getSession } = require('./_shared/auth');

const APP_SCRIPT_URL = process.env.APP_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbxoxuV0Q8DcMASguKTsd6R7r6IgR8Gt-DpgNbUfHIm1r1VeLk236WbudUK0pLIEK-MaIg/exec';
const API_PROXY_KEY = 'purity-netlify-proxy-2026-v1';
const ACTION_PERMISSION = {
  search: 'defects', save: 'defects', dashboard: 'dashboard', defectHistory: 'defects', updateRawData: 'defects', deleteRawData: 'defects',
  parts: 'parts', savePart: 'parts', deletePart: 'parts', machines: 'parts', saveMachine: 'parts', deleteMachine: 'parts', weightInitial: 'weights', saveWeight: 'weights', weightHistory: 'weights', updateWeight: 'weights', deleteWeight: 'weights', users: 'users', saveUser: 'users', deleteUser: 'users', logs: 'logs'
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const session = getSession(event);
    if (!session) return json(401, { error: 'กรุณาเข้าสู่ระบบ' });
    if (session.mustChangePassword) return json(403, { error: 'กรุณาเปลี่ยนรหัสผ่านก่อนใช้งาน' });

    const body = JSON.parse(event.body || '{}');
    if (!Object.prototype.hasOwnProperty.call(ACTION_PERMISSION, body.action)) return json(400, { error: 'action ไม่ถูกต้อง' });
    const permission = ACTION_PERMISSION[body.action];
    if (['saveUser','deleteUser'].includes(body.action) && session.role !== 'admin') return json(403, { error: 'เฉพาะ Admin เท่านั้นที่จัดการผู้ใช้งานได้' });
    if (['updateRawData','savePart','saveMachine','updateWeight'].includes(body.action) && session.role !== 'admin' && session.canEdit !== true) return json(403, { error: 'คุณไม่มีสิทธิ์เพิ่มหรือแก้ไขข้อมูล' });
    if (['deleteRawData','deletePart','deleteMachine','deleteWeight'].includes(body.action) && session.role !== 'admin' && session.canDelete !== true) return json(403, { error: 'คุณไม่มีสิทธิ์ลบข้อมูล' });
    const userPermissions = Array.isArray(session.permissions) ? session.permissions : [];
    const allowed = session.role === 'admin' ||
      userPermissions.includes(permission) ||
      (['parts', 'machines'].includes(body.action) && userPermissions.length > 0);
    if (!allowed) return json(403, { error: 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้' });

    const response = await fetch(APP_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, proxyKey: API_PROXY_KEY, actor: session.sub }),
      signal: AbortSignal.timeout(25000)
    });
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error('Apps Script ยังไม่ตอบกลับเป็น JSON กรุณาอัปเดตและ Deploy App script เวอร์ชันใหม่');
    }
    if (!response.ok) return json(502, { error: result.error || `Apps Script HTTP ${response.status}` });
    return json(200, result);
  } catch (error) {
    console.error(error);
    if (error.name === 'TimeoutError') return json(504, { error: 'Apps Script ใช้เวลาตอบกลับนานเกินไป' });
    return json(error instanceof SyntaxError ? 400 : 502, { success: false, error: error.message, message: error.message });
  }
};
