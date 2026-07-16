// GET /api/kakao/callback?code=...
// 1) 인가 코드를 액세스 토큰으로 교환  2) 프로필 조회
// 3) {kakaoId, name}를 HMAC 서명한 2분짜리 티켓(ks)으로 만들어 앱 URL 해시에 실어 리다이렉트
var crypto = require('node:crypto');

function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

module.exports = async function handler(req, res) {
  try {
    var restKey = process.env.KAKAO_REST_KEY;
    var clientSecret = process.env.KAKAO_CLIENT_SECRET || ''; // 카카오 콘솔에서 활성화한 경우만
    var redirectUri = process.env.KAKAO_REDIRECT_URI;
    var appUrl = process.env.APP_URL;                          // 예: https://hmjeon-cloud.github.io/FCJEMIRO/
    var hmacSecret = process.env.HMAC_SECRET;
    if (!restKey || !redirectUri || !appUrl || !hmacSecret) {
      res.status(500).send('환경변수(KAKAO_REST_KEY/KAKAO_REDIRECT_URI/APP_URL/HMAC_SECRET) 미설정');
      return;
    }

    var code = (req.query && req.query.code) ||
      new URL(req.url, 'http://x').searchParams.get('code');
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

    var sep = appUrl.indexOf('#') >= 0 ? '&' : '#';
    res.writeHead(302, { Location: appUrl + sep + 'ks=' + encodeURIComponent(ks) });
    res.end();
  } catch (e) {
    res.status(500).send('server error');
  }
};
