import test from 'node:test';
import assert from 'node:assert/strict';
import {quadricScene,QUADRIC_TYPES} from '../src/space3d/quadrics.js';
import {parseGeometryInput} from '../src/geometry.js';
import {scenePrimitives,has3dObjects,autoAxisLimit} from '../src/space3d/view3d.js';
import {prepareThreePrimitives} from '../src/space3d/three-renderer.js';
import {primitivesToPlotlyData} from '../src/space3d/plotly-renderer.js';
import {PRESETS} from '../src/presets.js';
const near=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,a+' != '+b);
test('sete superfícies quádricas geram malhas finitas e trianguláveis',()=>{
  assert.equal(Object.keys(QUADRIC_TYPES).length,7);
  for(const type of Object.keys(QUADRIC_TYPES)){
    const q=quadricScene(type,{a:1.2,b:1.1,c:1.4,d:.7});
    assert.equal(q.kind,type);
    assert.ok(q.scene.length>=1);
    assert.ok(q.equations.includes('='));
    for(const surface of q.scene){
      assert.equal(surface.kind,'mesh');
      assert.ok(surface.vertices.length>200);
      assert.ok(surface.faces.length>200);
      for(const p of surface.vertices){
        assert.equal(p.length,3);
        assert.ok(p.every(Number.isFinite));
      }
      for(const f of surface.faces){
        assert.equal(f.length,4);
        assert.ok(f.every(idx=>Number.isInteger(idx)&&idx>=0&&idx<surface.vertices.length));
      }
    }
  }
});
test('vértices das malhas respeitam as equações implícitas das quádricas',()=>{
  const a=1.2,b=.8,c=1.4,d=.3;
  for(const type of Object.keys(QUADRIC_TYPES)){
    const m=quadricScene(type,{a,b,c,d});
    for(const surface of m.scene)for(const [x,y,z] of surface.vertices.filter((_,i)=>i%13===0)){
      const X=(x/a)**2,Y=(y/b)**2,Z=(z-d)/c;
      switch(type){
        case 'esfera':case 'elipsoide':near(X+Y+Z*Z,1);break;
        case 'paraboloide':near(Z,X+Y);break;
        case 'hiperboloide1':near(X+Y-Z*Z,1);break;
        case 'hiperboloide2':near(Z*Z-X-Y,1);break;
        case 'sela':near(Z,X-Y);break;
        case 'cilindro':near(X+Y,1);break;
      }
    }
  }
});
test('comando quadrica e catálogo entram nos três motores sem alterar cônicas existentes',()=>{
  const types=Object.keys(QUADRIC_TYPES);
  for(const type of types){
    const g=parseGeometryInput('quadrica: '+type+',a,b,c,d',{params:{a:1.2,b:1.4,c:.6,d:1}});
    assert.ok(!g.error,String(g.error));
    assert.equal(g.dim,3);
    assert.equal(g.type,'quadric');
    const eq={kind:'geometry',visible:true,error:false,geometry:g};
    assert.equal(has3dObjects([eq]),true);
    const primitives=scenePrimitives([eq],{colorOf:()=>'#000'});
    assert.ok(primitives.some(p=>p.kind==='mesh'));
    assert.ok(prepareThreePrimitives(primitives).some(p=>p.kind==='mesh'));
    assert.ok(primitivesToPlotlyData(primitives,{range:10}).some(p=>p.type==='mesh3d'));
    assert.ok(autoAxisLimit([eq])>=5);
  }
  assert.ok(parseGeometryInput('quadrica: naoexiste').error);
  assert.ok(parseGeometryInput('quadrica: elipsoide,-1,1,1,0').error);
  const preset=PRESETS.find(x=>x.id==='quadric-gallery-3d');
  assert.ok(preset);
  assert.equal(preset.equations.length,7);
  assert.ok(preset.equations.slice(1).every(x=>x.visible===false));
  assert.ok(!parseGeometryInput('secao: 2,.5').error);
});
