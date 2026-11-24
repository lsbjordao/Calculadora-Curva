import assert from 'node:assert/strict';
import test from 'node:test';

import { addGeometryDefinitions, extractGeometryParams, parseGeometryInput } from '../src/geometry.js';
import { detect3dEquation } from '../src/space3d/geometry3d.js';

// Book syntax in ℝ³ (spec §5.2, §7a.2, §7a.3, §7a.8): keyword labels are not
// sliders, vetor: u*2, unprefixed equations in z, quadrica:/corte: by equation.

const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} ≉ ${b}`);
const info=r=>(r?.info||[]).join(' · ');
const ok=r=>{ assert.ok(r,'resultado nulo'); assert.notEqual(r.type,'error',r.error||info(r)); return r; };
const run=(lines,params={})=>{
  const registry=new Map();
  const out=lines.map(text=>{
    const r=parseGeometryInput(text,{params,registry});
    if(r&&!r.error) addGeometryDefinitions(registry,r);
    return r;
  });
  return {out,registry};
};
const params=(text,registry)=>extractGeometryParams(text,{registry}).sort();

// ── 1. Keyword labels are not sliders (§7a.2) ─────────────────────────────

test('labels u=, v=, w=, n=, P=, Q= are keywords, not sliders; free scalars in their values still are', ()=>{
  assert.deepEqual(params('vetor: u=(1,2,3)'),[]);
  assert.deepEqual(params('vetorial: u=(1,2,3), v=(4,5,6)'),[]);
  assert.deepEqual(params('misto: u=(1,0,0), v=(0,1,0), w=(0,0,1)'),[]);
  assert.deepEqual(params('plano: P=(1,0,0), n=(2,-1,k)'),['k']);
  assert.deepEqual(params('plano: P=(1,0,0), u=(1,0,0), v=(0,1,k)'),['k']);
  assert.deepEqual(params('reta: P=(1,2,3), v=(k,0,1)'),['k']);
  assert.deepEqual(params('reta: Q=(a,b,0), v=(1,0,0)'),['a','b']);
  assert.deepEqual(params('produto: u=(3,4,0); v=(1,0,0)'),[]);
  assert.deepEqual(params('plano(P=(1,0,0), n=(2,-1,k))'),['k']);
});

test('t in a parametric line is bound; equations keep their scalars', ()=>{
  assert.deepEqual(params('reta: (1,2,3) + t*(1,0,a)'),['a']);
  assert.deepEqual(params('reta: x = 1 + 2t, y = b, z = t'),['b']);
  // An argument that is an equation (mentions x, y or z) is not a label.
  assert.deepEqual(params('plano: k*x + y = 1'),['k']);
  assert.deepEqual(params('conica: x^2 + y^2 = r'),['r']);
  assert.deepEqual(params('a = x + y'),['a']);
});

test("main's slider names u, v, h stay sliders where they are free values", ()=>{
  assert.deepEqual(params('tangente: elipsoide,a,b,c,d,u,v'),['a','b','c','d','u','v']);
  assert.deepEqual(params('ponto: A=(u,v,1)'),['u','v']);
  assert.deepEqual(params('vetor: w=(u,0,h)'),['h','u']);
  assert.deepEqual(params('escala: u, (1,2,3)'),['u']);
});

test('a name defined as an object in another line is that object, not a slider', ()=>{
  const {registry}=run(['vetor: u=(1,2,3)','vetor: v=(4,5,6)','A = (1,0,0)','a = (0,0,1)']);
  assert.deepEqual(params('vetorial: u, v',registry),[]);
  assert.deepEqual(params('soma: u, v',registry),[]);
  assert.deepEqual(params('escala: k, u',registry),['k']);
  assert.deepEqual(params('vetor: a, A',registry),[]);
  // Without the definitions they are still sliders (2D and older lines unchanged).
  assert.deepEqual(params('vetorial: u, v'),['u','v']);
  // Positional scalar commands of main keep u and v as sliders even if a vector u exists.
  assert.deepEqual(params('tangente: elipsoide,1,1,1,0,u,v',registry),['u','v']);
});

// ── 2. vetor: u*2, -u, u/2 ────────────────────────────────────────────────

test('vetor: u*2, -u, u/2 and (1,2,3)*k scale like k*u', ()=>{
  const {out}=run(['vetor: u=(1,2,3)','vetor: u*2','vetor: -u','vetor: u/2','vetor: w = u*2','vetor: (1,2,3)*k','vetor: -u/2'],{k:3});
  const tip=r=>ok(r).scene3d.filter(p=>p.kind==='arrow'&&p.role==='main').at(-1).to;
  assert.deepEqual(tip(out[1]),[2,4,6]);
  assert.match(info(out[1]),/2u = 2·\(1, 2, 3\) = \(2, 4, 6\)/);
  assert.deepEqual(tip(out[2]),[-1,-2,-3]);
  assert.match(info(out[2]),/sentido oposto/);
  assert.deepEqual(tip(out[3]),[0.5,1,1.5]);
  assert.match(info(out[3]),/u\/2 = 0\.5·/);
  assert.equal(out[4].definitions.find(d=>d.name==='w').kind,'vector');
  assert.deepEqual(tip(out[5]),[3,6,9]);
  assert.deepEqual(tip(out[6]),[-0.5,-1,-1.5]);
  // Arguments of other commands accept the same forms.
  const {out:more}=run(['vetor: u=(1,0,0)','vetor: v=(0,1,0)','soma: u*2, v/2']);
  assert.deepEqual(ok(more[2]).scene3d.find(p=>p.kind==='arrow'&&p.label==='2u+v/2').to,[2,0.5,0]);
});

// ── 3. Unprefixed equations in z (§7a.3) ──────────────────────────────────

test('unprefixed degree 1 in z is a plane, exactly like plano:', ()=>{
  const r=ok(parseGeometryInput('x + y + z = 3'));
  const p=ok(parseGeometryInput('plano: x + y + z = 3'));
  assert.equal(r.type,'plane');
  assert.equal(r.dim,3);
  assert.deepEqual(r.info,p.info);
  assert.deepEqual(r.definitions,p.definitions);
  assert.deepEqual(ok(parseGeometryInput('2x - y + z = 3',{})).definitions[0].value.n,[2,-1,1]);
  assert.equal(ok(parseGeometryInput('z = k*x',{params:{k:0}})).type,'plane');
});

test('unprefixed symmetric form is a line', ()=>{
  const r=ok(parseGeometryInput('(x-1)/2 = (y+1)/3 = z'));
  assert.equal(r.type,'line');
  assert.match(info(r),/X = \(1, -1, 0\) \+ t·\(2, 3, 1\)/);
});

test('unprefixed degree 2 in z uses the superficie: path (classification and auto cuts)', ()=>{
  const r=ok(parseGeometryInput('x^2/4 + y^2/9 - z^2 = 1'));
  const s=ok(parseGeometryInput('superficie: x^2/4 + y^2/9 - z^2 = 1'));
  assert.equal(r.type,'surface');
  assert.ok(r.generalQuadric?.polynomial,'generalQuadric (used by the automatic plane cuts)');
  assert.deepEqual(r.info,s.info);
  assert.match(info(r),/Hiperboloide de uma folha/i);
  assert.match(info(ok(parseGeometryInput('2*x*y + z^2 = 1'))),/Hiperboloide de uma folha/i);
  assert.match(info(ok(parseGeometryInput('z = x^2 + y^2'))),/Paraboloide el[ií]ptico/i);
  // Explicit z = f(x,y) that is not quadratic: main's function-of-two-variables lab.
  const f=ok(parseGeometryInput('z = sin(x)*cos(y)'));
  assert.ok(f.multivar,'função de duas variáveis');
});

test('unprefixed other degrees give the Portuguese error; lines without z are untouched', ()=>{
  const r=parseGeometryInput('x^3 + z = 1');
  assert.equal(r.type,'error');
  assert.equal(r.error,'equação em x, y, z de grau 3: a Curva desenha planos (grau 1) e quádricas (grau 2)');
  assert.match(parseGeometryInput('x^2*y^2 + z = 1').error,/grau 4/);
  assert.match(parseGeometryInput('sin(x) + z = 1').error,/não é polinomial/);
  for(const text of ['x^2 + y^2 = 4','y = 2x + 1','x + y = 3','x^2 + y^2 < 4','sin(x)','z'])
    assert.equal(parseGeometryInput(text),null,text);
  // A line with z but no equation, and inequalities, keep the old route.
  assert.equal(parseGeometryInput('x + z'),null);
  assert.equal(parseGeometryInput('x + y + z < 3'),null);
  // An object named z keeps its old meaning.
  const {registry}=run(['z = (1,2)']);
  assert.equal(parseGeometryInput('x + z = 3',{registry}),null);
});

test('detect3dEquation reports kind and degree', ()=>{
  assert.deepEqual(detect3dEquation('x + y + z = 3'),{kind:'plane',degree:1});
  assert.deepEqual(detect3dEquation('(x-1)/2 = (y+1)/3 = z'),{kind:'line3',degree:1});
  assert.deepEqual(detect3dEquation('x^2 + y^2 - z^2 = 0'),{kind:'quadric',degree:2});
  assert.deepEqual(detect3dEquation('x^3 + z = 1'),{kind:'other',degree:3});
  assert.equal(detect3dEquation('x^2 + y^2 = 4'),null);
});

// ── 4. quadrica: <equação> and corte: <superfície>, <plano> ───────────────

test("quadrica: <equação> is the superficie: path; main's quadrica: tipo,a,b,c,d still works", ()=>{
  const q=ok(parseGeometryInput('quadrica: x^2/4 + y^2/9 + z^2 = 1'));
  assert.equal(q.type,'surface');
  assert.match(info(q),/Elipsoide/i);
  assert.deepEqual(q.info,ok(parseGeometryInput('superficie: x^2/4 + y^2/9 + z^2 = 1')).info);
  const t=ok(parseGeometryInput('quadrica: elipsoide,2,3,1,0'));
  assert.equal(t.type,'quadric');
  // Named: Q = quadrica(...) / Q = superficie(...) register a surface.
  const {out,registry}=run(['Q = quadrica(x^2 + y^2 - z^2 = 0)','S = superficie(x^2 + y^2 + z^2 = 4)']);
  ok(out[0]); ok(out[1]);
  assert.equal(registry.get('Q').kind,'surface');
  assert.equal(registry.get('S').kind,'surface');
});

const cutOf=(lines,params={})=>{
  const {out}=run(lines,params);
  return ok(out.at(-1));
};

test('corte: ellipsoid by z = 0 is an ellipse with x^2/4 + y^2/9 = 1', ()=>{
  const r=cutOf(['corte: x^2/4 + y^2/9 + z^2 = 1, z = 0']);
  assert.equal(r.type,'section');
  assert.equal(r.section.kind,'quadric-plane');
  assert.equal(r.section.analysis.type,'ellipse');
  assert.match(info(r),/Seção: elipse/);
  // Conic equation in the other two variables, proportional to x²/4 + y²/9 − 1 = 0.
  const c=r.conicEquation;
  assert.ok(c,'conicEquation');
  assert.deepEqual(c.vars,['x','y']);
  const k=c.A/0.25;
  close(c.C,k/9,1e-12); close(c.F,-k,1e-12);
  for(const v of [c.B,c.D,c.E]) close(v,0,1e-12);
  assert.match(info(r),/no plano z = 0: /);
  assert.match(info(r),/conica: elipse/);
  assert.ok(r.scene3d.some(p=>p.sectionCurve),'curva desenhada');
  assert.ok(r.scene3d.some(p=>p.kind==='plane'),'plano desenhado');
});

test('corte: cone x^2 + y^2 - z^2 = 0 by z = 1, y + z = 1, z = 0 and x = 0', ()=>{
  const cone='Q = superficie(x^2 + y^2 - z^2 = 0)';
  const type=plane=>cutOf([cone,'corte: Q, '+plane]);
  const circle=type('z = 1');
  assert.equal(circle.section.analysis.type,'circle');
  assert.match(info(circle),/Seção: circunferência/);
  assert.match(info(circle),/conica: circunferencia/);
  const parabola=type('y + z = 1');
  assert.equal(parabola.section.analysis.type,'parabola');
  assert.match(info(parabola),/Seção: parábola/);
  assert.equal(parabola.conicEquation,undefined,'plano qualquer: só o tipo');
  const point=type('z = 0');
  assert.equal(point.section.analysis.type,'vertex-point');
  assert.match(info(point),/Seção: um ponto/);
  const lines=type('x = 0');
  assert.equal(lines.section.analysis.type,'two-lines');
  assert.match(info(lines),/Seção: par de retas/);
  assert.deepEqual(lines.conicEquation.vars,['y','z']);
});

test('corte: plane by name, slider in the plane, errors in Portuguese', ()=>{
  const r=cutOf(['Q = superficie(x^2 + y^2 - z^2 = 0)','p1 = plano(z = 2)','corte: Q, p1']);
  assert.equal(r.section.analysis.type,'circle');
  const k=cutOf(['Q = superficie(x^2 + y^2 - z^2 = 0)','corte: Q; z = k'],{k:3});
  assert.match(info(k),/no plano z = 3/);
  const {out}=run(['corte: W, z = 1']);
  assert.equal(out[0].type,'error');
  assert.match(out[0].error,/nome desconhecido: W/);
  const {out:o2}=run(['Q = superficie(x^2 + y^2 - z^2 = 0)','corte: Q, (1,2,3)']);
  assert.match(o2[1].error,/plano/);
  const {out:o3}=run(['vetor: u=(1,2,3)','corte: u, z = 1']);
  assert.match(o3[1].error,/superfície/);
  // main's form keeps working.
  ok(parseGeometryInput('corte: elipsoide,2,3,1,0,0,0,h',{params:{h:0.5}}));
});

test('COMMAND_NAMES_PT has no gaps for the new forms (errors name the command in Portuguese)', ()=>{
  assert.match(parseGeometryInput('corte: x^2 + y^2 = 1').error,/^Corte: use /);
});

// ── GC minors ─────────────────────────────────────────────────────────────

test('a name labelled in the same line is an object, not a slider', ()=>{
  assert.deepEqual(params('vetor: u=(1,2,3), v=u*k'),['k']);
  assert.deepEqual(params('soma: u=(1,0,0), v=(0,1,0), 2*u'),[]);
  // main's positional commands keep their u, v.
  assert.deepEqual(params('tangente: elipsoide,a,b,c,d,u,v'),['a','b','c','d','u','v']);
});

test('vetor: u/0 says "divisão por zero"; trivial equations say "sem variáveis"', ()=>{
  const {out}=run(['vetor: u=(1,2,3)','vetor: u/0','vetor: u/k'],{k:0});
  assert.equal(out[1].error,'escala: divisão por zero (u/0)');
  assert.equal(out[2].error,'escala: divisão por zero (u/k)');
  assert.match(parseGeometryInput('x - x + z - z = 1').error,/^equação sem variáveis/);
});

test('corte: prints the conic with fractions and the constant on the right', ()=>{
  const lines=text=>info(ok(parseGeometryInput(text)));
  assert.match(lines('corte: x^2/4 + y^2/9 + z^2 = 1, z = 0'),/no plano z = 0: x\^2\/4 \+ y\^2\/9 = 1/);
  assert.match(lines('corte: x^2/4 + y^2/9 + z^2 = 1, x = 1'),/no plano x = 1: y\^2\/9 \+ z\^2 = 3\/4/);
  assert.match(lines('corte: x^2 + y^2 - z^2 = 0, x = 0'),/no plano x = 0: y\^2 - z\^2 = 0/);
});
