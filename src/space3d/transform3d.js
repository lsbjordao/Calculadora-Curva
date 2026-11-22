"use strict";

import {validateMatrix,eye,matmul,svd,det} from '../linear-algebra.js';

// Pure 3D transform geometry shared by Canvas, Plotly.js and Three.js.
// The source matrix is never modified; the animation is A(t)=(1-t)I+tA,
// or three SVD phases Vt -> Sigma -> U, like the existing 2D animation.
const BASIS=[[1,0,0],[0,1,0],[0,0,1]];
const ORIGINAL='#93a0ae',EDGE_COLOR='#247ca6',FACE_COLOR='#3297d2';
const COLORS=['#d96043','#26a57b','#8b62c5'];
const UNIT_VERTICES=Array.from({length:8},(_,i)=>[i&1,(i>>1)&1,(i>>2)&1]);
const EDGES=Array.from({length:8},(_,i)=>[0,1,2].map(bit=>[i,i^(1<<bit)]))
  .flat().filter(([a,b])=>a<b);
const FACES=[[0,1,3,2],[4,5,7,6],[0,1,5,4],[2,3,7,6],[0,2,6,4],[1,3,7,5]];
const blend=(A,B,t)=>A.map((row,i)=>row.map((v,j)=>(1-t)*v+t*B[i][j]));
function validate3(A){
  validateMatrix(A);
  if(A.length!==3||A[0].length!==3)throw Error('A transformação 3D exige matriz 3×3.');
}
const clampT=t=>Math.max(0,Math.min(1,Number.isFinite(t)?t:1));
export function transformMatrix3D(A,t=1,{decomposition=null}={}){
  validate3(A);
  t=clampT(t);
  const I=eye(3);
  if(!decomposition)return blend(I,A,t);
  const {U,S,Vt}=decomposition;
  if(!Array.isArray(S)||S.length!==3)throw Error('SVD 3D inválida.');
  const sigma=S.map((s,i)=>S.map((_,j)=>i===j?s:0));
  if(t<=1/3)return blend(I,Vt,t*3);
  if(t<=2/3)return matmul(blend(I,sigma,t*3-1),Vt);
  return matmul(blend(I,U,t*3-2),matmul(sigma,Vt));
}
export function buildTransform3DScene(A,options={}){
  const current=transformMatrix3D(A,options.t??1,{decomposition:options.decomposition});
  const apply=v=>current.map(row=>row.reduce((sum,x,i)=>sum+x*v[i],0));
  const verts=UNIT_VERTICES.map(apply);
  const scene=[];
  if(options.showOriginal!==false){
    for(const [i,j] of EDGES)scene.push({
      kind:'segment',a:[...UNIT_VERTICES[i]],b:[...UNIT_VERTICES[j]],
      role:'aux',dash:true,color:ORIGINAL,transform3d:true
    });
  }
  if(options.showCube!==false){
    scene.push({kind:'mesh',vertices:verts,faces:FACES,alpha:.15,color:FACE_COLOR,transform3d:true});
    for(const [i,j] of EDGES)scene.push({
      kind:'segment',a:verts[i],b:verts[j],weight:2,color:EDGE_COLOR,transform3d:true
    });
  }
  if(options.showBasis!==false){
    BASIS.forEach((v,i)=>scene.push({
      kind:'arrow',from:[0,0,0],to:apply(v),label:'A(t)e'+(i+1),
      color:COLORS[i],transform3d:true
    }));
  }
  return {scene,matrix:current,det:det(current)};
}

// Dedicated controller keeps DOM and animation out of the mathematical core.
export function createTransform3DControls(host,{getMatrix,onScene,onChange=()=>{}}){
  let t=1,mode='linear',factor=null,previous=null,frame=null,running=false;
  const opts={showOriginal:true,showCube:true,showBasis:true};
  host.className='transform3d-controls';
  const add=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;host.appendChild(node);return node;};
  const play=add('button','iniciar'),reset=add('button','reiniciar');
  for(const node of [play,reset])node.type='button';
  const selector=add('select');
  selector.setAttribute('aria-label','Modo da transformação 3D');
  for(const [value,label] of [['linear','Identidade → A'],['svd','SVD: Vᵀ → Σ → U']]){
    const option=document.createElement('option');option.value=value;option.textContent=label;selector.appendChild(option);
  }
  const label=add('label','Tempo t ');
  const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='1';slider.step='.005';slider.value='1';slider.setAttribute('aria-label','Tempo da transformação 3D');
  label.appendChild(slider);
  const status=add('output');
  status.setAttribute('aria-live','off');
  const note=add('p');
  const stop=()=>{running=false;if(frame!==null)cancelAnimationFrame(frame);frame=null;previous=null;play.textContent='iniciar';};
  const update=()=>{
    slider.value=String(t);
    const A=getMatrix();
    if(!A)return;
    try{
      if(mode==='svd'&&!factor)factor=svd(A);
      const result=buildTransform3DScene(A,{...opts,t,decomposition:mode==='svd'?factor:null});
      status.textContent='t = '+t.toFixed(2)+' · det A(t) = '+Number(result.det.toPrecision(6));
      note.textContent=mode==='svd'
        ? 'Decomposição A = UΣVᵀ · Vᵀ, escalas principais, U. A interpolação pode passar por matrizes singulares.'
        : 'A(t) = (1−t)I + tA · os três vetores da base transformam o cubo unitário.';
      onScene(result.scene);
      onChange(t);
    }catch(error){stop();status.textContent=error.message;}
  };
  const tick=now=>{
    if(!running)return;
    if(previous!==null)t=Math.min(1,t+Math.min(now-previous,100)/4500);
    previous=now;update();
    if(t>=1)stop();else frame=requestAnimationFrame(tick);
  };
  play.onclick=()=>{if(running)stop();else{if(t>=1)t=0;running=true;play.textContent='pausar';frame=requestAnimationFrame(tick);}};
  reset.onclick=()=>{stop();t=0;update();};
  slider.oninput=()=>{stop();t=Number(slider.value);update();};
  selector.onchange=()=>{stop();mode=selector.value;t=0;factor=null;update();};
  for(const [key,text] of [['showOriginal','cubo original'],['showCube','cubo transformado'],['showBasis','vetores da base']]){
    const toggle=add('label',text+' ');
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=true;
    checkbox.onchange=()=>{opts[key]=checkbox.checked;update();};
    toggle.appendChild(checkbox);
  }
  update();
  return {dispose:stop,refresh:()=>{factor=null;update();}};
}
