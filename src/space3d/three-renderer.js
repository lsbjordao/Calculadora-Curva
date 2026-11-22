"use strict";

// Three.js (WebGL) renderer for the same geometric primitives used by Canvas
// and Plotly. Loading is lazy, so the rest of Curva works without network/WebGL.
// Pinned to a tested npm release: no build tools or bare module imports needed.
import { clipPlaneToBox, clipLineToBox } from './scene3d.js';
import { cameraBasis } from './camera.js';
import { attachCameraControls } from './view3d.js';

export const THREE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js';
const valid3 = p => Array.isArray(p) && p.length===3 && p.every(Number.isFinite);
const defaultBox = {min:[-5,-5,-5],max:[5,5,5]};
const fallbackColor = prim =>
  prim.color || (prim.role==='grid' ? '#d8dee6' : prim.role==='axis' || prim.role==='tick' ? '#82909e' : '#2878b8');

/**
 * Convert unbounded planes and lines into displayable, finite primitives.
 * Pure, DOM-free; shared by node tests and the renderer. No changes to data
 * models used in the Canvas/Plotly renderers.
 */
export function prepareThreePrimitives(primitives, box=defaultBox) {
  const result=[];
  if(!Array.isArray(primitives))return result;
  for(const prim of primitives){
    if(!prim || typeof prim!=='object')continue;
    if(prim.kind==='label' && prim.role==='tick')continue; // clear uncluttered axes
    if(prim.kind==='segment' && prim.role==='tick')continue;
    const color=fallbackColor(prim);
    if(prim.kind==='plane'){
      if(!valid3(prim.n)||!Number.isFinite(prim.d))continue;
      const points=clipPlaneToBox(prim.n,prim.d,box);
      if(points.length>=3)result.push({...prim,kind:'polygon',points,color,alpha:prim.alpha??.22,plane:true});
    }else if(prim.kind==='line'){
      if(!valid3(prim.p)||!valid3(prim.v))continue;
      const segment=clipLineToBox(prim.p,prim.v,box);
      if(segment)result.push({...prim,kind:'segment',a:segment[0],b:segment[1],color});
    }else if(prim.kind==='segment' && valid3(prim.a) && valid3(prim.b)){
      result.push({...prim,color});
    }else if(prim.kind==='arrow' && valid3(prim.from) && valid3(prim.to)){
      result.push({...prim,color});
    }else if(prim.kind==='point' && valid3(prim.p)){
      result.push({...prim,color});
    }else if(prim.kind==='polygon' && prim.points?.length>=3 && prim.points.every(valid3)){
      result.push({...prim,color});
    }else if(prim.kind==='mesh' && Array.isArray(prim.vertices) && prim.vertices.every(valid3) && Array.isArray(prim.faces)){
      result.push({...prim,color});
    }else if(prim.kind==='label' && valid3(prim.p) && prim.text!=null){
      result.push({...prim,color});
    }
  }
  return result;
}

let threePromise=null, three=null, engine=null, pending=null, lastSignature=null, lastError=null;
let initializing=false;
function root(){return typeof document==='undefined'?null:document.getElementById('three-3d-container');}
function message(text){
  const status=document.getElementById('three-3d-status');
  if(status){status.textContent=text;status.hidden=!text;}
}
async function loadLibrary(){
  if(!threePromise){
    threePromise=import(THREE_MODULE_URL).catch(error=>{
      threePromise=null;
      throw error;
    });
  }
  return threePromise;
}
function ensureEngine(T){
  if(engine)return engine;
  const container=root();
  if(!container)throw Error('Recipiente Three.js não encontrado.');
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.sortObjects=true;
  renderer.domElement.style.width='100%';
  renderer.domElement.style.height='100%';
  renderer.domElement.style.display='block';
  renderer.domElement.style.pointerEvents='none'; // gestures live on container
  renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new T.Scene();
  const group=new T.Group();
  scene.add(group);
  container.appendChild(renderer.domElement);
  engine={renderer,scene,group,sprites:[],width:0,height:0};
  renderer.domElement.addEventListener('webglcontextlost',e=>{
    e.preventDefault();
    lastError=Error('O contexto WebGL foi perdido; tente selecionar o Three.js novamente.');
    message(lastError.message);
  });
  return engine;
}
function disposeGroup(group){
  group.traverse(obj=>{
    obj.geometry?.dispose?.();
    const materials=Array.isArray(obj.material)?obj.material:[obj.material];
    for(const mat of materials){mat?.map?.dispose?.();mat?.dispose?.();}
  });
  group.clear();
}
function asVector(T,p){return new T.Vector3(p[0],p[1],p[2]);}
function labelSprite(T, text, position, color, {axis=false}={}){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const fontSize=axis?17:13;
  ctx.font='600 '+fontSize+'px system-ui, sans-serif';
  const w=Math.ceil(ctx.measureText(text).width)+18,h=fontSize+14;
  canvas.width=w*2;canvas.height=h*2;
  ctx.scale(2,2);
  ctx.font='600 '+fontSize+'px system-ui, sans-serif';
  ctx.fillStyle='rgba(255,255,255,0.91)';
  if(ctx.roundRect){ctx.beginPath();ctx.roundRect(0,0,w,h,5);ctx.fill();}
  else ctx.fillRect(0,0,w,h);
  ctx.fillStyle=color;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,w/2,h/2);
  const texture=new T.CanvasTexture(canvas);
  const mat=new T.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false});
  const sprite=new T.Sprite(mat);
  sprite.position.copy(asVector(T,position));
  sprite.userData.labelSize=[w,h];
  sprite.renderOrder=10;
  return sprite;
}
function segmentObject(T,a,b,color,{dash=false,weight=1,role='main'}={}){
  const geo=new T.BufferGeometry().setFromPoints([asVector(T,a),asVector(T,b)]);
  const material=dash?new T.LineDashedMaterial({color,dashSize:.18,gapSize:.11,transparent:true,opacity:role==='grid'?.38:.82})
    :new T.LineBasicMaterial({color,transparent:true,opacity:role==='grid'?.32:role==='axis'?.85:.92});
  const line=new T.Line(geo,material);
  if(dash)line.computeLineDistances();
  line.renderOrder=role==='grid'?0:3;
  line.userData.weight=weight; // LineBasicMaterial is 1 px by WebGL design
  return line;
}
function triangulate(vertices,faces){
  const indices=[];
  for(const face of faces){
    if(!Array.isArray(face)||face.length<3)continue;
    if(face.some(i=>!Number.isInteger(i)||i<0||i>=vertices.length))continue;
    for(let i=1;i<face.length-1;i++)indices.push(face[0],face[i],face[i+1]);
  }
  return indices;
}
function meshObject(T,vertices,faces,color,alpha){
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(vertices.flat(),3));
  geometry.setIndex(triangulate(vertices,faces));
  geometry.computeVertexNormals();
  const isTransparent=alpha<1;
  const material=new T.MeshBasicMaterial({
    color,side:T.DoubleSide,transparent:isTransparent,opacity:alpha,
    depthWrite:!isTransparent,depthTest:true,
    polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1
  });
  const mesh=new T.Mesh(geometry,material);
  mesh.renderOrder=isTransparent?1:0;
  return mesh;
}
function polygonObject(T,prim){
  const points=prim.points,color=prim.color;
  const wrap=new T.Group();
  wrap.add(meshObject(T,points,[points.map((_,i)=>i)],color,prim.alpha??.28));
  const outline=new T.BufferGeometry().setFromPoints([...points,points[0]].map(p=>asVector(T,p)));
  const border=new T.Line(outline,new T.LineBasicMaterial({color,transparent:true,opacity:.75,depthWrite:false}));
  border.renderOrder=3;wrap.add(border);
  if(prim.label){
    const p=points.reduce((sum,pt)=>sum.map((v,i)=>v+pt[i]/points.length),[0,0,0]);
    const label=labelSprite(T,prim.label,p,color);
    wrap.add(label);
  }
  return wrap;
}
function addPrimitive(T,group,p){
  const color=p.color;
  switch(p.kind){
    case 'polygon':group.add(polygonObject(T,p));break;
    case 'mesh': {
      group.add(meshObject(T,p.vertices,p.faces,color,p.alpha??.55));
      break;
    }
    case 'segment':group.add(segmentObject(T,p.a,p.b,color,p));break;
    case 'arrow':{
      group.add(segmentObject(T,p.from,p.to,color,{weight:2,role:p.role}));
      const from=asVector(T,p.from),to=asVector(T,p.to),delta=to.clone().sub(from),length=delta.length();
      if(length>1e-6){
        const size=Math.min(.29,length*.25),head=new T.Mesh(
          new T.ConeGeometry(size*.27,size,10),
          new T.MeshBasicMaterial({color,depthTest:true})
        );
        head.position.copy(to.clone().addScaledVector(delta.clone().normalize(),-size/2));
        head.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
        head.renderOrder=4;group.add(head);
      }
      if(p.label)group.add(labelSprite(T,p.label,p.to,color));
      break;
    }
    case 'point':{
      const radius=p.systemSolution?.17:.075;
      const sphere=new T.Mesh(new T.SphereGeometry(radius,16,12),new T.MeshBasicMaterial({color,depthTest:true}));
      sphere.position.copy(asVector(T,p.p));sphere.renderOrder=5;group.add(sphere);
      if(p.label)group.add(labelSprite(T,p.label,[p.p[0],p.p[1],p.p[2]+radius*1.8],color));
      break;
    }
    case 'label':{
      group.add(labelSprite(T,p.text,p.p,color,{axis:p.role==='axis'}));
      break;
    }
  }
}
function setCamera(T,E,opts,width,height){
  const c=opts.camera||{};
  const target=valid3(c.target)?c.target:[0,0,0];
  const basis=cameraBasis({
    azimuth:Number.isFinite(c.azimuth)?c.azimuth:-60,
    elevation:Number.isFinite(c.elevation)?c.elevation:25
  });
  const scale=Math.max(1,c.scale||40),dist=Math.max(1,c.distance||30);
  const aspect=width/height,far=Math.max(10000,dist*100,opts.range*50||0);
  let camera;
  if(c.projection==='perspective'){
    const fov=2*Math.atan(height/(2*scale*dist))*180/Math.PI;
    camera=new T.PerspectiveCamera(Math.max(1,Math.min(150,fov)),aspect,Math.max(.01,dist*.02),far);
  }else{
    camera=new T.OrthographicCamera(-width/(2*scale),width/(2*scale),height/(2*scale),-height/(2*scale),.01,far);
  }
  camera.up.set(...basis.up); // correct x-y-z roll, including XY pole
  camera.position.set(...target.map((v,i)=>v+dist*basis.forward[i]));
  camera.lookAt(...target);
  camera.updateProjectionMatrix();
  E.camera=camera;
  for(const sprite of E.sprites){
    const [w,h]=sprite.userData.labelSize;
    if(w&&h)sprite.scale.set(w/scale,h/scale,1);
  }
}
function updateScene(T,E,prepared){
  disposeGroup(E.group);
  for(const p of prepared)addPrimitive(T,E.group,p);
  E.sprites=[];
  E.group.traverse(obj=>{if(obj.isSprite)E.sprites.push(obj);});
}
function renderPending(){
  const container=root();
  if(!engine||!three||!pending||!container||container.style.display==='none')return;
  const rect=container.getBoundingClientRect();
  const width=Math.max(1,Math.round(rect.width)),height=Math.max(1,Math.round(rect.height));
  if(!rect.width||!rect.height)return;
  const {primitives,options}=pending,box=options.box||defaultBox;
  const prepared=prepareThreePrimitives(primitives,box);
  const signature=JSON.stringify(prepared); // reuse GPU buffers when only camera moves
  if(signature!==lastSignature){
    updateScene(three,engine,prepared);
    lastSignature=signature;
  }
  if(width!==engine.width||height!==engine.height){
    engine.renderer.setSize(width,height,false);
    engine.width=width;engine.height=height;
  }
  engine.renderer.setClearColor(options.colors?.bg||'#ffffff',1);
  setCamera(three,engine,options,width,height);
  engine.renderer.render(engine.scene,engine.camera);
  message('');
}

export function renderThree3D(primitives,options={}){
  pending={primitives,options};
  if(lastError){message('Three.js indisponível: '+lastError.message+' — tente Plotly.js ou Canvas 2D.');return;}
  if(engine){try{renderPending();}catch(error){lastError=error;message('Erro ao renderizar Three.js: '+error.message);}return;}
  if(initializing)return;
  initializing=true;
  message('Carregando Three.js…');
  loadLibrary().then(T=>{
    const container=root();
    if(!container||container.style.display==='none')return;
    three=T;
    ensureEngine(T);
    renderPending();
  }).catch(error=>{
    lastError=error;
    if(root()?.style.display!=='none')message('Não foi possível iniciar Three.js (WebGL ou conexão indisponível). Use Plotly.js ou Canvas 2D.');
  }).finally(()=>{initializing=false;});
}
export function resizeThree3D(){
  if(engine)engine.width=engine.height=0;
}
export function clearThree3D(){
  pending=null;
  if(engine){disposeGroup(engine.group);lastSignature=null;}
}
export function resetThree3DError(){
  lastError=null;
  if(root())message('');
}
/**
 * Apply exactly the same camera gestures and saved camera as the Canvas mode.
 * Container captures pointers; the WebGL canvas is intentionally non-interactive.
 */
export function initThree3DControls(getCamera,setCamera,requestDraw,{isActive,onCommit,defaultCamera}={}){
  const container=root();
  if(!container)return;
  attachCameraControls(container,getCamera,setCamera,requestDraw,{isActive,onCommit,defaultCamera});
}
