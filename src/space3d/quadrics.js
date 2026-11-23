"use strict";

/**
 * Parametric surfaces for the standard real quadric families. Every surface
 * becomes a regular indexed mesh compatible with Canvas 2D, Plotly and Three.
 * Parameters a,b,c are positive shape scales; d translates the z coordinate.
 */
export const QUADRIC_TYPES=Object.freeze({
  esfera:'Esfera',elipsoide:'Elipsoide',
  paraboloide:'Paraboloide elíptico',
  hiperboloide1:'Hiperboloide de uma folha',
  hiperboloide2:'Hiperboloide de duas folhas',
  sela:'Paraboloide hiperbólico',
  cilindro:'Cilindro elíptico'
});
const TAU=Math.PI*2;
function sheet(fn,{rows=28,columns=44,closedU=false,closedV=true}={}){
  const vertices=[],faces=[];
  const nu=rows+1,nv=columns+1;
  for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){
    const u=i/rows,v=j/columns;
    vertices.push(fn(u,v));
  }
  for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){
    const a=i*nv+j,b=a+1,c=a+nv,e=c+1;
    faces.push([a,b,e,c]);
  }
  return {vertices,faces};
}
export function quadricScene(type,{a=1,b=1,c=1,d=0}={}){
  if(!Object.hasOwn(QUADRIC_TYPES,type))throw new Error('Quádrica desconhecida: '+type);
  if(![a,b,c,d].every(Number.isFinite)||a<=0||b<=0||c<=0||Math.max(a,b,c)>20||Math.abs(d)>50)
    throw new Error('Use escalas positivas a,b,c (até 20) e translação d finita.');
  let meshes=[];
  switch(type){
    case 'esfera':
    case 'elipsoide':{
      const r=sheet((u,v)=>{
        const phi=-Math.PI/2+Math.PI*u,theta=TAU*v;
        return [a*Math.cos(phi)*Math.cos(theta),b*Math.cos(phi)*Math.sin(theta),d+c*Math.sin(phi)];
      });
      meshes=[r];break;
    }
    case 'paraboloide':
      meshes=[sheet((u,v)=>{
        const radius=u*1.8,theta=TAU*v;
        return [a*radius*Math.cos(theta),b*radius*Math.sin(theta),d+c*radius*radius];
      })];break;
    case 'hiperboloide1':
      meshes=[sheet((u,v)=>{
        const t=-1.4+2.8*u,theta=TAU*v;
        return [a*Math.cosh(t)*Math.cos(theta),b*Math.cosh(t)*Math.sin(theta),d+c*Math.sinh(t)];
      })];break;
    case 'hiperboloide2':
      meshes=[-1,1].map(sign=>sheet((u,v)=>{
        const t=1.5*u,theta=TAU*v;
        return [a*Math.sinh(t)*Math.cos(theta),b*Math.sinh(t)*Math.sin(theta),d+sign*c*Math.cosh(t)];
      }));break;
    case 'sela':
      meshes=[sheet((u,v)=>{
        const x=(u-.5)*3.2,y=(v-.5)*3.2;
        return [a*x,b*y,d+c*(x*x-y*y)];
      },{rows:32,columns:32,closedV:false})];break;
    case 'cilindro':
      meshes=[sheet((u,v)=>{
        const theta=TAU*v;
        return [a*Math.cos(theta),b*Math.sin(theta),d+c*(u-.5)*5];
      })];break;
  }
  const palette={esfera:'#2e8ba7',elipsoide:'#2e8ba7',paraboloide:'#249b76',
    hiperboloide1:'#c5693e',hiperboloide2:'#b86456',sela:'#8a69be',cilindro:'#4586b2'};
  const color=palette[type];
  const scene=meshes.map(m=>({kind:'mesh',...m,color,alpha:.44,quadric:true}));
  return {kind:type,label:QUADRIC_TYPES[type],scene,
    equations:{
      esfera:'x²/a² + y²/b² + (z−d)²/c² = 1',
      elipsoide:'x²/a² + y²/b² + (z−d)²/c² = 1',
      paraboloide:'(z−d)/c = x²/a² + y²/b²',
      hiperboloide1:'x²/a² + y²/b² − (z−d)²/c² = 1',
      hiperboloide2:'(z−d)²/c² − x²/a² − y²/b² = 1',
      sela:'(z−d)/c = x²/a² − y²/b²',
      cilindro:'x²/a² + y²/b² = 1'
    }[type],
    params:{a,b,c,d}};
}
