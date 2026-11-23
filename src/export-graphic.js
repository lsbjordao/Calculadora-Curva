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
export async function exportGraphPng({viewMode='2d',canvas=document.getElementById('cv')}={}){
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
  saveDataURL(dataURL,'curva-grafico-'+viewMode+'.png');
}
