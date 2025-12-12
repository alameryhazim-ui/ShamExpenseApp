const CACHE = 'sham-expenses-v1';
const ASSETS = [
  '/index.html','/style.css','/app.js','/manifest.json',
  '/icons/icon-purple-192.png','/icons/icon-purple-512.png',
  '/icons/icon-blackgold-192.png','/icons/icon-blackgold-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js'
];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}));
});
self.addEventListener('fetch', e=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request).then(resp=>{
    if (e.request.url.startsWith(self.location.origin) || e.request.url.includes('cdn.jsdelivr.net')) {
      caches.open(CACHE).then(cache=>cache.put(e.request, resp.clone()));
    }
    return resp;
  }).catch(()=>caches.match('/index.html'))));
});