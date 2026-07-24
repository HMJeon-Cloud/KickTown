// GET /api/kakao/callback?code=...&state=...
// 1) 인가 코드를 액세스 토큰으로 교환  2) 프로필 조회
// 3) {kakaoId, name}를 HMAC 서명한 2분짜리 티켓(ks)으로 만들어 복귀 주소 해시에 실어 리다이렉트
//    - 웹      → APP_URL            (예: https://kick-town.com)
//    - 네이티브 → NATIVE_REDIRECT_URL (예: kicktown://auth)
var crypto = require('node:crypto');
function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}
module.exports = async function handler(req, res) {
  try {
    var restKey = process.env.KAKAO_REST_KEY;
    var clientSecret = process.env.KAKAO_CLIENT_SECRET || ''; // 카카오 콘솔에서 활성화한 경우만
    var redirectUri = process.env.KAKAO_REDIRECT_URI;
    var appUrl = process.env.APP_URL;                          // 예: https://kick-town.com
    var nativeUrl = process.env.NATIVE_REDIRECT_URL || 'kicktown://auth';
    var hmacSecret = process.env.HMAC_SECRET;
    if (!restKey || !redirectUri || !appUrl || !hmacSecret) {
      res.status(500).send('환경변수(KAKAO_REST_KEY/KAKAO_REDIRECT_URI/APP_URL/HMAC_SECRET) 미설정');
      return;
    }
    var qs = new URL(req.url, 'http://x').searchParams;
    var code = (req.query && req.query.code) || qs.get('code');
    var state = (req.query && req.query.state) || qs.get('state');
    if (!code) { res.status(400).send('missing code'); return; }

    // 1) 토큰 교환
    var form = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: restKey,
      redirect_uri: redirectUri,
      code: code
    });
    if (clientSecret) form.set('client_secret', clientSecret);
    var tokRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: form
    });
    var tok = await tokRes.json();
    if (!tok || !tok.access_token) {
      res.status(502).send('토큰 교환 실패: ' + JSON.stringify(tok));
      return;
    }

    // 2) 프로필 조회
    var meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: 'Bearer ' + tok.access_token }
    });
    var me = await meRes.json();
    var kakaoId = String(me.id);
    var name = (me.kakao_account && me.kakao_account.profile && me.kakao_account.profile.nickname) || '카카오사용자';

    // 3) 서명 티켓 (2분 만료)
    var payload = { kakaoId: kakaoId, name: name, exp: Date.now() + 120000 };
    var payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    var ks = payloadB64 + '.' + sign(payloadB64, hmacSecret);

    // 복귀 대상 결정 — state 는 'native' 리터럴만 허용하고, 실제 주소는 서버 환경변수에서 가져온다
    var target = (String(state) === 'native') ? nativeUrl : appUrl;
    var sep = target.indexOf('#') >= 0 ? '&' : '#';
    res.writeHead(302, { Location: target + sep + 'ks=' + encodeURIComponent(ks) });
    res.end();
  } catch (e) {
    res.status(500).send('server error');
  }
};
