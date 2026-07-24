// GET /api/kakao/login[?native=1]
// 사용자를 카카오 OAuth 동의 화면으로 리다이렉트한다. (REST 키는 서버에만 존재)
// native=1 이면 state=native 를 실어 보내, 콜백이 앱(kicktown://)으로 되돌리도록 한다.
module.exports = function handler(req, res) {
  var restKey = process.env.KAKAO_REST_KEY;
  var redirectUri = process.env.KAKAO_REDIRECT_URI; // 예: https://your-backend/api/kakao/callback
  if (!restKey || !redirectUri) {
    res.status(500).send('KAKAO_REST_KEY / KAKAO_REDIRECT_URI 환경변수가 설정되지 않았습니다.');
    return;
  }
  var native = (req.query && req.query.native) ||
    new URL(req.url, 'http://x').searchParams.get('native');

  var url = 'https://kauth.kakao.com/oauth/authorize'
    + '?client_id=' + encodeURIComponent(restKey)
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&response_type=code'
    + '&scope=' + encodeURIComponent('profile_nickname');

  // 값은 'native' 리터럴만 사용한다. 임의 주소를 받지 않으므로 오픈 리다이렉트가 발생하지 않는다.
  if (String(native) === '1') url += '&state=native';

  res.writeHead(302, { Location: url });
  res.end();
};
