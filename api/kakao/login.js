
// GET /api/kakao/login
// 사용자를 카카오 OAuth 동의 화면으로 리다이렉트한다. (REST 키는 서버에만 존재)
module.exports = function handler(req, res) {
  var restKey = process.env.KAKAO_REST_KEY;
  var redirectUri = process.env.KAKAO_REDIRECT_URI; // 예: https://your-backend/api/kakao/callback
  if (!restKey || !redirectUri) {
    res.status(500).send('KAKAO_REST_KEY / KAKAO_REDIRECT_URI 환경변수가 설정되지 않았습니다.');
    return;
  }
  var url = 'https://kauth.kakao.com/oauth/authorize'
    + '?client_id=' + encodeURIComponent(restKey)
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&response_type=code'
    + '&scope=' + encodeURIComponent('profile_nickname');
  res.writeHead(302, { Location: url });
  res.end();
};
