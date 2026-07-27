/* ===================================================================
 * 동네 축구왕 — 백그라운드 알림 수신 (FCM 전용 서비스워커)
 *
 * 앱이 꺼져 있거나 다른 탭을 보고 있을 때 도착한 알림을 처리한다.
 * 기존 sw.js(오프라인 캐시)와는 별개로 동작한다.
 * 이 파일은 반드시 사이트 루트(/firebase-messaging-sw.js)에 있어야 한다.
 * =================================================================== */
importScripts('https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDta6TclznndZwBO0Nv9dXg3rZHaOVGOnE",
  authDomain: "fcjemiro-b1263.firebaseapp.com",
  projectId: "fcjemiro-b1263",
  storageBucket: "fcjemiro-b1263.firebasestorage.app",
  messagingSenderId: "655854550724",
  appId: "1:655854550724:web:45b6c996c0c47cd0e9d391"
});

var messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  var d = payload.data || {};
  var n = payload.notification || {};
  var title = n.title || d.title || '동네 축구왕';
  var options = {
    body: n.body || d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || 'kicktown',
    data: { screen: d.screen || '', url: d.url || '/' }
  };
  return self.registration.showNotification(title, options);
});

/* 알림을 누르면 이미 열린 앱 창으로 이동, 없으면 새로 연다 */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url.indexOf(self.location.origin) === 0 && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
