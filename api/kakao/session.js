// POST /api/kakao/session   body: { ks }
// 앱이 해시로 받은 티켓(ks)을 되물어옴 → HMAC 검증 + 만료 확인 후 {kakaoId, name} 반환.
// 서명 비밀은 서버에만 있으므로 위조 불가. 앱은 HTTPS 응답만 신뢰한다.
//
// ALLOW_ORIGIN 은 쉼표로 여러 개 지정할 수 있다.
//   예: https://kick-town.com,https://hmjeon-cloud.github.io,capacitor://localhost
// iOS 네이티브 앱(Capacitor)의 출처는 capacitor://localhost 이므로 반드시 포함해야 한다.
var crypto = require('node:crypto');
function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}
function safeEq(a, b) {
  var ab = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
function pickOrigin(req) {
  var raw = process.env.ALLOW_ORIGIN || '*';
  var list = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (list.indexOf('*') >= 0) return '*';
  var reqOrigin = req.headers.origin || '';
  if (reqOrigin && list.indexOf(reqOrigin) >= 0) return reqOrigin;
  return list[0] || '*';
}
module.exports = async function handler(req, res) {
  var origin = pickOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method' }); return; }
  try {
    var hmacSecret = process.env.HMAC_SECRET;
    if (!hmacSecret) { res.status(500).json({ ok: false, error: 'not configured' }); return; }
    var body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
    if (!body) {
      body = await new Promise(function (resolve) {
        var d = '';
        req.on('data', function (c) { d += c; });
        req.on('end', function () { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } });
      });
    }
    var ks = body && body.ks;
    if (!ks || String(ks).indexOf('.') < 0) { res.status(400).json({ ok: false, error: 'bad ticket' }); return; }
    var parts = String(ks).split('.');
    var payloadB64 = parts[0], sig = parts[1];
    if (!safeEq(sig, sign(payloadB64, hmacSecret))) { res.status(401).json({ ok: false, error: 'signature' }); return; }
    var payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) { res.status(401).json({ ok: false, error: 'expired' }); return; }
    res.status(200).json({ ok: true, kakaoId: String(payload.kakaoId), name: payload.name || '카카오사용자' });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server' });
  }
};
