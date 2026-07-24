# 동네 축구왕 — iOS 빌드 가이드 (Capacitor 8)

작성일: 2026-07-24 · Bundle ID: `com.kick-town.app` · Team ID: `87LAA4BF74`

> 이 문서는 **클라우드 맥에 접속한 뒤** 순서대로 실행하는 절차입니다.
> 맥 임대 비용을 아끼려면 아래 준비물을 먼저 갖춘 뒤 접속하세요.

---

## 0. 접속 전 준비물 체크

- [ ] Apple Developer Program 가입 완료
- [ ] Bundle ID `com.kick-town.app` 등록 완료
- [ ] APNs 키 `.p8` 파일 + Key ID + Team ID 확보
- [ ] App Store Connect에 앱 레코드 생성 완료
- [ ] 이 폴더(`ios/`) 전체를 맥으로 옮길 준비 (압축해서 클라우드 스토리지 경유)

## 1. 클라우드 맥 환경 준비

MacinCloud 등 접속 후 터미널에서:

```bash
# Homebrew (없으면)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js
brew install node
node -v      # v20 이상이면 충분

# CocoaPods (Capacitor iOS 의존성 관리)
sudo gem install cocoapods
pod --version
```

Xcode는 대부분의 클라우드 맥에 이미 설치되어 있습니다. 없다면 App Store에서 설치하세요(용량이 커서 시간이 걸립니다).

## 2. 프로젝트 배치

```bash
mkdir -p ~/kicktown && cd ~/kicktown
# 이 폴더의 package.json, capacitor.config.json, resources/ 를 여기에 복사
```

### 웹 자산 채우기 (중요)

`www/` 폴더에 **실제 서비스 중인 파일들**을 그대로 넣습니다.

```bash
mkdir -p www
cd www
# GitHub 저장소에서 받아오는 것이 가장 정확합니다
curl -O https://kick-town.com/index.html
curl -O https://kick-town.com/manifest.json
curl -O https://kick-town.com/sw.js
curl -O https://kick-town.com/icon-192.png
curl -O https://kick-town.com/icon-512.png
curl -O https://kick-town.com/icon-maskable-192.png
curl -O https://kick-town.com/icon-maskable-512.png
curl -O https://kick-town.com/apple-touch-icon.png
curl -O https://kick-town.com/favicon.ico
cd ..
```

> **주의**: `index.html`은 반드시 네이티브 브리지가 포함된 v1.0 이상이어야 합니다.
> 확인: `grep -c "KTN" www/index.html` → 30 이상이면 정상.

## 3. 의존성 설치 및 iOS 프로젝트 생성

```bash
npm install
npx cap add ios
```

## 4. 아이콘 / 스플래시 자동 생성

```bash
npx capacitor-assets generate --ios
```

`resources/icon.png`(1024×1024)와 `resources/splash.png`(2732×2732)로부터
필요한 모든 크기를 자동 생성합니다.

## 5. Info.plist 권한 문구 추가 (필수)

Xcode에서 `ios/App/App/Info.plist`를 열고 아래 항목을 추가합니다.
**이 문구가 없으면 앱이 실행 중 강제 종료되거나 심사에서 거절됩니다.**

| Key | Value |
|---|---|
| `NSLocationWhenInUseUsageDescription` | 경기장 도착 여부를 확인해 출석 체크인을 하기 위해 위치 정보를 사용합니다. |
| `NSFaceIDUsageDescription` | 앱 잠금 해제를 위해 Face ID를 사용합니다. |
| `NSCameraUsageDescription` | 프로필 사진 촬영을 위해 카메라를 사용합니다. |
| `NSPhotoLibraryUsageDescription` | 프로필 사진 선택을 위해 사진 보관함에 접근합니다. |

소스 코드로 직접 넣으려면 `<dict>` 안에 추가:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>경기장 도착 여부를 확인해 출석 체크인을 하기 위해 위치 정보를 사용합니다.</string>
<key>NSFaceIDUsageDescription</key>
<string>앱 잠금 해제를 위해 Face ID를 사용합니다.</string>
```

## 5-1. URL 스킴 등록 (카카오 로그인 필수)

카카오 로그인 후 앱으로 돌아오려면 `kicktown://` 스킴을 등록해야 합니다.
**이 설정이 없으면 카카오 로그인이 완료되지 않습니다.**

Xcode → App 타겟 → **Info** 탭 → **URL Types** → **+**

| 항목 | 값 |
|---|---|
| Identifier | `com.kick-town.app` |
| URL Schemes | `kicktown` |
| Role | Editor |

Info.plist 소스로 직접 넣으려면:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.kick-town.app</string>
    <key>CFBundleURLSchemes</key>
    <array><string>kicktown</string></array>
  </dict>
</array>
```

### 카카오 백엔드 환경변수도 함께 확인

Vercel의 **카카오 백엔드** 프로젝트에 아래 두 개가 필요합니다.

| 변수 | 값 |
|---|---|
| `NATIVE_REDIRECT_URL` | `kicktown://auth` |
| `ALLOW_ORIGIN` | `https://kick-town.com,capacitor://localhost` |

`ALLOW_ORIGIN`에 `capacitor://localhost`가 없으면 앱에서 CORS 오류로 로그인이 실패합니다.

## 6. Xcode 설정

```bash
npx cap sync ios
npx cap open ios
```

Xcode가 열리면 **App 타겟 → Signing & Capabilities**에서:

1. **Team**: 본인 개발자 계정 선택 (`87LAA4BF74`)
2. **Bundle Identifier**: `com.kick-town.app` 확인
3. **+ Capability** 클릭 → **Push Notifications** 추가
4. **+ Capability** → **Background Modes** → `Remote notifications` 체크

## 7. 시뮬레이터 확인

Xcode 상단에서 iPhone 시뮬레이터 선택 후 실행(▶).

**시뮬레이터에서 확인 가능한 것**
- 화면 레이아웃, 스플래시, 상태표시줄
- 로그인 / 데이터 조회 / 화면 전환
- 오프라인 배너 (네트워크 링크 컨디셔너로 테스트)

**시뮬레이터에서 확인 불가 — 실기기 필요**
- Face ID 실제 동작
- GPS 실제 좌표 정확도
- 푸시 알림 실제 수신

## 8. 아카이브 및 업로드

1. Xcode 상단 디바이스 선택을 **Any iOS Device (arm64)** 로 변경
2. 메뉴 **Product → Archive**
3. 완료되면 Organizer 창에서 **Distribute App**
4. **App Store Connect** → **Upload** 선택
5. 서명은 **Automatically manage signing** 권장

업로드 후 App Store Connect에서 처리에 10~30분 걸립니다.

## 9. TestFlight 배포 (실기기 검증)

1. App Store Connect → 앱 → **TestFlight** 탭
2. 빌드가 "테스트 준비 완료"로 바뀌면 내부 테스터 추가
3. 팀원 아이폰에 TestFlight 앱 설치 → 초대 수락 → 설치
4. **여기서 Face ID / GPS / 푸시를 실기기로 검증**

## 10. 심사 제출 전 최종 점검

- [ ] 스크린샷: 6.7형(1290×2796) 필수, 6.5형 권장 — 시뮬레이터 캡처 가능
- [ ] 개인정보처리방침 URL: `https://kick-town.com/privacy.html`
- [ ] 계정 삭제 경로 안내: 앱 내 [더보기] → [회원탈퇴]
- [ ] 앱 심사 정보에 **테스트 계정** 제공 (심사자가 로그인해야 하므로 필수)
- [ ] 연령 등급 설문
- [ ] 수출 규정 준수: HTTPS만 사용 → "표준 암호화만 사용" 선택

### ⚠️ 가이드라인 4.2 대응 메모

심사 노트(App Review Notes)에 아래 취지를 적어 두면 도움이 됩니다.

> 본 앱은 아마추어 축구팀 운영을 위한 앱으로, 다음 네이티브 기능을 제공합니다.
> - 경기 일정 및 출석 요청 푸시 알림 (APNs)
> - Face ID 기반 앱 잠금
> - GPS 기반 경기장 도착 출석 체크인
> - 오프라인 상태에서의 경기 기록·명단 열람
> 웹사이트에서는 제공할 수 없는 기능들이며, 팀 운영이라는 특정 목적에 맞춰 설계되었습니다.

## 11. 이후 업데이트 절차

웹(안드로이드)은 커밋만 하면 자동 반영되지만, **iOS는 다릅니다.**

1. `www/index.html`을 최신으로 교체
2. `npx cap sync ios`
3. Xcode에서 빌드 번호 올리고 Archive → Upload
4. App Store 심사 (24~48시간)

즉 **iOS는 앱 내용을 바꿀 때마다 심사를 거쳐야** 합니다. 이 점을 감안해 릴리스 주기를 잡으세요.
