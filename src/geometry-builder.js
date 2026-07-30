"use strict";

const POINT_LABELS='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function formatCoord(value){
  const n=Number(value);
  if(!Number.isFinite(n)) return '0';
  const rounded=Math.round(n*1000)/1000;
  const clean=Object.is(rounded,-0) ? 0 : rounded;
  return String(Number(clean.toFixed(3)));
}

export function normalizePoint(point){
  return {
    label:String(point?.label||'').trim(),
    x:Number(point?.x),
    y:Number(point?.y)
  };
}

export function nextPointLabel(points=[]){
  const used=new Set(points.map(point=>String(point?.label||'').toUpperCase()).filter(Boolean));
  const free=POINT_LABELS.find(label=>!used.has(label));
  if(free) return free;
  let i=1;
  while(used.has('P'+i)) i++;
  return 'P'+i;
}

export function formatPointCommand(points=[]){
  const normalized=points.map(normalizePoint).filter(point=>point.label&&Number.isFinite(point.x)&&Number.isFinite(point.y));
  return 'ponto: '+normalized.map(point=>point.label+'=('+formatCoord(point.x)+','+formatCoord(point.y)+')').join(', ');
}

export function updatePoint(points=[], label, x, y){
  const target=String(label||'').toLowerCase();
  return points.map(point=>{
    const p=normalizePoint(point);
    if(p.label.toLowerCase()!==target) return p;
    return {...p, x:Number(x), y:Number(y)};
  });
}

function canReceivePoint(item){
  return item?.type==='point' || String(item?.text||'').trim()==='';
}

export function choosePointSourceIndex(items=[], focusedIndex=-1){
  const index=Number.isInteger(focusedIndex) ? focusedIndex : -1;
  if(index>=0&&index<items.length&&canReceivePoint(items[index])) return index;
  return items.findIndex(item=>item?.type==='point');
}

export function usedGeometryNames(items=[]){
  const names=new Set();
  items.forEach(item=>{
    if(item?.label) names.add(String(item.label).toLowerCase());
    if(item?.name) names.add(String(item.name).toLowerCase());
  });
  return names;
}

function nextName(preferred, fallbacks, used){
  const taken=used instanceof Set ? used : usedGeometryNames(used);
  const options=[preferred,...fallbacks].filter(Boolean);
  for(const option of options){
    if(!taken.has(String(option).toLowerCase())) return option;
  }
  let i=1;
  while(taken.has(String(preferred+i).toLowerCase())) i++;
  return preferred+i;
}

export function constructionExpression(kind, a, b, used=[]){
  const labels=(Array.isArray(a) ? a : [a,b]).map(label=>String(label||'').trim()).filter(Boolean);
  const left=labels[0];
  const right=labels[1];
  if(!left||!right) return '';
  const taken=used instanceof Set ? used : usedGeometryNames(used);
  if(kind==='vector') return 'vetor: '+left+','+right;
  if(kind==='distance') return 'dist: '+left+','+right;
  if(kind==='midpoint') return nextName('M',['N','P','Q'],taken)+' = medio('+left+','+right+')';
  if(kind==='line') return nextName('r',['s','t','u'],taken)+' = reta('+left+','+right+')';
  if(kind==='triangle'&&labels.length===3) return 'triangulo: '+labels.join(',');
  if(kind==='quadrilateral'&&labels.length===4) return 'quadrilatero: '+labels.join(',');
  if(kind==='polygon'&&labels.length>=3) return 'poligono: '+labels.join(',');
  if(kind==='convexHull'&&labels.length>=4) return 'convexo: '+labels.join(',');
  return '';
}
