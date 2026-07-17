/* 동네 축구왕 서비스 워커 — 네트워크 우선(배포 즉시 반영) + 오프라인 폴백 */
var CACHE = 'kicktown-v1';

self.addEventListener('install', function(e){
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return; // Firebase/카카오 등 외부는 건드리지 않음
  e.respondWith(
    fetch(req).then(function(res){
      var copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
      return res;
    }).catch(function(){
      return caches.match(req, {ignoreSearch:true}).then(function(hit){
        return hit || caches.match('./index.html', {ignoreSearch:true});
      });
    })
  );
});
