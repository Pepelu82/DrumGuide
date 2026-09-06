const CACHE='drumguide-v10-35';
const CORE=['./','./index.html','./styles.css?v=10.35.0','./app.js?v=10.35.0','./icon.svg?v=10.35.0','./icon-192.png?v=10.35.0','./icon-512.png','./manifest.webmanifest?v=10.35.0'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const req=e.request,url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 e.respondWith(fetch(req,{cache:'no-store'}).then(resp=>{if(resp&&resp.ok){const cp=resp.clone();caches.open(CACHE).then(c=>c.put(req,cp));}return resp;}).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html'))));
});
