import assert from 'node:assert/strict';
import test from 'node:test';

import { applyOpFields, createOpControls } from '../src/op-controls.js';

test('applyOpFields fills defaults when source is empty',()=>{
  const eq=applyOpFields({});
  assert.deepEqual(
    {showD2:eq.showD2,showR:eq.showR,dx:eq.dx,ia:eq.ia,ib:eq.ib,riemannN:eq.riemannN,riemannMode:eq.riemannMode,lx:eq.lx,lInf:eq.lInf,dp:eq.dp,showNormal:eq.showNormal,showGeoSideLengths:eq.showGeoSideLengths,showGeoVectorLengths:eq.showGeoVectorLengths,showGeoTriangleClass:eq.showGeoTriangleClass,showGeoAngles:eq.showGeoAngles,showGeoXAxisAngles:eq.showGeoXAxisAngles},
    {showD2:false,showR:false,dx:0,ia:0,ib:1,riemannN:8,riemannMode:'mid',lx:0,lInf:null,dp:1,showNormal:false,showGeoSideLengths:false,showGeoVectorLengths:false,showGeoTriangleClass:true,showGeoAngles:true,showGeoXAxisAngles:false}
  );
});

test('applyOpFields clamps decimal places to a valid integer',()=>{
  assert.equal(applyOpFields({}, {dp:3}).dp,3);
  assert.equal(applyOpFields({}, {dp:9}).dp,1);
  assert.equal(applyOpFields({}, {dp:1.5}).dp,1);
  assert.equal(applyOpFields({}, {dp:-1}).dp,1);
});

test('applyOpFields copies valid values and rejects junk',()=>{
  const eq=applyOpFields({}, {showD2:true,showR:true,dx:2,ia:-1,ib:3,riemannN:24,riemannMode:'trap',lx:0.5,lInf:'+',showGeoSideLengths:true,showGeoVectorLengths:true,showGeoTriangleClass:false,showGeoAngles:false,showGeoXAxisAngles:true});
  assert.deepEqual(
    {showD2:eq.showD2,showR:eq.showR,dx:eq.dx,ia:eq.ia,ib:eq.ib,riemannN:eq.riemannN,riemannMode:eq.riemannMode,lx:eq.lx,lInf:eq.lInf,showGeoSideLengths:eq.showGeoSideLengths,showGeoVectorLengths:eq.showGeoVectorLengths,showGeoTriangleClass:eq.showGeoTriangleClass,showGeoAngles:eq.showGeoAngles,showGeoXAxisAngles:eq.showGeoXAxisAngles},
    {showD2:true,showR:true,dx:2,ia:-1,ib:3,riemannN:24,riemannMode:'trap',lx:0.5,lInf:'+',showGeoSideLengths:true,showGeoVectorLengths:true,showGeoTriangleClass:false,showGeoAngles:false,showGeoXAxisAngles:true}
  );
  const bad=applyOpFields({}, {dx:'x',ia:NaN,ib:null,riemannN:0,riemannMode:'bad',lx:Infinity,lInf:'up'});
  assert.deepEqual(
    {dx:bad.dx,ia:bad.ia,ib:bad.ib,riemannN:bad.riemannN,riemannMode:bad.riemannMode,lx:bad.lx,lInf:bad.lInf},
    {dx:0,ia:0,ib:1,riemannN:8,riemannMode:'mid',lx:0,lInf:null}
  );
});

test('render emits fields only for enabled operations',()=>{
  function el(){
    return {
      children:[], className:'', innerHTML:'',
      appendChild(c){ this.children.push(c); return c; },
      append(...c){ this.children.push(...c); },
      dataset:{}, style:{},
      set value(v){ this._v=v; }, get value(){ return this._v; }
    };
  }
  globalThis.document={ createElement:()=>el() };
  const oc=createOpControls({ eqColor:()=>'#000', onChange:()=>{} });

  const box=el();
  oc.render({showD:false,showD2:false,showI:false,showL:false}, box);
  assert.equal(box.children.length,0);

  const box2=el();
  oc.render({showD:true,showD2:false,showI:true,showL:true,dx:0,ia:0,ib:1,lx:0,lInf:null,dp:1}, box2);
  assert.equal(box2.children.length,3);
  assert.ok(box2.children[0].children.some(c=>c.className==='op-dp'));

  const box3=el();
  oc.render({showD:false,showD2:false,showI:false,showR:true,showL:false,ia:0,ib:4,riemannN:8,riemannMode:'mid',dp:1}, box3);
  assert.equal(box3.children.length,2);
  assert.ok(box3.children[1].children.some(c=>c.className==='op-dp op-mode'));
});

test('applyOpFields normalizes new stats/histogram fields',()=>{
  const a=applyOpFields({});
  assert.equal(a.histBins, null);
  assert.equal(a.histDensity, false);
  assert.equal(a.histNormal, false);
  assert.equal(a.statsPop, false);

  const b=applyOpFields({}, {histBins:8, histDensity:true, histNormal:true, statsPop:true});
  assert.equal(b.histBins, 8);
  assert.equal(b.histDensity, true);
  assert.equal(b.histNormal, true);
  assert.equal(b.statsPop, true);

  assert.equal(applyOpFields({}, {histBins:0}).histBins, null);   // out of range -> auto
  assert.equal(applyOpFields({}, {histBins:999}).histBins, null);
});
