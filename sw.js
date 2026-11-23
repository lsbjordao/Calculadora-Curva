const CACHE='curva-pwa-geometry-lab-v10';
const CORE=["./favicon.svg","./index.html","./src/accessibility.js","./src/algebra-lessons.js","./src/algebra-symbols.js","./src/algebra-ui.js","./src/algebra-workbench.js","./src/analysis.js","./src/app.js","./src/coords.js","./src/data-table.js","./src/geometry-builder.js","./src/export-graphic.js","./src/geometry.js","./src/history.js","./src/integrate.js","./src/lessons.js","./src/linear-algebra.js","./src/linear-transform-view.js","./src/numeric.js","./src/op-controls.js","./src/project-controls.js","./src/project-file.js","./src/parser.js","./src/presets.js","./src/regress.js","./src/space3d/conic-sections.js","./src/space3d/section-analysis.js","./src/space3d/section-panel.js","./src/space3d/quadrics.js","./src/space3d/camera.js","./src/space3d/geometry3d.js","./src/space3d/library-manager.js","./src/space3d/plotly-renderer.js","./src/space3d/render3d.js","./src/space3d/scene3d.js","./src/space3d/transform3d.js","./src/space3d/three-renderer.js","./src/space3d/view3d.js","./src/stats.js","./src/steps.js","./src/storage.js","./src/style-editor.js","./src/symbolic.js","./src/table.js","./style.css","./manifest.webmanifest","./assets/curva-192.png","./assets/curva-512.png","./"];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('curva-pwa-')&&k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin)return;
  event.respondWith(fetch(req).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});}
    return response;
  }).catch(async()=>{
    const cache=await caches.open(CACHE);
    return await cache.match(req)||(req.mode==='navigate'?await cache.match('./index.html'):undefined)||Response.error();
  }));
});
