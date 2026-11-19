# AI로 전술 만들기 — 서버 설정 (한 번만)

앱 → 전술 → 새 전술 → **AI로 전술 만들기**가 동작하려면 Supabase에 함수 하나와 Claude API 키가 필요합니다.
API 키는 Supabase 비밀값에만 저장되고, 브라우저(사이트 파일)에는 들어가지 않습니다.

## 1. Claude API 키 (5분)
1. https://platform.claude.com 로그인 → **API Keys → Create Key** → 키 복사 (`sk-ant-...`)
2. **Billing**에서 크레딧 충전, **Limits**에서 월 사용 한도를 정해 두면 안전합니다.

## 2. Supabase 함수 배포 (5분)
1. Supabase 대시보드 → 프로젝트 → **Edge Functions → Deploy a new function → Via Editor**
2. 함수 이름: `kt-tactic-ai` (정확히 이 이름)
3. 기본 코드를 지우고 `supabase/functions/kt-tactic-ai/index.ts` 내용을 전부 붙여넣기 → **Deploy**
4. **Edge Functions → Secrets**에 추가
   - `ANTHROPIC_API_KEY` = 1에서 복사한 키
   - `KT_ALLOWED_ORIGINS` = `https://kick-town.com,https://www.kick-town.com` (내 사이트 주소, 쉼표로 여러 개)
   - (선택) `KT_AI_DAILY_LIMIT` = `60` (하루 최대 호출 수)
   - (선택) `KT_AI_MODEL` = 기본값 `claude-sonnet-5-5`

## 3. (선택) 하루 사용 한도 집계
SQL Editor에 `supabase/kt_ai_setup.sql` 붙여넣고 Run. 없으면 한도 없이 동작합니다.

## 4. 확인
앱에서 예시 하나를 눌러 **AI로 만들기** → 20~60초 뒤 장면 목록이 나오면 완료.

| 화면에 보이는 메시지 | 해결 |
|---|---|
| AI 기능이 아직 서버에 설치되지 않았어요 | 함수 이름이 `kt-tactic-ai` 인지, Deploy 됐는지 확인 |
| 서버에 Claude API 키가 등록되지 않았어요 | Secrets에 `ANTHROPIC_API_KEY` 추가 |
| 요청을 거부했어요(401) | 함수 상세 → Settings → **Verify JWT** 끄기 |
| 네트워크 연결을 확인해 주세요 | `KT_ALLOWED_ORIGINS`에 지금 접속한 주소가 있는지 확인 |
| AI 호출 실패: … | 키가 올바른지, 크레딧이 남았는지 확인 |
