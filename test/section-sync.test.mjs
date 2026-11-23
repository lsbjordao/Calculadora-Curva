import test from 'node:test';
import assert from 'node:assert/strict';
import {createCamera,projectPoint} from '../src/space3d/camera.js';
import {nearestProjectedSection,nearestSectionInPlane,linkedWorldFromSection,
  linkedSectionFromWorld} from '../src/space3d/section-sync.js';
import {sectionPlane} from '../src/space3d/quadric-sections.js';

test('nearest 2D curve point snaps and ignores points far from curve',()=>{
  const segments=[{a:[0,0],b:[4,0]},{a:[4,0],b:[4,3]}];
  const xy=p=>[p[0]*25,p[1]*25];
  const hit=nearestSectionInPlane(segments,xy,50,5);
  assert.ok(hit);
  assert.ok(Math.abs(hit.local[0]-2)<1e-10);
  assert.ok(Math.abs(hit.local[1])<1e-10);
  assert.equal(nearestSectionInPlane(segments,xy,0,90),null);
});
test('2D/3D basis mapping roundtrip preserves arbitrary point',()=>{
  const p=sectionPlane({inclination:43,azimuth:-22,offset:2});
  const analysis={origin:p.origin,axisS:p.axisS,axisT:p.axisT};
  const local=[-2.5,1.3];
  const world=linkedWorldFromSection(local,analysis);
  const back=linkedSectionFromWorld(world,analysis);
  for(let i=0;i<2;i++)assert.ok(Math.abs(back[i]-local[i])<1e-10);
});
test('nearest projected 3D curve point respects the camera transform',()=>{
  const camera=createCamera({azimuth:-60,elevation:25,scale:32,projection:'ortho'});
  const viewport={width:640,height:480};
  const ends=[[0,0,0],[4,0,0]];
  const a=projectPoint(camera,ends[0],viewport),b=projectPoint(camera,ends[1],viewport);
  const hit=nearestProjectedSection([{a:ends[0],b:ends[1]}],camera,viewport,
    (a.x+b.x)/2,(a.y+b.y)/2);
  assert.ok(hit);
  for(let i=0;i<3;i++)assert.ok(Math.abs(hit.world[i]-(ends[0][i]+ends[1][i])/2)<1e-8);
  assert.equal(nearestProjectedSection([{a:ends[0],b:ends[1]}],camera,viewport,2,2),null);
});
