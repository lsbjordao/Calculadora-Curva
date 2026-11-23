import test from 'node:test';
import assert from 'node:assert/strict';
import {analyseConicSection,worldToSection,sectionToWorld,sectionCurves,conicMetricSummary} from '../src/space3d/section-analysis.js';
import {sectionSvg} from '../src/space3d/section-panel.js';
import {parseGeometryInput} from '../src/geometry.js';
const almost=(actual,expected,eps=1e-8)=>assert.ok(Math.abs(actual-expected)<eps,actual+' versus '+expected);
const evaluate=(params)=>{
  const g=parseGeometryInput('secao: h,angulo(q),a,d,p,b',{params});
  assert.ok(!g.error,String(g.error));
  return {analysis:sectionCurves(g),geometry:g};
};
test('painel: circunferência horizontal com raio correto em referencial ortonormal',()=>{
  const {analysis}=evaluate({h:2,q:0,a:1.5,d:1,p:.7,b:2});
  assert.equal(analysis.type,'circle');
  almost(analysis.semiaxes.major,3);
  almost(analysis.semiaxes.minor,3);
  almost(analysis.eccentricity,0);
  almost(analysis.origin[2],3);
  almost(analysis.foci[0][0],analysis.center[0]);
  for(const s of analysis.segments.slice(0,35))for(const st of [s.a,s.b]){
    almost(st[0]**2+st[1]**2,9,1e-6);
  }
});
test('painel: um mesmo ponto é invertível entre a cena 3D e coordenadas do plano',()=>{
  for(const params of [{h:2,q:27,a:1,d:0,p:.6,b:.75},
    {h:2,q:58,a:1.3,d:2,p:-1.1,b:-.9},
    {h:2,q:90,a:1.2,d:-.4,p:.2,b:.75}]){
    const {analysis,geometry}=evaluate(params);
    assert.ok(analysis.segments.length>4);
    for(const seg of analysis.segments.slice(0,25))for(const st of [seg.a,seg.b]){
      const world=sectionToWorld(st,analysis);
      const local=worldToSection(world,analysis);
      almost(local[0],st[0],1e-6);
      almost(local[1],st[1],1e-6);
      const c=world.map((x,i)=>x-geometry.scene3d.find(p=>p.kind==='point'&&p.label==='vértice').p[i]);
      almost(c[0]**2+c[1]**2,params.a*params.a*c[2]*c[2],1e-5);
    }
  }
});

test('painel: elipse tem dois semieixos e focos corretamente relacionados',()=>{
  const {analysis}=evaluate({h:2,q:27,a:1,d:0,p:0,b:.75});
  assert.equal(analysis.type,'ellipse');
  assert.ok(analysis.semiaxes.major>analysis.semiaxes.minor);
  assert.ok(analysis.eccentricity>0&&analysis.eccentricity<1);
  const c=Math.sqrt(analysis.semiaxes.major**2-analysis.semiaxes.minor**2);
  const distances=analysis.foci.map(f=>Math.hypot(f[0]-analysis.center[0],f[1]-analysis.center[1]));
  distances.forEach(distance=>almost(distance,c));
});
test('painel: parábola e hipérbole, inclusive vertical, com elementos canônicos',()=>{
  const parab=evaluate({h:2,q:45,a:1,d:0,p:0,b:.75}).analysis;
  assert.equal(parab.type,'parabola');
  assert.equal(parab.eccentricity,1);
  assert.ok(parab.vertex&&parab.foci.length===1);
  const hyper=evaluate({h:2,q:90,a:1,d:0,p:.4,b:.75}).analysis;
  assert.equal(hyper.type,'hyperbola');
  almost(hyper.semiaxes.real,.75);
  almost(hyper.semiaxes.conjugate,.75);
  almost(hyper.eccentricity,Math.sqrt(2));
  assert.ok(hyper.asymptotes?.length===2);
});
test('painel: passar pelo vértice exibe seção degenerada, não foco fictício',()=>{
  const data=evaluate({h:2,q:90,a:1,d:0,p:0,b:0}).analysis;
  assert.equal(data.type,'two-lines');
  assert.equal(data.segments.length,2);
  assert.equal(data.semiaxes,null);
  assert.equal(data.foci.length,0);
  const metrics=conicMetricSummary(data);
  assert.ok(metrics.some(([label,val])=>label==='Tipo'&&/Duas retas/.test(val)));
});
test('SVG da seção é vetorial, com curva e sem incorporar imagem raster',()=>{
  const a=evaluate({h:2,q:27,a:1,d:0,p:0,b:.75}).analysis;
  const svg=sectionSvg(a,800,500,{dark:true});
  assert.match(svg,/<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg,/<path d="M/);
  assert.match(svg,/stroke="#df5188"/);
  assert.doesNotMatch(svg,/<image|data:image/);
  assert.doesNotMatch(svg,/NaN|Infinity/);
});
test('sintaxe anterior de k usa o plano histórico sem afastamento horizontal extra',()=>{
  const g=parseGeometryInput('secao: 2,.5');
  const a=sectionCurves(g);
  assert.equal(a.type,'ellipse');
  assert.equal(a.offset,0);
  for(const item of a.segments.slice(0,20))for(const st of [item.a,item.b]){
    const [x,y,z]=sectionToWorld(st,a);
    almost(z,2+.5*x,1e-6);
  }
});
