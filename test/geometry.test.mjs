import assert from 'node:assert/strict';
import test from 'node:test';

import { addGeometryDefinitions, extractGeometryParams, parseGeometryInput } from '../src/geometry.js';

function close(actual,expected,tol=1e-9){
  assert.ok(Math.abs(actual-expected)<=tol, `${actual} not within ${tol} of ${expected}`);
}

test('geometry parses distance and midpoint commands',()=>{
  const distance=parseGeometryInput('dist: (0,0),(3,4)');
  assert.equal(distance.type,'distance');
  assert.ok(distance.info.some(line=>line.includes('= 5')));
  assert.equal(distance.points.length,2);
  assert.equal(distance.segments.length,1);

  const midpoint=parseGeometryInput('medio: (0,0),(4,2)');
  assert.equal(midpoint.type,'midpoint');
  close(midpoint.points.find(p=>p.label==='M').x,2);
  close(midpoint.points.find(p=>p.label==='M').y,1);
});

test('geometry builds lines and line intersections',()=>{
  const line=parseGeometryInput('reta: (0,0),(2,4)');
  assert.equal(line.type,'line');
  assert.ok(line.info.some(item=>item.includes('y = 2x')));

  const intersection=parseGeometryInput('intersecao: line((0,0),(1,1)); line((0,1),(1,0))');
  assert.equal(intersection.type,'intersect');
  assert.equal(intersection.points.length,1);
  close(intersection.points[0].x,0.5);
  close(intersection.points[0].y,0.5);
});

test('geometry intersects a line with a conic',()=>{
  const intersection=parseGeometryInput('intersecao: line((-3,0),(3,0)); conic(x^2 + y^2 = 4)');
  assert.equal(intersection.points.length,2);
  close(intersection.points[0].x,-2);
  close(intersection.points[0].y,0);
  close(intersection.points[1].x,2);
  close(intersection.points[1].y,0);
});

test('geometry analyzes common conics',()=>{
  const circle=parseGeometryInput('conica: x^2 + y^2 = 4');
  assert.equal(circle.type,'conic');
  assert.ok(circle.info.includes('circunferencia'));
  assert.ok(circle.info.includes('raio = 2'));

  const ellipse=parseGeometryInput('conica: x^2/9 + y^2/4 = 1');
  assert.ok(ellipse.info.includes('elipse'));
  assert.ok(ellipse.points.some(p=>p.label==='F1'));

  const parabola=parseGeometryInput('conica: y = x^2/2');
  assert.ok(parabola.info.includes('parabola'));
  assert.ok(parabola.points.some(p=>p.label==='F'));
  assert.ok(parabola.lines.some(line=>line.label==='diretriz'));
});

test('geometry computes matrix diagnostics',()=>{
  const matrix=parseGeometryInput('matriz: [1,0.5; 0,1]');
  assert.equal(matrix.type,'matrix');
  close(matrix.matrix.det,1);
  close(matrix.matrix.trace,2);
  assert.equal(matrix.vectors.length,2);
  assert.equal(matrix.polygons.length,1);
});

test('geometry computes analytic angles and vector products',()=>{
  const angle=parseGeometryInput('angulo: (1,0),(0,0),(0,1)');
  assert.equal(angle.type,'angle');
  assert.ok(angle.info.some(line=>line.includes('90')));
  assert.equal(angle.vectors.length,2);
  assert.equal(angle.angles.length,1);
  close(angle.angles[0].vertex.x,0);
  close(angle.angles[0].vertex.y,0);
  close(angle.angles[0].deg,90);

  const dot=parseGeometryInput('produto: (0,0),(3,0); (0,0),(0,4)');
  assert.equal(dot.type,'dot');
  assert.ok(dot.info.some(line=>line.includes('u · v = 0')));

  const projection=parseGeometryInput('proj: (0,0),(3,4); (0,0),(1,0)');
  assert.equal(projection.type,'projection');
  assert.ok(projection.info.some(line=>line.includes('(3, 0)')));
  assert.equal(projection.vectors.length,3);
});

test('geometry builds polygons with internal angles and right triangle sides',()=>{
  const triangle=parseGeometryInput('triangulo: A=(0,0), B=(4,0), C=(0,3)');
  assert.equal(triangle.type,'polygon');
  assert.equal(triangle.label,'triangulo');
  assert.equal(triangle.points.length,3);
  assert.equal(triangle.segments.length,3);
  assert.equal(triangle.angles.length,3);
  close(triangle.angles.find(angle=>angle.vertex.label==='A').deg,90);
  close(triangle.angles.find(angle=>angle.vertex.label==='B').externalDeg,143.13010235415598);
  assert.deepEqual(triangle.triangleClass,{sideType:'escaleno',angleType:'retangulo',label:'escaleno retangulo'});
  assert.equal(triangle.polygons[0].caption,'escaleno retangulo');
  assert.ok(triangle.info.some(line=>line.includes('triangulo retangulo em A')));
  assert.ok(triangle.info.some(line=>line.includes('classificacao: escaleno retangulo')));
  assert.ok(triangle.info.some(line=>line.includes('catetos')));
  assert.ok(triangle.info.some(line=>line.includes('hipotenusa')));
  assert.equal(triangle.segments.filter(seg=>seg.label==='cateto'&&seg.showLabel).length,2);
  assert.equal(triangle.segments.filter(seg=>seg.label==='hipotenusa'&&seg.showLabel).length,1);

  const quadrilateral=parseGeometryInput('quadrilatero: A=(0,0), B=(2,0), C=(2,1), D=(0,1)');
  assert.equal(quadrilateral.type,'polygon');
  assert.equal(quadrilateral.points.length,4);
  assert.equal(quadrilateral.angles.length,4);
  assert.ok(quadrilateral.angles.every(angle=>Math.abs(angle.deg-90)<1e-9));
  assert.ok(quadrilateral.angles.every(angle=>Math.abs(angle.externalDeg-90)<1e-9));
  assert.ok(quadrilateral.info.some(line=>line.includes('area = 2')));

  const polygon=parseGeometryInput('polilatero: (0,0),(2,0),(2,1),(1,2),(0,1)');
  assert.equal(polygon.type,'polygon');
  assert.equal(polygon.points.length,5);
  assert.equal(polygon.angles.length,5);
});

test('geometry classifies triangles by sides and angles',()=>{
  const equilateral=parseGeometryInput('triangulo: A=(0,0), B=(2,0), C=(1,1.7320508075688772)');
  assert.equal(equilateral.triangleClass.label,'equilatero acutangulo');
  assert.equal(equilateral.polygons[0].caption,'equilatero acutangulo');

  const obtuse=parseGeometryInput('triangulo: A=(0,0), B=(2,0), C=(1,0.5)');
  assert.equal(obtuse.triangleClass.label,'isosceles obtusangulo');
  assert.ok(obtuse.info.some(line=>line.includes('classificacao: isosceles obtusangulo')));
});

test('geometry builds the minimum convex polygon from unordered points',()=>{
  const hull=parseGeometryInput('convexo: B=(2,0), C=(1,0.5), A=(0,0), E=(0,2), D=(2,2)');
  assert.equal(hull.type,'polygon');
  assert.equal(hull.label,'poligono convexo');
  assert.equal(hull.points.length,5);
  assert.equal(hull.polygons[0].points.length,4);
  assert.equal(hull.segments.length,4);
  assert.equal(hull.angles.length,4);
  assert.deepEqual(hull.polygons[0].points.map(point=>point.label),['A','B','D','E']);
  assert.equal(hull.polygons[0].points.some(point=>point.label==='C'),false);
  assert.ok(hull.info.some(line=>line.includes('5 pontos -> 4 vertices')));
  assert.ok(hull.info.some(line=>line.includes('area = 4')));
});

test('geometry preserves referenced point labels in convex polygons',()=>{
  const registry=new Map();
  const points=parseGeometryInput('ponto: A=(0,0), B=(2,0), C=(2,2), D=(0,2), E=(1,1)',{registry});
  addGeometryDefinitions(registry,points);

  const hull=parseGeometryInput('convexo: C,D,A,B,E',{registry});
  assert.equal(hull.type,'polygon');
  assert.deepEqual(hull.points.map(point=>point.label),['C','D','A','B','E']);
  assert.deepEqual(hull.polygons[0].points.map(point=>point.label),['A','B','C','D']);
  assert.equal(new Set(hull.points.map(point=>point.label)).size,hull.points.length);
});

test('geometry supports named objects across commands',()=>{
  const registry=new Map();
  const a=parseGeometryInput('A = ponto(0,0)',{registry});
  assert.equal(a.type,'point');
  addGeometryDefinitions(registry,a);
  const b=parseGeometryInput('B = ponto(3,4)',{registry});
  addGeometryDefinitions(registry,b);

  const distance=parseGeometryInput('dist: A,B',{registry});
  assert.ok(distance.info.some(line=>line.includes('= 5')));

  const line=parseGeometryInput('r = reta(A,B)',{registry});
  addGeometryDefinitions(registry,line);
  const intersection=parseGeometryInput('intersecao: r; line((0,4),(4,0))',{registry});
  assert.equal(intersection.points.length,1);
  close(intersection.points[0].x,12/7);
  close(intersection.points[0].y,16/7);

  const u=parseGeometryInput('u = vetor(A,B)',{registry});
  addGeometryDefinitions(registry,u);
  const scalar=parseGeometryInput('produto: u; vetor((0,0),(3,0))',{registry});
  assert.ok(scalar.info.some(line=>line.includes('u · v = 9')));
});

test('geometry supports parameters in matrix entries',()=>{
  assert.deepEqual(extractGeometryParams('matriz: [a,b; c,d]'),['a','b','c','d']);
  const matrix=parseGeometryInput('matriz: [a,b; c,d]',{params:{a:1,b:0.5,c:0,d:1}});
  close(matrix.matrix.det,1);
  close(matrix.vectors[1].to.x,0.5);
});

test('unknown commands are ignored and invalid geometry reports errors',()=>{
  assert.equal(parseGeometryInput('fit2: (0,1),(1,2)'),null);
  const bad=parseGeometryInput('reta: (0,0),(0,0)');
  assert.equal(bad.type,'error');
  assert.equal(bad.error.includes('coincidentes'),true);
});

test('conic analysis reports orientation, eccentricity and genus',()=>{
  const hyperbola=parseGeometryInput('conica: (y-3)^2/9 - (x+2)^2/16 = 1');
  assert.ok(hyperbola.info.includes('eixo real vertical'));
  assert.ok(hyperbola.info.includes('semidistancia focal c = 5 (c^2 = a^2 + b^2)'));
  assert.ok(hyperbola.info.includes('excentricidade e = c/a = 1.66667'));
  assert.ok(hyperbola.info.some(line=>line.includes('genero hiperbolico')));

  const ellipse=parseGeometryInput('conica: x^2/9 + y^2/25 = 1');
  assert.ok(ellipse.info.includes('eixo maior vertical'));
  assert.ok(ellipse.info.includes('excentricidade e = c/a = 0.8'));
  assert.ok(ellipse.info.some(line=>line.includes('genero eliptico')));

  const circle=parseGeometryInput('conica: (x-4)^2 + (y+2)^2 = 49');
  assert.ok(circle.info.includes('excentricidade e = 0'));

  const parabola=parseGeometryInput('conica: y^2 = 12x');
  assert.ok(parabola.info.includes('eixo horizontal, abertura para a direita'));
  assert.ok(parabola.info.includes('excentricidade e = 1'));
  assert.ok(parabola.info.includes('b^2 - 4ac = 0 (genero parabolico)'));
});

test('rotated conics are classified by discriminant and degeneracy',()=>{
  const info=text=>parseGeometryInput('conica: '+text).info;
  const hyperbola=info('2x^2 - y^2 - 4x*y - 5x + 4y + 10 = 0');
  assert.equal(hyperbola[0],'conica rotacionada');
  assert.equal(hyperbola[1],'hiperbole');
  assert.ok(hyperbola.includes('b^2 - 4ac = 24 > 0 (genero hiperbolico)'));
  assert.equal(info('x*y = 0')[1],'par de retas concorrentes');
  assert.equal(info('x^2 + x*y + y^2 = 3')[1],'elipse');
  assert.equal(info('x^2 + x*y + y^2 = -3')[1],'conica sem pontos reais');
  assert.equal(info('2x^2 + 2y^2 - 4x*y - 4y + 10 = 0')[1],'parabola');
  assert.ok(info('x*y = 1').includes('rotacao dos eixos = 45°'));
});
