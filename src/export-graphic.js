"use strict";
import {captureThree3D} from './space3d/three-renderer.js';
import {getActive3DLibrary} from './space3d/library-manager.js';

function saveDataURL(dataURL,name){
  if(typeof dataURL!=='string'||!dataURL.startsWith('data:image/png'))
    throw new Error('O motor gráfico não retornou uma imagem PNG válida.');
  const link=document.createElement('a');
  link.href=dataURL;link.download=name;
  document.body.appendChild(link);link.click();link.remove();
}
export async function graphPngDataUrl({viewMode='2d',canvas=document.getElementById('cv')}={}){
  let dataURL;
  if(viewMode==='2d'||getActive3DLibrary()==='default'){
    if(!canvas?.toDataURL)throw new Error('Canvas não disponível para exportação.');
    dataURL=canvas.toDataURL('image/png');
  }else if(getActive3DLibrary()==='threejs'){
    dataURL=captureThree3D();
  }else if(getActive3DLibrary()==='plotly'){
    const el=document.getElementById('plotly-3d-container');
    if(!el||!window.Plotly?.toImage)throw new Error('Plotly.js indisponível.');
    const width=Math.max(480,Math.round(el.getBoundingClientRect().width*2));
    const height=Math.max(420,Math.round(el.getBoundingClientRect().height*2));
    dataURL=await window.Plotly.toImage(el,{format:'png',width,height});
  }
  return dataURL;
}
export async function exportGraphPng(options={}){
  const dataURL=await graphPngDataUrl(options);
  saveDataURL(dataURL,'curva-grafico-'+(options.viewMode||'2d')+'.png');
}
const loadImage=src=>new Promise((resolve,reject)=>{
  const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Falha na composição da imagem.'));
  image.src=src;
});
function fitImage(ctx,image,x,y,w,h){
  const scale=Math.min(w/image.width,h/image.height);
  const dw=image.width*scale,dh=image.height*scale;
  ctx.drawImage(image,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
}
// A single figure with both views and the conic metrics, independent of the
// current pane proportions. WebGL is rasterized; the section also retains its
// separate true-vector SVG exporter.
export async function exportCombinedPng({sectionPanel=document.getElementById('section2d-panel')}={}){
  if(!sectionPanel||sectionPanel.hidden)throw new Error('Ative 3D + 2D para exportar a composição.');
  const sectionCanvas=sectionPanel.querySelector('canvas');
  if(!sectionCanvas||!sectionCanvas.width)throw new Error('Seção 2D não disponível.');
  const source=await graphPngDataUrl({viewMode:'3d'});
  const img=await loadImage(source);
  const canvas=document.createElement('canvas');
  canvas.width=1680;canvas.height=980;
  const ctx=canvas.getContext('2d');
  const dark=document.body.classList.contains('dark');
  const bg=dark?'#111720':'#ffffff',fg=dark?'#e6edf6':'#26354a',muted=dark?'#a9bacb':'#58677b';
  ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=fg;ctx.font='bold 26px system-ui,sans-serif';
  ctx.fillText('Curva · Seção em 3D + 2D',36,46);
  ctx.font='18px system-ui,sans-serif';
  ctx.fillText('Geometria espacial',36,88);ctx.fillText('Seção no plano (s,t)',1010,88);
  ctx.strokeStyle=dark?'#314052':'#dbe1e8';
  ctx.strokeRect(28,104,948,752);ctx.strokeRect(994,104,660,752);
  fitImage(ctx,img,36,112,932,736);
  fitImage(ctx,sectionCanvas,1002,112,644,736);
  const equation=sectionPanel.querySelector('#section2d-caption')?.textContent||'';
  const values=[...sectionPanel.querySelectorAll('#section2d-properties dt')];
  const pairs=values.map(el=>el.textContent+': '+(el.nextElementSibling?.textContent||''));
  ctx.fillStyle=fg;ctx.font='15px monospace';
  ctx.fillText(equation.slice(0,115),36,895);
  ctx.fillStyle=muted;ctx.font='14px system-ui,sans-serif';
  const lines=[pairs.slice(0,3).join('  •  '),pairs.slice(3,6).join('  •  ')].filter(Boolean);
  lines.forEach((line,i)=>ctx.fillText(line.slice(0,180),36,921+i*23));
  saveDataURL(canvas.toDataURL('image/png'),'curva-3d-2d-composicao.png');
}

