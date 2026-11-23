import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assert} from 'node:console';
import {chromium} from 'playwright';
import nodeAssert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let target=resolve(root,'.'+pathname);
  if(pathname.endsWith('/'))target=resolve(target,'index.html');
  if(target!==root&&!target.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{
    const bytes=await readFile(target);
    res.writeHead(200,{'content-type':mime[extname(target)]||'application/octet-stream','cache-control':'no-store'});
    res.end(bytes);
  }catch{res.writeHead(404).end('not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch({headless:true});
const screenshots=resolve(root,'browser-tests','screenshots');
await mkdir(screenshots,{recursive:true});
async function createPage(viewport){
  const context=await browser.newContext({viewport,serviceWorkers:'block',acceptDownloads:true});
  const page=await context.newPage();
  // Visual tests must not depend on external analytics or chart CDNs.
  await page.route(/googletagmanager|google-analytics|cdn\.plot\.ly/,route=>route.abort());
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof document.querySelector('#preset-load')?.onclick==='function',{timeout:20000});
  return {context,page};
}
try{
  const {context,page}=await createPage({width:1440,height:900});
  // Presets are collapsed by default. Exercise the actual UI instead of
  // relying on selecting a hidden form field.
  await page.locator('#preset-toggle').click();
  await page.selectOption('#preset-list','conic-analysis');
  await page.click('#preset-load');
  nodeAssert.equal(await page.locator('.field').count(),4);
  const toggle=page.locator('#view-mode');
  nodeAssert.equal(await toggle.isVisible(),true,'botão 2D/3D deve permanecer visível em cônicas');
  nodeAssert.equal(await toggle.getAttribute('data-mode'),'2d');
  for(const expected of ['3d','2d','3d','2d']){
    await toggle.click();
    nodeAssert.equal(await toggle.getAttribute('data-mode'),expected);
    nodeAssert.equal(await toggle.isVisible(),true,'botão desapareceu depois de alternar');
  }
  const layout=await page.evaluate(()=>{
    const rect=el=>el.getBoundingClientRect();
    const add=document.querySelector('#add'),tabs=[...document.querySelectorAll('#tabs .tab')];
    const strip=document.querySelector('#tabs'),grid=document.querySelector('#pad .grid:not(.hidden)');
    return {
      addBottomMargin:getComputedStyle(add).marginBottom,
      tabs:tabs.map(t=>({label:t.textContent.trim(),borderBottom:getComputedStyle(t).borderBottomWidth,
        bottom:rect(t).bottom,top:rect(t).top})),
      stripBottom:rect(strip).bottom,
      gridTop:rect(grid).top
    };
  });
  nodeAssert.ok(parseFloat(layout.addBottomMargin)>=10,'espaçamento após o botão nova função');
  nodeAssert.equal(layout.tabs.length,6);
  for(const tab of layout.tabs){
    nodeAssert.ok(parseFloat(tab.borderBottom)>=1,'borda inferior ausente em '+tab.label);
    nodeAssert.ok(tab.bottom<=layout.stripBottom-6,'aba cortada em '+tab.label);
  }
  nodeAssert.ok(layout.stripBottom<=layout.gridTop+1,'abas não devem invadir o teclado');
  await page.screenshot({path:resolve(screenshots,'desktop-conicas-2d.png')});
  const download=page.waitForEvent('download');
  await page.click('#project-export');
  const downloaded=await download;
  nodeAssert.match(downloaded.suggestedFilename(),/^curva-projeto-\d{4}-\d{2}-\d{2}\.json$/);
  const projectText=await readFile(await downloaded.path(),'utf8');
  const project=JSON.parse(projectText);
  nodeAssert.equal(project.state.equations.length,4);
  nodeAssert.equal(project.state.view3d.mode,'2d');
  await page.locator('#project-file').setInputFiles({name:'meu-projeto.json',mimeType:'application/json',buffer:Buffer.from(projectText)});
  await page.waitForFunction(()=>document.querySelector('#project-status')?.textContent.includes('importado'));
  nodeAssert.equal(await page.locator('.field').count(),4);

  await page.locator('.field').first().fill('calc: [[2,0,0],[0,1,0],[0,0,0.5]]');
  await page.locator('summary').filter({hasText:'transformação 3D'}).first().click();
  await page.waitForFunction(()=>document.querySelector('.transform3d-controls output')?.textContent.includes('det A'));
  await page.locator('#view-mode').click();
  await page.screenshot({path:resolve(screenshots,'desktop-transformacao-3d.png')});

  // The 3D cone + oblique plane + hyperbola preset must open in 3D and
  // remain interactive after returning to 2D and then back to 3D.
  await page.selectOption('#preset-list','cone-hyperbola-planes-3d');
  await page.click('#preset-load');
  await page.waitForFunction(()=>document.querySelector('#view-mode')?.dataset.mode==='3d');
  nodeAssert.equal(await page.locator('.field').count(),3);
  nodeAssert.equal(await toggle.getAttribute('data-mode'),'3d');
  await page.screenshot({path:resolve(screenshots,'desktop-hiperbole-plano-cone-3d.png')});
  // The section preset must expose independent shape, placement and
  // rotation controls; modifying a slider must change the visible 3D scene.
  const firstConic=page.locator('.row').first();
  nodeAssert.equal(await firstConic.locator('.param-control').count(),6);
  const initialImage=await page.locator('#stage').screenshot();
  for(const [name,value] of [['h','3'],['a','1.5'],['d','1.1'],['p','0.7'],['q','90']]){
    await firstConic.locator('.param-control[data-param="'+name+'"] input[type="number"]').fill(value);
    await page.waitForTimeout(120);
  }
  const modifiedImage=await page.locator('#stage').screenshot();
  nodeAssert.notDeepEqual(modifiedImage,initialImage,'Parâmetros devem alterar o gráfico 3D');
  const horizontalOffset=firstConic.locator('.param-control[data-param="b"] input[type="number"]');
  const horizontalSlider=firstConic.locator('.param-control[data-param="b"] input[type="range"]');
  nodeAssert.equal(await horizontalSlider.getAttribute('min'),'-4');
  nodeAssert.equal(await horizontalSlider.getAttribute('max'),'4');
  await horizontalOffset.fill('0');
  await page.waitForTimeout(120);
  nodeAssert.equal(await horizontalOffset.inputValue(),'0');
  const crossing=await page.locator('#stage').screenshot();
  await horizontalOffset.fill('-1');
  await page.waitForTimeout(120);
  const negative=await page.locator('#stage').screenshot();
  nodeAssert.notDeepEqual(crossing,negative,'Mover b de 0 para -1 deve alterar o plano na cena');
  await horizontalOffset.fill('0');
  // UI edits are persisted with a debounce; inspect the state directly
  // instead of requesting a second browser download (Chromium can block it).
  await page.waitForFunction(()=>{
    const state=JSON.parse(localStorage.getItem('curva-state-v1')||'{}');
    const eq=state.equations?.[0];
    return eq?.params?.b===0&&eq.params.q===90&&eq.params.h===3;
  },undefined,{timeout:10000});
  const geometryState=await page.evaluate(()=>JSON.parse(localStorage.getItem('curva-state-v1')));
  nodeAssert.equal(geometryState.equations[0].params.h,3);
  nodeAssert.equal(geometryState.equations[0].params.a,1.5);
  nodeAssert.equal(geometryState.equations[0].params.d,1.1);
  nodeAssert.equal(geometryState.equations[0].params.p,.7);
  nodeAssert.equal(geometryState.equations[0].params.q,90);
  nodeAssert.equal(geometryState.equations[0].params.b,0,'O deslocamento b=0 deve ser preservado');
  await page.screenshot({path:resolve(screenshots,'desktop-plano-vertical-em-x-zero.png')});
  await page.screenshot({path:resolve(screenshots,'desktop-hiperbole-parametros-ajustados.png')});

  await toggle.click();
  nodeAssert.equal(await toggle.getAttribute('data-mode'),'2d');
  await toggle.click();
  nodeAssert.equal(await toggle.getAttribute('data-mode'),'3d');
  await context.close();

  const {context:mobile,page:phone}=await createPage({width:390,height:844});
  const tabs=phone.locator('#tabs .tab');
  nodeAssert.equal(await tabs.count(),6);
  const widths=await tabs.evaluateAll(nodes=>nodes.map(n=>({
    width:n.getBoundingClientRect().width,border:getComputedStyle(n).borderBottomWidth
  })));
  for(const tab of widths){
    nodeAssert.ok(tab.width>20,'aba estreita demais no mobile');
    nodeAssert.ok(parseFloat(tab.border)>=1);
  }
  await phone.screenshot({path:resolve(screenshots,'mobile-teclado.png')});
  await mobile.close();
  console.log('Browser UI: preset 2D/3D, seis abas, espaçamento, projetos, transformação 3D e mobile OK.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
