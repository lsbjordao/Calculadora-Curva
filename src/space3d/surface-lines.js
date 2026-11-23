"use strict";

/**
 * Visible meridians/parallels for Three.js surfaces.
 *
 * We deliberately do NOT use WireframeGeometry: it exposes triangle
 * diagonals (and marching-tetrahedra artifacts) instead of readable
 * mathematical isolines. The curves follow existing vertices and are
 * rebuilt only when the surface geometry changes, not when the camera spins.
 *
 * The data model and the Canvas/Plotly renderers remain unchanged.
 */

const valid = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const EPS2=1e-16;
const choose=(last,count)=>{
  const ids=new Set();
  for(let i=0;i<count;i++)ids.add(Math.round(i*last/Math.max(1,count-1)));
  return [...ids].sort((a,b)=>a-b);
};
const coords=(vertex)=>[vertex[0],vertex[1],vertex[2]];
function writer(maxSegments=25000){
  const data=[];
  const put=(a,b)=>{
    if(!valid(a)||!valid(b)||data.length>=maxSegments*6)return;
    const dx=a[0]-b[0],dy=a[1]-b[1],dz=a[2]-b[2];
    if(dx*dx+dy*dy+dz*dz<EPS2)return;
    data.push(a[0],a[1],a[2],b[0],b[1],b[2]);
  };
  return {put,get positions(){return new Float32Array(data);},get count(){return data.length/6;}};
}
function lattice(prim){
  const faces=prim.faces,vertices=prim.vertices,first=faces?.[0];
  if(!Array.isArray(first)||first.length!==4||first[0]!==0)return null;
  // Legacy double-cone uses TWO sheets, n angles per ring, no duplicate
  // seam vertex, and reverses the winding on the lower nappe.
  if(prim.conicSection&&first[3]===1&&first[1]>5&&first[2]===first[1]+1){
    const columns=first[1],sections=2,rows=vertices.length/(sections*columns)-1;
    if(!Number.isInteger(rows)||rows<2||
      faces.length!==sections*rows*columns)return null;
    return {type:'cone',columns,rows,sections};
  }
  // Standard quadrics: (rows+1) × (columns+1), with an explicitly
  // duplicated seam at v=1 so the rasterization uses continuous quads.
  const stride=first[3],columns=stride-1,rows=vertices.length/stride-1;
  if(!(stride>3&&first[1]===1&&first[2]===stride+1)||
    !Number.isInteger(rows)||rows<2||faces.length!==rows*columns)return null;
  return {type:'grid',columns,rows,sections:1,stride};
}
function structuredLines(prim,shape,density){
  const out=writer();
  const detailed=density==='detailed';
  const {rows,columns}=shape;
  const rowLines=choose(rows,detailed?13:8);
  const colLines=choose(shape.type==='cone'?columns-1:columns,detailed?19:12);
  if(shape.type==='cone'){
    const block=columns*(rows+1);
    for(let sheet=0;sheet<shape.sections;sheet++){
      const base=sheet*block,at=(i,j)=>prim.vertices[base+i*columns+(j+columns)%columns];
      for(const i of rowLines)for(let j=0;j<columns;j++)out.put(at(i,j),at(i,j+1));
      for(const j of colLines)for(let i=0;i<rows;i++)out.put(at(i,j),at(i+1,j));
    }
  }else{
    const stride=shape.stride,at=(i,j)=>prim.vertices[i*stride+j];
    for(const i of rowLines)for(let j=0;j<columns;j++)out.put(at(i,j),at(i,j+1));
    for(const j of colLines)for(let i=0;i<rows;i++)out.put(at(i,j),at(i+1,j));
  }
  return {strategy:shape.type,positions:out.positions,segmentCount:out.count};
}
function intersection(a,b,fa,fb){
  const t=fa/(fa-fb);
  if(!Number.isFinite(t)||t<0||t>1)return null;
  return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
}
function slicedLines(prim,density){
  const vertices=prim.vertices,faces=prim.faces;
  const bounds=[0,1,2].map(axis=>{
    let min=Infinity,max=-Infinity;
    for(const v of vertices){min=Math.min(min,v[axis]);max=Math.max(max,v[axis]);}
    return {min,max};
  });
  const out=writer(density==='detailed'?35000:20000);
  const axes=density==='detailed'?[0,1,2]:[0,2];
  const levels=density==='detailed'?9:7;
  for(const axis of axes){
    const {min,max}=bounds[axis],span=max-min;
    if(!(span>1e-8))continue;
    for(let level=0;level<levels;level++){
      // Mid-cell slice levels avoid entire triangles coincident with
      // the slicing plane and keep the visual lattice evenly distributed.
      const value=min+(level+.5)/levels*span;
      for(const face of faces){
        if(!Array.isArray(face)||face.length<3)continue;
        const points=face.map(i=>vertices[i]);
        if(points.some(p=>!valid(p)))continue;
        for(let k=1;k<points.length-1;k++){
          const triangle=[points[0],points[k],points[k+1]];
          const f=triangle.map(p=>p[axis]-value);
          if(Math.min(...f)>=0||Math.max(...f)<=0)continue;
          const crossings=[];
          for(let edge=0;edge<3;edge++){
            const next=(edge+1)%3;
            if((f[edge]<0)===(f[next]<0))continue;
            const p=intersection(triangle[edge],triangle[next],f[edge],f[next]);
            if(p)crossings.push(p);
          }
          if(crossings.length===2)out.put(crossings[0],crossings[1]);
        }
        if(out.count>=20000&&density!=='detailed')break;
      }
    }
  }
  return {strategy:'slices',positions:out.positions,segmentCount:out.count};
}

/**
 * @param {object} prim - scene primitive {kind:'mesh',vertices,faces,...}
 * @param {'off'|'normal'|'detailed'} density - visual reference density
 * @returns {{strategy:string,positions:Float32Array,segmentCount:number}}
 */
export function buildMeshSurfaceLines(prim,density='normal'){
  const empty={strategy:'none',positions:new Float32Array(),segmentCount:0};
  if(density==='off'||!['normal','detailed'].includes(density)||prim?.kind!=='mesh'||
    !Array.isArray(prim.vertices)||!Array.isArray(prim.faces)||!prim.faces.length)return empty;
  const structure=lattice(prim);
  return structure?structuredLines(prim,structure,density):slicedLines(prim,density);
}
