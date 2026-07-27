/* 동네 축구왕 서비스 워커
   - HTML(화면): 항상 최신(no-store 네트워크) → 접속 시 최신 버전 보장, 오프라인 시 캐시 폴백
   - 정적 자원(이미지·CSS·JS·폰트): 캐시 우선 + 백그라운드 갱신 → 재접속 로딩 가속
   - 서비스워커 스크립트 자체는 캐시하지 않음 (알림 등록 실패 방지) */
var CACHE = 'kicktown-v3';

self.addEventListener('install', function(e){ self.skipWaiting(); });

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* 앱에서 캐시 정리 요청(업데이트 시) */
self.addEventListener('message', function(e){
  if(e.data==='CLEAR_CACHE'){
    caches.keys().then(function(ks){ ks.forEach(function(k){ caches.delete(k); }); });
  }
});

function isStatic(url){ return /\.(png|jpg|jpeg|webp|gif|svg|ico|css|js|woff2?|ttf|otf)$/i.test(url.pathname); }

/* 서비스워커 스크립트는 항상 네트워크에서 직접 받아야 한다.
   캐시된 옛 응답(특히 파일이 없던 시절의 404)이 남으면 등록이 실패한다. */
function isServiceWorkerScript(url){
  return url.pathname === '/sw.js' || url.pathname === '/firebase-messaging-sw.js';
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return;   // Firebase/카카오 등 외부는 건드리지 않음

  if(isServiceWorkerScript(url)) return;            // 가로채지 않고 브라우저에 맡김

  var wantsHTML = (req.mode==='navigate') || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');

  if(wantsHTML){
    // 화면(HTML)은 항상 최신 → no-store 네트워크 우선, 실패 시 캐시
    e.respondWith(
      fetch(req, {cache:'no-store'}).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
        return res;
      }).catch(function(){
        return caches.match(req, {ignoreSearch:true}).then(function(hit){
          return hit || caches.match('./index.html', {ignoreSearch:true});
        });
      })
    );
    return;
  }

  if(isStatic(url)){
    // 정적 자원은 캐시 우선(빠름) + 백그라운드 갱신
    e.respondWith(
      caches.match(req, {ignoreSearch:true}).then(function(hit){
        var net = fetch(req).then(function(res){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
          return res;
        }).catch(function(){ return hit; });
        return hit || net;
      })
    );
    return;
  }

  // 기타 same-origin(version.json 등): 네트워크 우선
  e.respondWith(
    fetch(req).then(function(res){
      var copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
      return res;
    }).catch(function(){ return caches.match(req, {ignoreSearch:true}); })
  );
});
