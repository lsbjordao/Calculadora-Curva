"use strict";
import {sectionCurves,conicMetricSummary} from './section-analysis.js';
import {nearestSectionInPlane,linkedWorldFromSection,linkedSectionFromWorld} from './section-sync.js';

const pad=28;
const fmt=x=>Number.isFinite(x)?Number(x.toFixed(4)):0;
const colors=dark=>({bg:dark?'#131a23':'#fff',ink:dark?'#e8edf4':'#20334a',
  grid:dark?'#374354':'#e8edf3',axes:dark?'#a0b3c9':'#8498b0',curve:'#df5188',point:'#26a57b',focus:'#bd7936'});
const escapeXML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const save=(source,name,mime)=>{
  const blob=source instanceof Blob?source:new Blob([source],{type:mime});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
function makeView(section,w,h){
  const points=section.segments.flatMap(s=>[s.a,s.b]);
  if(!points.length)points.push([0,0]);
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const scale=Math.max(.005,Math.min((w-2*pad)/(1.18*Math.max(1.8,xmax-xmin)),
    (h-2*pad)/(1.18*Math.max(1.8,ymax-ymin)),240));
  const cx=(xmin+xmax)/2,cy=(ymin+ymax)/2;
  return {w,h,scale,cx,cy,
    xy:p=>[(p[0]-cx)*scale+w/2,h/2-(p[1]-cy)*scale],
    inv:(x,y)=>[(x-w/2)/scale+cx,(h/2-y)/scale+cy]};
}
function ticks(view){
  const {w,h,scale,cx,cy}=view;
  const raw=55/scale,power=10**Math.floor(Math.log10(raw));
  const step=([1,2,5,10].find(v=>v*power>=raw)||10*power);
  const out=[];
  for(let i=Math.ceil((cx-w/(2*scale))/step);i<=Math.floor((cx+w/(2*scale))/step)&&out.length<120;i++){
    const x=view.xy([i*step,0])[0];out.push({x1:x,y1:0,x2:x,y2:h,label:fmt(i*step),axis:'x'});
  }
  for(let i=Math.ceil((cy-h/(2*scale))/step);i<=Math.floor((cy+h/(2*scale))/step)&&out.length<240;i++){
    const y=view.xy([0,i*step])[1];out.push({x1:0,y1:y,x2:w,y2:y,label:fmt(i*step),axis:'y'});
  }
  return out;
}
function paths(section,view){
  return section.segments.map(s=>{
    const a=view.xy(s.a),b=view.xy(s.b);
    return 'M'+fmt(a[0])+','+fmt(a[1])+'L'+fmt(b[0])+','+fmt(b[1]);
  }).join(' ');
}
function markers(section){
  return [...(section.center?[{p:section.center,t:'C'}]:[]),
    ...(section.vertex?[{p:section.vertex,t:'V'}]:[]),
    ...section.foci.map((p,i)=>({p,t:'F'+(i+1)})),
    ...(section.type==='vertex-point'?[{p:[0,0],t:'V'}]:[])];
}
function paint(ctx,section,view,c,hover){
  const {w,h}=view;
  ctx.clearRect(0,0,w,h);ctx.fillStyle=c.bg;ctx.fillRect(0,0,w,h);
  ctx.font='11px system-ui,sans-serif';
  for(const g of ticks(view)){
    ctx.strokeStyle=c.grid;ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(g.x1,g.y1);ctx.lineTo(g.x2,g.y2);ctx.stroke();
    if(g.label!==0){
      ctx.fillStyle=c.axes;
      if(g.axis==='x')ctx.fillText(g.label,g.x1+3,Math.max(13,Math.min(h-8,view.xy([0,0])[1]+13)));
      else ctx.fillText(g.label,Math.max(4,Math.min(w-38,view.xy([0,0])[0]+5)),g.y1-4);
    }
  }
  const o=view.xy([0,0]);ctx.strokeStyle=c.axes;ctx.lineWidth=1.3;
  ctx.beginPath();ctx.moveTo(o[0],0);ctx.lineTo(o[0],h);ctx.moveTo(0,o[1]);ctx.lineTo(w,o[1]);ctx.stroke();
  ctx.strokeStyle=c.curve;ctx.lineWidth=2.8;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.stroke(new Path2D(paths(section,view)));
  for(const {p,t} of markers(section)){
    const [x,y]=view.xy(p);if(!Number.isFinite(x+y))continue;
    ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle=t[0]==='F'?c.focus:c.point;ctx.fill();
    ctx.fillStyle=c.ink;ctx.fillText(t,x+7,y-8);
  }
  if(hover){
    const [x,y]=view.xy(hover);
    ctx.strokeStyle=c.point;ctx.setLineDash([3,4]);ctx.beginPath();
    ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle=c.point;ctx.fill();
  }
}
export function sectionSvg(section,width=760,height=540,{dark=false}={}){
  if(!section)throw new Error('Nenhuma seção disponível.');
  const c=colors(dark),v=makeView(section,width,height),o=v.xy([0,0]);
  const grid=ticks(v).map(g=>'<line x1="'+fmt(g.x1)+'" y1="'+fmt(g.y1)+'" x2="'+fmt(g.x2)+'" y2="'+fmt(g.y2)+'" stroke="'+c.grid+'"/>').join('');
  const marks=markers(section).map(({p,t})=>{
    const [x,y]=v.xy(p);
    return '<circle cx="'+fmt(x)+'" cy="'+fmt(y)+'" r="4" fill="'+c.point+'"/><text x="'+fmt(x+8)+'" y="'+fmt(y-8)+'" fill="'+c.ink+'" font-size="12">'+escapeXML(t)+'</text>';
  }).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Seção cônica 2D"><rect width="'+width+'" height="'+height+'" fill="'+c.bg+'"/>'+grid+'<path d="M'+fmt(o[0])+',0V'+height+' M0,'+fmt(o[1])+'H'+width+'" fill="none" stroke="'+c.axes+'" stroke-width="1.5"/><path d="'+paths(section,v)+'" fill="none" stroke="'+c.curve+'" stroke-width="3" stroke-linecap="round"/>'+marks+'<text x="14" y="'+(height-10)+'" font-family="system-ui" font-size="13" fill="'+c.ink+'">'+escapeXML(section.canonical||section.equation)+'</text></svg>';
}
export function createSectionPanel({
  panel=document.getElementById('section2d-panel'),
  onClose=()=>{},
  onHoverPoint=()=>{}
}={}){
  if(!panel)return {draw:()=>{},resize:()=>{}};
  const canvas=panel.querySelector?.('canvas');
  // Node's lightweight DOM fixtures return detached stubs; don't render
  // the section on the primary canvas context in that environment.
  if(!canvas||panel.contains?.(canvas)===false)return {draw:()=>{},resize:()=>{}};
  const ctx=canvas?.getContext('2d');
  const properties=panel.querySelector('#section2d-properties');
  const caption=panel.querySelector('#section2d-caption'),hoverLabel=panel.querySelector('#section2d-cursor');
  let last=null,lastDark=false,lastView=null,hover=null,signature='';
  panel.querySelector('#section2d-close')?.addEventListener('click',onClose);
  panel.querySelector('#section2d-svg')?.addEventListener('click',()=>{
    if(last)save(sectionSvg(last,960,680,{dark:lastDark}),'curva-secao-2d.svg','image/svg+xml;charset=utf-8');
  });
  panel.querySelector('#section2d-png')?.addEventListener('click',()=>{
    if(last&&canvas)canvas.toBlob(blob=>{if(blob)save(blob,'curva-secao-2d.png','image/png');},'image/png');
  });
  const redraw=()=>{
    if(!last||!ctx||panel.hidden)return;
    const rect=canvas.getBoundingClientRect();
    if(rect.width<1||rect.height<1)return;
    const w=Math.round(rect.width),h=Math.round(rect.height),dpr=Math.min(window.devicePixelRatio||1,2);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    lastView=makeView(last,w,h);
    paint(ctx,last,lastView,colors(lastDark),hover);
  };
  canvas?.addEventListener('pointermove',e=>{
    if(!lastView||!last)return;
    const bounds=canvas.getBoundingClientRect();
    const px=e.clientX-bounds.left,py=e.clientY-bounds.top;
    const hit=nearestSectionInPlane(last.segments,lastView.xy,px,py);
    hover=hit?.local||lastView.inv(px,py);
    const world=hit?linkedWorldFromSection(hit.local,last):null;
    if(hoverLabel)hoverLabel.textContent='s: '+fmt(hover[0])+' · t: '+fmt(hover[1])+
      (world?' · xyz: ('+world.map(fmt).join(', ')+')':'');
    onHoverPoint(world,hit?.local||null);
    redraw();
  });
  canvas?.addEventListener('pointerleave',()=>{
    hover=null;if(hoverLabel)hoverLabel.textContent='';
    onHoverPoint(null,null);redraw();
  });
  return {
    highlightWorld(world){
      if(!last||!lastView)return;
      hover=world?linkedSectionFromWorld(world,last):null;
      if(hoverLabel)hoverLabel.textContent=world&&hover?
        's: '+fmt(hover[0])+' · t: '+fmt(hover[1])+' · xyz: ('+world.map(fmt).join(', ')+')':'';
      redraw();
    },
    draw(geometry,dark=false){
      const next=sectionCurves(geometry);if(!next)return;
      const current=JSON.stringify([geometry.section,geometry.scene3d?.length,dark]);
      if(current!==signature){
        if(caption)caption.textContent=next.canonical||next.equation;
        if(properties){
          properties.replaceChildren();
          for(const [label,value] of conicMetricSummary(next)){
            const dt=document.createElement('dt'),dd=document.createElement('dd');
            dt.textContent=label;dd.textContent=value;properties.append(dt,dd);
          }
        }
        signature=current;
      }
      last=next;lastDark=dark;redraw();
    },
    resize:redraw,
    getSection:()=>last
  };
}
