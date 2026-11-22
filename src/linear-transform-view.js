import { validateMatrix, eye, matmul, det, trace, eiginfo, svd } from './linear-algebra.js';

const mix = (A,B,t) => A.map((row,i) => row.map((x,j) => (1-t)*x+t*B[i][j]));
export function transformationMatrix(A, t = 1, decomposition = null) {
  validateMatrix(A);
  if (A.length !== 2 || A[0].length !== 2) throw new Error('Visualização disponível apenas para matrizes 2×2.');
  t = Math.min(1,Math.max(0,Number.isFinite(t)?t:1));
  if (!decomposition) return mix(eye(2),A,t);
  const {U,S,Vt} = decomposition, sigma = [[S[0],0],[0,S[1]]];
  if (t <= 1/3) return mix(eye(2),Vt,t*3);
  if (t <= 2/3) return matmul(mix(eye(2),sigma,t*3-1),Vt);
  return matmul(mix(eye(2),U,t*3-2),matmul(sigma,Vt));
}
export function buildTransformScene(A, options = {}) {
  const t = options.t ?? 1, current = transformationMatrix(A,t,options.decomposition);
  const point = (x,y) => { const v = matmul(current,[[x],[y]]); return {x:v[0][0],y:v[1][0]}; };
  const origin = {x:0,y:0}, segments = [], vectors = [], lines = [];
  if (options.showOriginal !== false) {
    for (let k = -5; k <= 5; k++) segments.push({a:{x:k,y:-5},b:{x:k,y:5},style:'dotted',opacity:.2}, {a:{x:-5,y:k},b:{x:5,y:k},style:'dotted',opacity:.2});
    const unit = [origin,{x:1,y:0},{x:1,y:1},{x:0,y:1}];
    unit.forEach((a,i) => segments.push({a,b:unit[(i+1)%4],style:'dashed',opacity:.7}));
    vectors.push({from:origin,to:{x:1,y:0},label:'i'}, {from:origin,to:{x:0,y:1},label:'j'});
  }
  if (options.showTransformed !== false) {
    for (let k = -5; k <= 5; k++) segments.push({a:point(k,-5),b:point(k,5),opacity:.3}, {a:point(-5,k),b:point(5,k),opacity:.3});
  }
  vectors.push({from:origin,to:point(1,0),label:'A(t) i'}, {from:origin,to:point(0,1),label:'A(t) j'});
  const info = [`det = ${det(current)}`,`traço = ${trace(current)}`];
  let eigen = null;
  try {
    eigen = eiginfo(current);
    info.push('autovalores = '+eigen.value.join(', '));
    if (options.showEigen !== false) for (const {vector:[x,y],value} of eigen.pairs) {
      lines.push({a:-y,b:x,c:0,style:'dashed'});
      vectors.push({from:origin,to:{x,y},label:'v'}, {from:origin,to:point(x,y),label:`A v = ${Number(value.toPrecision(5))} v`});
    }
    info.push(...eigen.warnings);
  } catch (e) { if (e.code !== 'COMPLEX') throw e; info.push(e.message); }
  return {type:'matrix',points:[],segments,vectors,lines,polygons:[{points:[origin,point(1,0),point(1,1),point(0,1)],label:'A(t) unidade'}],
    matrix:{values:current,det:det(current),trace:trace(current),eigen},info};
}
export const decomposeTransform = A => svd(A);

// Cores individuais dos planos: a mesma linha de resultado reúne três equações,
// mas cada superfície precisa manter sua identidade nas duas renderizações.
const SYSTEM_PLANE_COLORS=['#2878b8','#c46636','#24966b'];
export function buildSystemScene3D(A,b,solution){
  if(!Array.isArray(A)||A.length!==3||A.some(r=>!Array.isArray(r)||r.length!==3)||!Array.isArray(b)||b.length!==3)return null;
  b=b.map(x=>Array.isArray(x)?x[0]:x);
  if(A.some(r=>r.some(x=>!Number.isFinite(x)))||b.some(x=>!Number.isFinite(x)))return null;
  const scene=A.flatMap((row,i)=>Math.hypot(...row)>1e-12?
    [{kind:'plane',n:[...row],d:b[i],label:'Equação '+(i+1),alpha:.22,color:SYSTEM_PLANE_COLORS[i],systemPlane:true}]:[]);
  if(Array.isArray(solution)&&solution.length===3&&solution.every(Number.isFinite))
    scene.push({kind:'point',p:[...solution],label:'Solução',color:'#ba3f77',systemSolution:true});
  return scene;
}
export function buildSystemScene(A,b,solution) {
  if(A.length!==2 || A[0].length!==2 || b.length!==2) return null;
  b=b.flat();
  return {type:'system',lines:A.map((row,i)=>({a:row[0],b:row[1],c:-b[i],label:`equação ${i+1}`,style:i?'dashed':null})),
    points:solution ? [{x:solution[0],y:solution[1],label:'solução'}] : [],polygons:[],segments:[],vectors:[],info:[]};
}

// Each row owns its playback. Cancellation prevents detached controls from
// keeping animation loops alive after editing/removing/reordering equations.
export function createTransformControls(host, {getMatrix,onScene,onChange = () => {}}) {
  let t = 1, running = false, frame = null, previous = null, mode = 'linear', decomposition = null;
  const options = {showOriginal:true,showTransformed:true,showEigen:true};
  const add = (tag,text) => { const e = document.createElement(tag); if(text)e.textContent=text; host.appendChild(e); return e; };
  host.className = 'transform-controls';
  const play = add('button','iniciar'); play.type = 'button';
  const reset = add('button','reiniciar'); reset.type = 'button';
  const label = add('label','Tempo da transformação '), slider = document.createElement('input');
  slider.type = 'range'; slider.min = 0; slider.max = 1; slider.step = 0.005; slider.value = 1; label.appendChild(slider);
  const status = add('output'); status.setAttribute('aria-live','off');
  const selector = add('select'); selector.setAttribute('aria-label','Etapas da transformação');
  for (const [value,text] of [['linear','Identidade → A'],['svd','SVD: Vᵀ → Σ → U']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text; selector.appendChild(option);
  }
  const note = add('p');
  const update = () => {
    slider.value = t;
    const A = getMatrix();
    if (mode === 'svd' && !decomposition) decomposition = decomposeTransform(A);
    const scene = buildTransformScene(A,{...options,t,decomposition:mode==='svd'?decomposition:null});
    status.textContent = `t = ${t.toFixed(2)} · det = ${Number(scene.matrix.det.toPrecision(6))}`;
    note.textContent = mode === 'svd' ? `A = U Σ Vᵀ · ${t <= 1/3 ? 'Vᵀ: rotação ou reflexão' : t <= 2/3 ? 'Σ: escalas principais' : 'U: rotação ou reflexão'}. A interpolação pode atravessar matrizes singulares.` :
      'A(t) = (1 − t)I + tA · A v = λ v. '+(scene.matrix.eigen?.warnings.join(' ') || (scene.matrix.eigen ? '' : 'Sem direções próprias reais.'));
    onScene(scene); onChange(t);
  };
  const stop = () => { running=false; if(frame!==null) cancelAnimationFrame(frame); frame=null; previous=null; play.textContent='iniciar'; };
  const tick = now => {
    if (!running) return;
    if (previous != null) t = Math.min(1,t+Math.min(now-previous,100)/5000);
    previous=now; update();
    if (t >= 1) stop(); else frame=requestAnimationFrame(tick);
  };
  play.onclick = () => { if(running) stop(); else { if(t>=1)t=0; running=true; play.textContent='pausar'; frame=requestAnimationFrame(tick); } };
  reset.onclick = () => { stop(); t=0; update(); };
  slider.oninput = () => { stop(); t=Number(slider.value); update(); };
  selector.onchange = () => { stop(); mode=selector.value; t=0; update(); };
  for (const [key,text] of [['showOriginal','malha original'],['showTransformed','malha transformada'],['showEigen','direções próprias']]) {
    const l = add('label',text+' '), checkbox = document.createElement('input'); checkbox.type='checkbox'; checkbox.checked=true;
    checkbox.onchange=()=>{options[key]=checkbox.checked; update();}; l.appendChild(checkbox);
  }
  update();
  return {dispose:stop,refresh:()=>{decomposition=null;update();}};
}
