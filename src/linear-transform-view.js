import { validateMatrix, eye, matmul, det, trace, eiginfo, svd, cross } from './linear-algebra.js';

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
const SYSTEM_SOLUTION_COLOR='#ba3f77';
// result (optional): the solveinfo result. With it, "ver planos" also draws the
// solution set: the line for rank 2 (infinite), one highlighted plane when the
// three planes coincide (rank 1), and nothing extra when inconsistent.
export function buildSystemScene3D(A,b,solution,result=null){
  if(!Array.isArray(A)||A.length!==3||A.some(r=>!Array.isArray(r)||r.length!==3)||!Array.isArray(b)||b.length!==3)return null;
  b=b.map(x=>Array.isArray(x)?x[0]:x);
  if(A.some(r=>r.some(x=>!Number.isFinite(x)))||b.some(x=>!Number.isFinite(x)))return null;
  const meta=result?.metadata||{};
  const rows=A.map((row,i)=>({row,i})).filter(({row})=>Math.hypot(...row)>1e-12);
  if(meta.classification==='infinite'&&meta.rank===1&&rows.length){
    const {row,i}=rows[0];
    return [{kind:'plane',n:[...row],d:b[i],label:'Equações 1–3: o mesmo plano',alpha:.34,
      color:SYSTEM_SOLUTION_COLOR,systemPlane:true,systemSolution:true}];
  }
  const scene=rows.map(({row,i})=>({kind:'plane',n:[...row],d:b[i],label:'Equação '+(i+1),alpha:.22,color:SYSTEM_PLANE_COLORS[i],systemPlane:true}));
  if(Array.isArray(solution)&&solution.length===3&&solution.every(Number.isFinite))
    scene.push({kind:'point',p:[...solution],label:'Solução',color:SYSTEM_SOLUTION_COLOR,systemSolution:true});
  else if(meta.classification==='infinite'&&meta.rank===2&&Array.isArray(result.value)&&result.value.every(Number.isFinite)){
    const v=nullDirection(A);
    if(v)scene.push({kind:'line',p:[...result.value],v,label:'Solução (reta)',color:SYSTEM_SOLUTION_COLOR,weight:3,systemSolution:true});
  }
  return scene;
}

// Direction of the null space of a rank-2 3×3 matrix: the largest cross product
// of two rows.
function nullDirection(A){
  let best=null,size=0;
  for(const [i,j] of [[0,1],[0,2],[1,2]]){
    const c=cross(A[i],A[j]),n=Math.hypot(...c);
    if(n>size){size=n;best=c.map(x=>x/n);}
  }
  return size>1e-12 ? best : null;
}

const fmtNum=x=>{const r=Number(Number(x).toPrecision(6));return String(Object.is(r,-0)?0:r);};
const fmtVec3=v=>'('+v.map(fmtNum).join(', ')+')';
// A direction shown with small integers when possible: (1, 1, -2), not (0.41, 0.41, -0.82).
function niceDirection(v){
  const nz=v.filter(x=>Math.abs(x)>1e-9);
  const m=Math.min(...nz.map(Math.abs));
  for(const k of [1,2,3,4,5,6]){
    const w=v.map(x=>x/m*k);
    if(w.every(x=>Math.abs(x-Math.round(x))<1e-7)){
      const r=w.map(x=>Math.round(x)+0);
      const first=r.find(x=>x!==0);
      return first<0 ? r.map(x=>-x+0) : r;
    }
  }
  return v;
}
// One sentence for "ver planos 3D".
export function systemSceneSummary(result,A=null){
  const meta=result?.metadata||{};
  if(meta.classification==='inconsistent')return 'sem solução: os três planos não têm ponto comum';
  if(meta.classification==='infinite'){
    if(meta.rank===1)return 'infinitas soluções: os três planos coincidem';
    const v=Array.isArray(A)&&A.length===3?nullDirection(A):null;
    if(meta.rank===2&&Array.isArray(result.value))
      return 'infinitas soluções: reta X = '+fmtVec3(result.value)+(v?' + t·'+fmtVec3(niceDirection(v)):'');
    return 'infinitas soluções';
  }
  if(Array.isArray(result?.value))return 'solução única: P = '+fmtVec3(result.value);
  return '';
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
