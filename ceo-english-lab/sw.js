/* CEO English Lab PWA: caches only our own shell, not YouTube or user media. */
const VERSION='ceo-lab-v2.1';
const SHELL=['./','./index.html','./styles.css?v=2.1','./app.mjs?v=2.1','./core.mjs','./data.mjs','./warmups.mjs','./manifest.webmanifest','./assets/favicon.svg','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ceo-lab-')&&key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(VERSION).then(cache=>cache.put('./index.html',copy));}return response;}).catch(async()=>{const cache=await caches.open(VERSION);return await cache.match('./index.html')||Response.error();}));
    return;
  }
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req)));
});