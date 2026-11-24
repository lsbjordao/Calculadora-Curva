"use strict";

// Three.js (WebGL) renderer for the same geometric primitives used by Canvas
// and Plotly. Loading is lazy; the pinned MIT-licensed module is bundled for offline WebGL.
// Pinned to Three.js r187; uses local ES modules and no build tools.
import { clipPlaneToBox, clipLineToBox } from './scene3d.js';
import { cameraBasis } from './camera.js';
import { attachCameraControls } from './view3d.js';
import { buildMeshSurfaceLines } from './surface-lines.js';

export const THREE_MODULE_URL = new URL('../../assets/vendor/three.module.js',import.meta.url).href;
const valid3 = p => Array.isArray(p) && p.length===3 && p.every(Number.isFinite);
const defaultBox = {min:[-5,-5,-5],max:[5,5,5]};
const THIN = [1,2,5,10,20,50,100];
/**
 * Like Canvas' tick culling, hide axis-aligned ticks when the axis points
 * toward the viewer, and thin numerical labels when they get crowded.
 * Explicit "1 em 1" preserves all tick labels, as in Canvas.
 */
export function threeTickVisible(prim,camera){
  if(prim?.role!=='tick'||!Number.isInteger(prim.axis))return true;
  if(prim.showEveryTick)return true;
  if(!camera || !Number.isFinite(camera.scale))return true;
  const basis=cameraBasis(camera),axis=prim.axis;
  const pxPerUnit=camera.scale*Math.hypot(basis.right[axis],basis.up[axis]);
  const step=prim.step>0?prim.step:1,px=pxPerUnit*step;
  if(px<6)return false; // marks closer than 6 px: axis seen end-on
  if(prim.kind!=='label')return true;
  const every=THIN.find(v=>px*v>=28)??Infinity;
  return Math.round(prim.value/step)%every===0;
}
const fallbackColor = prim =>
  prim.color || (prim.role==='grid' ? '#d8dee6' : prim.role==='axis' || prim.role==='tick' ? '#82909e' : '#2878b8');

/**
 * Convert unbounded planes and lines into displayable, finite primitives.
 * Pure, DOM-free; shared by node tests and the renderer. No changes to data
 * models used in the Canvas/Plotly renderers.
 */
export function prepareThreePrimitives(primitives, box=defaultBox, {camera=null}={}) {
  const result=[];
  if(!Array.isArray(primitives))return result;
  for(const prim of primitives){
    if(!prim || typeof prim!=='object')continue;
    if(!threeTickVisible(prim,camera))continue;
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
function labelSprite(T, text, position, color, {axis=false,tick=false,dark=false}={}){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const fontSize=axis?17:tick?11:13;
  ctx.font='600 '+fontSize+'px system-ui, sans-serif';
  const w=Math.ceil(ctx.measureText(text).width)+18,h=fontSize+14;
  canvas.width=w*2;canvas.height=h*2;
  ctx.scale(2,2);
  ctx.font='600 '+fontSize+'px system-ui, sans-serif';
  if(!tick){
    ctx.fillStyle=dark?'rgba(7,23,27,0.9)':'rgba(255,255,255,0.91)';
    if(ctx.roundRect){ctx.beginPath();ctx.roundRect(0,0,w,h,5);ctx.fill();}
    else ctx.fillRect(0,0,w,h);
  }
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
function polygonObject(T,prim,opts){
  const points=prim.points,color=prim.color;
  const wrap=new T.Group();
  wrap.add(meshObject(T,points,[points.map((_,i)=>i)],color,prim.alpha??.28));
  const outline=new T.BufferGeometry().setFromPoints([...points,points[0]].map(p=>asVector(T,p)));
  const border=new T.Line(outline,new T.LineBasicMaterial({color,transparent:true,opacity:.75,depthWrite:false}));
  border.renderOrder=3;wrap.add(border);
  if(prim.label){
    const p=points.reduce((sum,pt)=>sum.map((v,i)=>v+pt[i]/points.length),[0,0,0]);
    const label=labelSprite(T,prim.label,p,color,{dark:opts.dark});
    wrap.add(label);
  }
  return wrap;
}
function addPrimitive(T,group,p,opts){
  const color=p.color;
  switch(p.kind){
    case 'polygon':{
      const obj=polygonObject(T,p,opts);
      if(p.sectionPlane)obj.userData.sectionEqId=p.sectionEqId;
      group.add(obj);break;
    }
    case 'mesh': {
      const obj=meshObject(T,p.vertices,p.faces,color,p.alpha??.55);
      if(p.conicSection)obj.userData.coneEqId=p.sectionEqId;
      if(opts.surfaceLines!=='off'){
        const guide=buildMeshSurfaceLines(p,opts.surfaceLines||'normal');
        if(guide.segmentCount){
          const geometry=new T.BufferGeometry();
          geometry.setAttribute('position',new T.BufferAttribute(guide.positions,3));
          // Subtle orientation guides: keep them close to the surface hue
          // instead of outlining every curve in high-contrast white/black.
          const lineColor=new T.Color(color).lerp(
            new T.Color(opts.dark?'#f2fbff':'#162335'),opts.dark?.32:.28);
          const material=new T.LineBasicMaterial({
            color:lineColor,transparent:true,
            opacity:opts.surfaceLines==='detailed'?(opts.dark?.36:.30):(opts.dark?.46:.38),
            depthTest:true,depthWrite:false
          });
          const lines=new T.LineSegments(geometry,material);
          lines.name='curva-surface-reference-lines';
          lines.userData.surfaceGuides=true;
          lines.renderOrder=2; // after the translucent face; no polygon diagonals
          obj.add(lines); // same transform and picking parent as the surface
        }
      }
      group.add(obj);
      break;
    }
    case 'segment':group.add(segmentObject(T,p.a,p.b,color,p));break;
    case 'arrow':{
      const segment=segmentObject(T,p.from,p.to,color,{weight:2,role:p.role});
      if(p.planeHandle&&Number.isInteger(p.sectionEqId)){
        segment.userData.planeHandleEqId=p.sectionEqId;
        segment.userData.planeHandleAxis=p.planeHandleAxis;
      }
      group.add(segment);
      const from=asVector(T,p.from),to=asVector(T,p.to),delta=to.clone().sub(from),length=delta.length();
      if(length>1e-6){
        const size=Math.min(.29,length*.25),head=new T.Mesh(
          new T.ConeGeometry(size*.27,size,10),
          new T.MeshBasicMaterial({color,depthTest:true})
        );
        head.position.copy(to.clone().addScaledVector(delta.clone().normalize(),-size/2));
        head.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
        head.renderOrder=4;
        if(p.planeHandle&&Number.isInteger(p.sectionEqId)){
          head.userData.planeHandleEqId=p.sectionEqId;
          head.userData.planeHandleAxis=p.planeHandleAxis;
        }
        group.add(head);
      }
      if(p.label)group.add(labelSprite(T,p.label,p.to,color,{dark:opts.dark}));
      break;
    }
    case 'point':{
      const radius=p.systemSolution?.17:.075;
      const sphere=new T.Mesh(new T.SphereGeometry(radius,16,12),new T.MeshBasicMaterial({color,depthTest:true}));
      sphere.position.copy(asVector(T,p.p));sphere.renderOrder=5;
      if(p.conicSection&&p.label==='vértice')sphere.userData.vertexEqId=p.sectionEqId;
      group.add(sphere);
      if(p.label)group.add(labelSprite(T,p.label,[p.p[0],p.p[1],p.p[2]+radius*1.8],color,{dark:opts.dark}));
      break;
    }
    case 'label':{
      group.add(labelSprite(T,p.text,p.p,color,{axis:p.role==='axis',tick:p.role==='tick',dark:opts.dark}));
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
function updateScene(T,E,prepared,options){
  disposeGroup(E.group);
  for(const p of prepared)addPrimitive(T,E.group,p,{dark:options.theme==='dark',surfaceLines:options.surfaceLines||'normal'});
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
  const prepared=prepareThreePrimitives(primitives,box,{camera:options.camera});
  const signature=JSON.stringify([prepared,options.theme,options.surfaceLines||'normal']); // reuse buffers when only camera moves
  if(signature!==lastSignature){
    updateScene(three,engine,prepared,options);
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
// Read-only diagnostics for browser regression checks and performance tuning.
export function threeSurfaceGuideStats(){
  const counts={meshes:0,guides:0,segments:0};
  engine?.group?.traverse?.(obj=>{
    if(obj.isMesh&&obj.geometry?.getAttribute?.('position'))counts.meshes++;
    if(obj.userData?.surfaceGuides){
      counts.guides++;
      counts.segments+=Math.floor((obj.geometry?.getAttribute?.('position')?.count||0)/2);
    }
  });
  return counts;
}
export function resizeThree3D(){
  if(engine)engine.width=engine.height=0;
}
export function captureThree3D(){
  if(!engine||!three||!pending)throw new Error('Three.js ainda não está pronto.');
  // Capture in the same synchronous task as WebGL rendering, before the
  // default drawing buffer is discarded. preserveDrawingBuffer isn't needed.
  renderPending();
  engine.renderer.render(engine.scene,engine.camera);
  return engine.renderer.domElement.toDataURL('image/png');
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


/**
 * Optional direct manipulation of actual cutting-plane meshes in Three.js.
 * With the tool active (or Alt held), clicking a plane starts a gesture.
 * Capture-phase listeners suppress orbit controls only during that gesture;
 * otherwise the familiar camera interactions are preserved.
 */
export function initThreePlaneDragging({isEnabled=()=>false,onDrag=()=>{}}={}){
  const container=root();
  if(!container)return;
  let active=null;
  const findHit=event=>{
    if(!three||!engine?.camera)return null;
    const rect=container.getBoundingClientRect();
    if(!(rect.width>0&&rect.height>0))return null;
    const pt=new three.Vector2(
      (event.clientX-rect.left)/rect.width*2-1,
      -(event.clientY-rect.top)/rect.height*2+1
    );
    const raycaster=new three.Raycaster();
    raycaster.setFromCamera(pt,engine.camera);
    const hits=raycaster.intersectObjects(engine.group.children,true);
    for(const hit of hits){
      let obj=hit.object;
      while(obj&&obj!==engine.group){
        if(Number.isInteger(obj.userData.planeHandleEqId))
          return {eqId:obj.userData.planeHandleEqId,kind:'handle',axis:obj.userData.planeHandleAxis};
        if(Number.isInteger(obj.userData.sectionEqId))return {eqId:obj.userData.sectionEqId,kind:'plane'};
        if(Number.isInteger(obj.userData.vertexEqId))return {eqId:obj.userData.vertexEqId,kind:'vertex'};
        if(Number.isInteger(obj.userData.coneEqId))return {eqId:obj.userData.coneEqId,kind:'cone'};
        obj=obj.parent;
      }
    }
    return null;
  };
  const stop=event=>{
    if(!active||active.pointerId!==event.pointerId)return;
    onDrag({phase:'end',eqId:active.eqId,kind:active.kind,axis:active.axis,
      shiftKey:active.shiftKey,ctrlKey:active.ctrlKey,
      dx:event.clientX-active.x,dy:event.clientY-active.y});
    active=null;
    try{container.releasePointerCapture?.(event.pointerId);}catch{}
    container.style.cursor='grab';
    event.preventDefault();event.stopImmediatePropagation();
  };
  container.addEventListener('pointerdown',event=>{
    if(event.button!==0||!(isEnabled()||event.altKey))return;
    const hit=findHit(event);
    if(!hit)return;
    active={pointerId:event.pointerId,x:event.clientX,y:event.clientY,...hit,
      shiftKey:event.shiftKey,ctrlKey:event.ctrlKey};
    try{container.setPointerCapture?.(event.pointerId);}catch{}
    container.style.cursor='grabbing';
    onDrag({phase:'start',eqId:active.eqId,kind:active.kind,axis:active.axis,
      shiftKey:active.shiftKey,ctrlKey:active.ctrlKey,dx:0,dy:0});
    event.preventDefault();event.stopImmediatePropagation();
  },true);
  container.addEventListener('pointermove',event=>{
    if(!active||active.pointerId!==event.pointerId)return;
    onDrag({phase:'move',eqId:active.eqId,kind:active.kind,axis:active.axis,
      shiftKey:active.shiftKey,ctrlKey:active.ctrlKey,
      dx:event.clientX-active.x,dy:event.clientY-active.y});
    event.preventDefault();event.stopImmediatePropagation();
  },true);
  container.addEventListener('pointerup',stop,true);
  container.addEventListener('pointercancel',stop,true);
}
