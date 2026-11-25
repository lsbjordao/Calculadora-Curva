import assert from 'node:assert/strict';
import test from 'node:test';

import { parseGeometryInput, xAxisAngleAnchor, xAxisAngleLines } from '../src/geometry.js';

const VIEW_A={xmin:-5,xmax:12,ymin:-10,ymax:6};
const VIEW_B={xmin:-20,xmax:3,ymin:-14,ymax:2};

function close(actual,expected,tol=1e-9){
  assert.ok(Math.abs(actual-expected)<=tol, `${actual} not within ${tol} of ${expected}`);
}

function lineByLabel(geometry,label){
  const line=geometry.lines.find(item=>item.label===label);
  assert.ok(line,'missing line '+label);
  return line;
}

test('circle symmetry axes are not offered to ang x',()=>{
  const circle=parseGeometryInput('conica: x² + y² - 8x +4y - 29 = 0');
  assert.ok(circle.lines.length>0,'circle still draws its auxiliary axes');
  assert.deepEqual(xAxisAngleLines(circle),[]);
});

test('ellipse axes keep ang x and anchor it at the center for any view',()=>{
  const ellipse=parseGeometryInput('conica: (x-1)^2/9 + (y+2)^2/4 = 1');
  const lines=xAxisAngleLines(ellipse);
  assert.ok(lines.length>=2);
  for(const label of ['eixo x=C','eixo y=C']){
    const line=lineByLabel(ellipse,label);
    assert.ok(lines.includes(line));
    for(const view of [VIEW_A,VIEW_B]){
      const anchor=xAxisAngleAnchor(line,view);
      close(anchor.x,1); close(anchor.y,-2);
    }
  }
});

test('parabola axis anchors ang x at the vertex',()=>{
  const parabola=parseGeometryInput('conica: y = (x-3)^2 + 1');
  const anchor=xAxisAngleAnchor(lineByLabel(parabola,'eixo'),VIEW_A);
  close(anchor.x,3); close(anchor.y,1);
});

test('rotated conic axes anchor ang x at the center',()=>{
  const conic=parseGeometryInput('conica: x*y = 1');
  const axis=lineByLabel(conic,'eixo principal 1');
  const anchor=xAxisAngleAnchor(axis,VIEW_B);
  close(anchor.x,0); close(anchor.y,0);
});

test('a line crossing the visible x-axis keeps the crossing as anchor',()=>{
  const line=parseGeometryInput('reta: (1,0),(2,1)').lines[0];
  const anchor=xAxisAngleAnchor(line,VIEW_A);
  close(anchor.x,1); close(anchor.y,0);
});

test('a horizontal line anchors at a fixed point that does not follow the view',()=>{
  const line=parseGeometryInput('reta: (5,3),(9,3)').lines[0];
  const a=xAxisAngleAnchor(line,VIEW_A), b=xAxisAngleAnchor(line,VIEW_B);
  close(a.x,0); close(a.y,3);
  assert.deepEqual(a,b);
});

test('a line whose x-crossing is off screen anchors at its point nearest the origin',()=>{
  const line=parseGeometryInput('reta: (30,0),(31,1)').lines[0];
  const a=xAxisAngleAnchor(line,VIEW_A), b=xAxisAngleAnchor(line,VIEW_B);
  close(a.x,15); close(a.y,-15);
  assert.deepEqual(a,b);
});
