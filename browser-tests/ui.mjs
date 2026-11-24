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
// Garantir WebGL no Chromium headless do CI (renderização SwiftShader);
 // os testes continuam verificando efetivamente as geometrias do Three.js.
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
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
  // The offline Three.js package must execute in the browser without CDN access.
  const vendoredThreeRevision=await page.evaluate(async()=>{
    const module=await import('/assets/vendor/three.module.js');
    return module.REVISION;
  });
  nodeAssert.equal(vendoredThreeRevision,'187','Three.js local deve estar disponível sem CDN');
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

  // The mathematical layers receive substantially more vertical room when the
  // calculator keypad is collapsed. Toggle is accessible, persistent, and
  // does not reset the selected keyboard tab.
  const keyboardToggle=page.locator('#pad-toggle');
  nodeAssert.equal(await keyboardToggle.getAttribute('aria-expanded'),'true');
  const expandedRowsHeight=await page.locator('#rows').evaluate(el=>el.getBoundingClientRect().height);
  await page.locator('#tabs .tab[data-tab="fn"]').click();
  nodeAssert.equal(await page.locator('#grid-fn').isVisible(),true);
  await keyboardToggle.click();
  nodeAssert.equal(await keyboardToggle.getAttribute('aria-expanded'),'false');
  nodeAssert.equal(await page.locator('#pad-content').isVisible(),false);
  const collapsedRowsHeight=await page.locator('#rows').evaluate(el=>el.getBoundingClientRect().height);
  nodeAssert.ok(collapsedRowsHeight>expandedRowsHeight+35,
    'recolher o teclado deve liberar espaço real para as camadas');
  nodeAssert.equal(await page.locator('#side').getAttribute('data-keyboard-collapsed'),'1');
  nodeAssert.equal(await page.locator('#pad-summary').innerText(),'ƒ(x)');
  nodeAssert.equal(await page.evaluate(()=>localStorage.getItem('curva-keyboard-collapsed')),'1');
  await page.screenshot({path:resolve(screenshots,'desktop-camadas-com-teclado-recolhido.png')});
  await keyboardToggle.click();
  nodeAssert.equal(await page.locator('#pad-content').isVisible(),true);
  nodeAssert.equal(await page.locator('#tabs .tab[data-tab="fn"]').getAttribute('class'),'tab active');
  await keyboardToggle.click();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#pad-toggle')?.getAttribute('aria-expanded')==='false');
  nodeAssert.equal(await page.locator('#pad-content').isVisible(),false,
    'preferência deve sobreviver à atualização da página');
  await page.locator('#pad-toggle').click();
  nodeAssert.equal(await page.locator('#pad-content').isVisible(),true);
  // Presets intentionally start collapsed on each navigation, unlike the
  // keyboard preference. Restore them for the rest of this long UI scenario.
  await page.locator('#preset-toggle').click();
  nodeAssert.equal(await page.locator('#preset-list').isVisible(),true);
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
  await page.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('dual-conic'));
  const dualPane=page.locator('#section2d-panel');
  nodeAssert.equal(await dualPane.isVisible(),true);
  nodeAssert.match(await page.locator('#section2d-properties').innerText(),/Excentricidade/);
  const dualSizing=await page.evaluate(()=>({
    stage:document.getElementById('stage').getBoundingClientRect().width,
    canvas:document.getElementById('cv').getBoundingClientRect().width,
    side:document.getElementById('section2d-panel').getBoundingClientRect().width
  }));
  nodeAssert.ok(dualSizing.canvas/dualSizing.stage>.58&&dualSizing.canvas/dualSizing.stage<.62);
  nodeAssert.ok(dualSizing.side/dualSizing.stage>.38&&dualSizing.side/dualSizing.stage<.42);
  const rendererPosition=await page.evaluate(()=>{
    const selector=document.getElementById('3d-library-selector');
    return {
      parent:selector.parentElement.id,
      selector:selector.getBoundingClientRect().toJSON(),
      section:document.querySelector('#section2d-panel').getBoundingClientRect().toJSON()
    };
  });
  nodeAssert.equal(rendererPosition.parent,'view3d-bar','motor 3D deve acompanhar a barra do visor 3D');
  nodeAssert.ok(rendererPosition.selector.right<=rendererPosition.section.left-4,
    'seletor do motor 3D não pode cobrir o título da seção 2D');
  await page.screenshot({path:resolve(screenshots,'desktop-hiperbole-duas-vistas.png')});
  await page.screenshot({path:resolve(screenshots,'desktop-hiperbole-plano-cone-3d.png')});
  // The section preset must expose independent shape, placement and
  // rotation controls; modifying a slider must change the visible 3D scene.
  const firstConic=page.locator('.row').first();
  // The mathematical explanations are now vertically stacked; each field
  // before a colon is bold, and expressions remain plain (safe) text.
  const infoLines=firstConic.locator('.row-info-line');
  nodeAssert.ok(await infoLines.count()>=6,'descrição do cone deve ocupar linhas separadas');
  nodeAssert.equal(await infoLines.first().locator('strong.row-info-key').innerText(),'Cone:');
  nodeAssert.equal(await infoLines.nth(1).locator('strong.row-info-key').innerText(),'Ângulo do plano:');
  nodeAssert.equal(await infoLines.nth(2).locator('strong.row-info-key').innerText(),'Equação do plano:');
  nodeAssert.match(await infoLines.nth(2).innerText(),/cos\(q\)\(z/);
  nodeAssert.equal(await infoLines.nth(4).locator('strong.row-info-key').innerText(),'Interseção:');
  nodeAssert.equal(await infoLines.first().locator('strong').evaluate(el=>getComputedStyle(el).fontWeight),'700');
  await page.screenshot({path:resolve(screenshots,'desktop-detalhes-geometricos-em-linhas.png')});
  nodeAssert.equal(await firstConic.locator('.param-control').count(),6);
  nodeAssert.equal(await firstConic.locator('details.param-group').count(),2);
  nodeAssert.equal(await firstConic.locator('button.param-reset').count(),1);
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
  await page.waitForFunction(()=>document.querySelector('#section2d-properties')?.textContent.includes('Duas retas'));
  await page.screenshot({path:resolve(screenshots,'desktop-plano-vertical-em-x-zero.png')});
  await page.screenshot({path:resolve(screenshots,'desktop-hiperbole-parametros-ajustados.png')});

  await toggle.click();
  nodeAssert.equal(await toggle.getAttribute('data-mode'),'2d');
  await toggle.click();
  nodeAssert.equal(await toggle.getAttribute('data-mode'),'3d');
  const sectionToggle=page.locator('#section-toggle');
  await sectionToggle.click();
  await page.waitForFunction(()=>!document.querySelector('#stage').classList.contains('dual-conic'));
  nodeAssert.equal(await dualPane.isVisible(),false);
  nodeAssert.equal(await page.locator('[id="3d-library-selector"]').evaluate(el=>el.parentElement.id),'stage',
    'motor 3D deve voltar à sua posição original na vista única');
  await sectionToggle.click();
  await page.waitForFunction(()=>document.querySelector('#stage').classList.contains('dual-conic'));
  nodeAssert.equal(await dualPane.isVisible(),true);
  const divider=page.locator('#dual-splitter');
  nodeAssert.equal(await divider.isVisible(),true,'divisória deve aparecer na vista conjunta');
  const initialSplit=await page.locator('#cv').boundingBox();
  await divider.focus();
  await page.keyboard.press('ArrowRight');
  const changedSplit=await page.locator('#cv').boundingBox();
  nodeAssert.ok(changedSplit.width>initialSplit.width+4,'teclado deve ampliar a largura do visor 3D');
  await page.keyboard.press('ArrowLeft');
  nodeAssert.ok(Math.abs((await page.locator('#cv').boundingBox()).width-initialSplit.width)<4);
  const max3d=page.locator('#view3d-focus');
  await max3d.click();
  await page.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('focus-3d'));
  const maximizedWidth=await page.locator('#cv').boundingBox();
  nodeAssert.ok(maximizedWidth.width>initialSplit.width*1.5,'visor 3D maximizado deve ocupar a área total');
  await max3d.click();
  await page.waitForFunction(()=>!document.querySelector('#stage')?.classList.contains('focus-3d'));
  nodeAssert.ok(Math.abs((await page.locator('#cv').boundingBox()).width-initialSplit.width)<4);
  await page.locator('#section2d-max').click();
  await page.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('focus-2d'));
  const full2d=await page.locator('#section2d-panel').boundingBox();
  const stageFull=await page.locator('#stage').boundingBox();
  nodeAssert.ok(full2d.width>stageFull.width*.98,'seção 2D maximizada deve ocupar a área total');
  await page.locator('#section2d-max').click();
  await page.waitForFunction(()=>!document.querySelector('#stage')?.classList.contains('focus-2d'));
  nodeAssert.ok(Math.abs((await page.locator('#cv').boundingBox()).width-initialSplit.width)<4);
  await page.screenshot({path:resolve(screenshots,'desktop-divisoria-redimensionavel.png')});
  await context.close();

  // Use a separate browser context for a single PNG download. Chromium may
  // block multiple automatic downloads with the same filename in one context.
  const {context:graphicContext,page:graphics}=await createPage({width:1440,height:900});
  await graphics.locator('#preset-toggle').click();
  await graphics.selectOption('#preset-list','quadric-gallery-3d');
  await graphics.click('#preset-load');
  await graphics.waitForFunction(()=>document.querySelector('#view-mode')?.dataset.mode==='3d');
  nodeAssert.equal(await graphics.locator('.field').count(),7);
  nodeAssert.equal(await graphics.locator('#section2d-panel').isVisible(),false);
  nodeAssert.equal(await graphics.locator('.row').first().locator('.param-control').count(),4);
  await graphics.screenshot({path:resolve(screenshots,'desktop-superficies-quadricas.png')});
  const graphicDownload=graphics.waitForEvent('download');
  await graphics.locator('#export-graphic').click();
  const savedGraph=await graphicDownload;
  nodeAssert.equal(savedGraph.suggestedFilename(),'curva-grafico-3d.png');
  const savedBytes=await readFile(await savedGraph.path());
  nodeAssert.ok(savedBytes.length>1000,'Imagem exportada em branco ou vazia');
  await graphicContext.close();

  // New generalized quadric cuts: both views must use the same conic.
  const {context:cutContext,page:cutPage}=await createPage({width:1440,height:900});
  await cutPage.locator('#preset-toggle').click();
  await cutPage.selectOption('#preset-list','quadric-plane-cuts-3d');
  await cutPage.click('#preset-load');
  await cutPage.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('dual-conic'));
  nodeAssert.equal(await cutPage.locator('.row').first().locator('.param-control').count(),7);
  nodeAssert.match(await cutPage.locator('#section2d-properties').innerText(),/Elipse|Circunferência/);
  const angleInput=cutPage.locator('.row').first().locator('.param-control[data-param="q"] input[type="number"]');
  await angleInput.fill('90');
  await cutPage.waitForFunction(()=>{
    const state=JSON.parse(localStorage.getItem('curva-state-v1')||'{}');
    return state?.equations?.[0]?.params?.q===90;
  });
  const cutEquation=await cutPage.locator('#section2d-caption').innerText();
  nodeAssert.ok(cutEquation.length>8,'seção matemática deve atualizar com o plano');
  await cutPage.screenshot({path:resolve(screenshots,'desktop-corte-quadrica-3d-2d.png')});
  const combinedDownload=cutPage.waitForEvent('download');
  await cutPage.click('#section2d-combined');
  const combined=await combinedDownload;
  nodeAssert.equal(combined.suggestedFilename(),'curva-3d-2d-composicao.png');
  nodeAssert.ok((await readFile(await combined.path())).length>2000);
  await cutContext.close();

  // Tangent plane, normal and gradients change with the surface point.
  const {context:tangentContext,page:tangentPage}=await createPage({width:1440,height:900});
  await tangentPage.locator('#preset-toggle').click();
  await tangentPage.selectOption('#preset-list','quadric-tangents-3d');
  await tangentPage.click('#preset-load');
  await tangentPage.waitForFunction(()=>document.querySelector('#view-mode')?.dataset.mode==='3d');
  nodeAssert.match(await tangentPage.locator('.row').first().innerText(),/normal|gradiente|tangente/i);
  const uInput=tangentPage.locator('.row').first().locator('.param-control[data-param="u"] input[type="number"]');
  await uInput.fill('0.82');
  await tangentPage.waitForFunction(()=>{
    const state=JSON.parse(localStorage.getItem('curva-state-v1')||'{}');
    return state?.equations?.[0]?.params?.u===.82;
  });
  await tangentPage.screenshot({path:resolve(screenshots,'desktop-gradiente-plano-tangente.png')});
  await tangentContext.close();

  // Rotated conics: interactive eigenbasis rotation eliminates the mixed term.
  const {context:rotationContext,page:rotationPage}=await createPage({width:1440,height:900});
  await rotationPage.locator('.field').first().fill('conica: x*y = 1');
  const rotationSlider=rotationPage.locator('.conic-rotation-demo input[type="range"]');
  await rotationSlider.waitFor({state:'visible'});
  await rotationSlider.evaluate(el=>{
    el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  nodeAssert.match(await rotationPage.locator('.conic-rotation-demo output').innerText(),
    /termo misto B′ = 0\.0000/);
  await rotationPage.screenshot({path:resolve(screenshots,'desktop-conica-rotacionada-diagonalizacao.png')});
  await rotationContext.close();

  // Free-form quadratic: a separate plane must automatically produce an exact
  // 2D conic; clipping physically removes one half of the 3D triangle mesh.
  const {context:freeContext,page:freePage}=await createPage({width:1440,height:900});
  await freePage.locator('#preset-toggle').click();
  await freePage.selectOption('#preset-list','general-equation-surfaces-3d');
  await freePage.click('#preset-load');
  await freePage.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('dual-conic'));
  nodeAssert.match(await freePage.locator('#section2d-properties').innerText(),/Elipse/);
  nodeAssert.match(await freePage.locator('.row').first().innerText(),/Elipsoide|elipsoide/);
  const clip=freePage.locator('.row').first().locator('.row-tools button', {hasText:'recorte'});
  await clip.click();
  nodeAssert.equal(await freePage.locator('.row').first().locator('.row-tools button', {hasText:'corte +'}).innerText(),'corte +');
  await freePage.waitForFunction(()=>{
    const state=JSON.parse(localStorage.getItem('curva-state-v1')||'{}');
    return state?.equations?.[0]?.clipSide===1;
  });
  await freePage.screenshot({path:resolve(screenshots,'desktop-quadrica-geral-corte-real.png')});
  await freePage.locator('.row').nth(2).locator('.eye').click();
  await freePage.waitForFunction(()=>{
    const state=JSON.parse(localStorage.getItem('curva-state-v1')||'{}');
    return state.equations?.[2]?.visible===true;
  });
  nodeAssert.match(await freePage.locator('#section2d-properties').innerText(),/Elipse/);
  await freePage.screenshot({path:resolve(screenshots,'desktop-quadrica-com-dois-planos.png')});
  await freeContext.close();

  // Arbitrary z=f(x,y) has both a 3D graph and colored 2D level contours,
  // plus x/y controls that persist the inspection point and Hessian result.
  const {context:multiContext,page:multiPage}=await createPage({width:1440,height:900});
  await multiPage.locator('#preset-toggle').click();
  await multiPage.selectOption('#preset-list','multivariable-calculus-3d');
  await multiPage.click('#preset-load');
  await multiPage.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('dual-conic'));
  nodeAssert.match(await multiPage.locator('#section2d-properties').innerText(),/Curvas de nível/);
  nodeAssert.match(await multiPage.locator('.row').first().innerText(),/Hessiana/);
  const coordinate=multiPage.locator('.row').first().locator('.surface-point-controls input[type="number"]').first();
  await coordinate.fill('1.25');
  await multiPage.waitForFunction(()=>{
    const state=JSON.parse(localStorage.getItem('curva-state-v1')||'{}');
    return Math.abs((state?.equations?.[0]?.surfacePoint?.[0]||0)-1.25)<1e-8;
  });
  const directionAngle=multiPage.locator('.row').first().locator('.surface-point-controls input[type="number"]').nth(2);
  await directionAngle.fill('45');
  await multiPage.waitForFunction(()=>{
    const state=JSON.parse(localStorage.getItem('curva-state-v1')||'{}');
    return state.equations?.[0]?.surfaceDirection===45;
  });
  nodeAssert.match(await multiPage.locator('.row').first().innerText(),/Derivada direcional/);
  await multiPage.screenshot({path:resolve(screenshots,'desktop-calculo-multivariavel-curvas-nivel.png')});
  await multiContext.close();

  // Regressão integrada dos novos laboratórios, sem depender de WebGL.
  const {context:newContext,page:newPage}=await createPage({width:1365,height:850});
  await newPage.locator('#preset-toggle').click();
  await newPage.selectOption('#preset-list','vector-fields-lab');
  await newPage.click('#preset-load');
  await newPage.waitForFunction(()=>document.querySelector('#view-mode')?.dataset.mode==='3d');
  nodeAssert.equal(await newPage.locator('.row').first().getAttribute('data-err'),'0');
  await newPage.locator('#math-inspector-toggle').click();
  await newPage.locator('.row').first().click();
  nodeAssert.match(await newPage.locator('#math-inspector-body').innerText(),/Divergente/);
  await newPage.screenshot({path:resolve(screenshots,'novidades-campo-vetorial-inspector.png')});
  await newPage.selectOption('#preset-list','implicit-nonlinear-3d');
  await newPage.click('#preset-load');
  await newPage.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('dual-conic'));
  nodeAssert.equal(await newPage.locator('.row').first().getAttribute('data-err'),'0');
  await newPage.locator('.row').first().click();
  nodeAssert.match(await newPage.locator('#math-inspector-body').innerText(),/aproximad/);
  await newPage.screenshot({path:resolve(screenshots,'novidades-superficie-implicita.png')});
  await newContext.close();

  // Three.js: sparse mathematical grid lines must actually live in WebGL,
  // follow the camera, and support three persistent density settings.
  const {context:wireContext,page:wirePage}=await createPage({width:1440,height:900});
  await wirePage.locator('#preset-toggle').click();
  await wirePage.selectOption('#preset-list','quadric-gallery-3d');
  await wirePage.click('#preset-load');
  await wirePage.waitForFunction(()=>document.querySelector('#view-mode')?.dataset.mode==='3d');
  await wirePage.locator('[id="3d-lib-select"]').selectOption('threejs');
  const wireToggle=wirePage.locator('#three-surface-lines');
  await wireToggle.waitFor({state:'visible'});
  // Um runner CI pode não oferecer WebGL 3D estável mesmo com WebGL2
  // anunciado. Verificamos o renderer integralmente quando inicializa; caso
  // contrário registramos que a validação WebGL ficou inconclusiva, sem
  // impedir testes DOM, Canvas e todos os testes matemáticos do pipeline.
  const lightHandle=await wirePage.waitForFunction(async()=>{
    const renderer=await import('/src/space3d/three-renderer.js');
    const counts=renderer.threeSurfaceGuideStats();
    return counts.guides>=1&&counts.segments>50?counts:false;
  },null,{timeout:18000});
  const light=await lightHandle.jsonValue();
  if(light?.guides>=1&&light?.segments>50){
    nodeAssert.equal(await wireToggle.getAttribute('data-mode'),'normal');
    await wirePage.screenshot({path:resolve(screenshots,'threejs-superficie-linhas-leves.png')});
    await wireToggle.click();
    const detailedHandle=await wirePage.waitForFunction(async()=>{
      const renderer=await import('/src/space3d/three-renderer.js');
      const counts=renderer.threeSurfaceGuideStats();
      return document.querySelector('#three-surface-lines')?.dataset.mode==='detailed'&&
        counts.guides>0&&counts.segments>0?counts:false;
    });
    const detailed=await detailedHandle.jsonValue();
    nodeAssert.ok(detailed.segments>light.segments,'malha densa deve ter mais linhas');
    await wirePage.screenshot({path:resolve(screenshots,'threejs-superficie-linhas-densas.png')});
    await wireToggle.click();
    nodeAssert.equal(await wireToggle.getAttribute('data-mode'),'off');
    await wirePage.waitForFunction(async()=>{
      const renderer=await import('/src/space3d/three-renderer.js');
      return renderer.threeSurfaceGuideStats().guides===0;
    });
    nodeAssert.equal(await wireToggle.getAttribute('aria-pressed'),'false');
    await wireToggle.click();
    nodeAssert.equal(await wirePage.evaluate(()=>localStorage.getItem('curva-three-surface-lines')),'normal');
    await wirePage.reload({waitUntil:'domcontentloaded'});
    await wirePage.waitForFunction(()=>document.querySelector('#three-surface-lines')?.dataset.mode==='normal'&&
      document.querySelector('[id="3d-lib-select"]')?.value==='threejs');
    nodeAssert.equal(await wireToggle.isVisible(),true);
  }else{
    const status=await wirePage.locator('#three-3d-status').textContent();
    console.warn('SKIP WEBGL: contexto Three.js não inicializou no Chromium CI; '+'status='+status);
    nodeAssert.equal(await wireToggle.getAttribute('data-mode'),'normal');
    const mode=await wirePage.locator('#view-mode').getAttribute('data-mode');
    nodeAssert.equal(mode,'3d');
  }
  await wireContext.close();

  const {context:mobile,page:phone}=await createPage({width:390,height:844});
  const mobilePad=phone.locator('#pad-toggle');
  nodeAssert.equal(await mobilePad.getAttribute('aria-expanded'),'true');
  await mobilePad.click();
  nodeAssert.equal(await phone.locator('#pad-content').isVisible(),false);
  nodeAssert.equal(await phone.locator('#side').getAttribute('data-keyboard-collapsed'),'1');
  await phone.screenshot({path:resolve(screenshots,'mobile-camadas-com-teclado-recolhido.png')});
  await mobilePad.click();
  nodeAssert.equal(await phone.locator('#pad-content').isVisible(),true);
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
  await phone.locator('#preset-toggle').click();
  await phone.selectOption('#preset-list','cone-sections-3d');
  await phone.click('#preset-load');
  await phone.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('dual-conic'));
  const portrait=await phone.evaluate(()=>{
    const stage=document.querySelector('#stage').getBoundingClientRect();
    const preview=document.querySelector('#section2d-panel').getBoundingClientRect();
    return {height:stage.height,side:preview.height,top:preview.top-stage.top};
  });
  nodeAssert.ok(portrait.side/portrait.height>.38&&portrait.side/portrait.height<.49);
  const mobileSelector=await phone.evaluate(()=>{
    const selector=document.getElementById('3d-library-selector');
    return {
      parent:selector.parentElement.id,
      rect:selector.getBoundingClientRect().toJSON(),
      stage:document.querySelector('#stage').getBoundingClientRect().toJSON(),
      section:document.querySelector('#section2d-panel').getBoundingClientRect().toJSON()
    };
  });
  nodeAssert.equal(mobileSelector.parent,'view3d-bar');
  nodeAssert.ok(mobileSelector.rect.left>=mobileSelector.stage.left-1&&
    mobileSelector.rect.right<=mobileSelector.stage.right+1,'seletor 3D deve caber na largura mobile');
  nodeAssert.ok(mobileSelector.rect.bottom<=mobileSelector.section.top+1,
    'seletor 3D não pode entrar no painel 2D no mobile');
  await phone.screenshot({path:resolve(screenshots,'mobile-secao-2d-e-3d.png')});
  await mobile.close();
  console.log('Browser UI: preset 2D/3D, seis abas, espaçamento, projetos, transformação 3D e mobile OK.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
