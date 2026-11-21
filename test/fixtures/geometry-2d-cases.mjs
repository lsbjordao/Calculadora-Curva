// 2D geometry lines whose parseGeometryInput results are frozen in
// geometry-2d-snapshot.json (captured before ℝ³ support existed).
// Each case runs in order against one shared registry, like the app does.
import { addGeometryDefinitions, parseGeometryInput } from '../../src/geometry.js';

export const GEOMETRY_2D_CASES=[
  ['ponto: A=(1,2)'],
  ['ponto: A=(0,0), B=(3,4), C=(k,1)',{k:2}],
  ['P = (2,-1)'],
  ['Q = ponto(1,5)'],
  ['G = pontos(A,B,C)'],
  ['vetor: u=(1,2)'],
  ['vetor: (3,4)'],
  ['vetor: A, B'],
  ['w = vetor(A,B)'],
  ['reta: (0,0),(2,4)'],
  ['r = reta(A,B)'],
  ['reta: (0,0),(0,0)'],
  ['dist: (0,0),(3,4)'],
  ['dist: A, B'],
  ['medio: (0,0),(4,2)'],
  ['M = medio(A,B)'],
  ['conica: x^2 + y^2 = 4'],
  ['conica: x^2/9 + y^2/4 = 1'],
  ['conica: x*y = 1'],
  ['matriz: [1,0.5; 0,1]'],
  ['matriz: [a,b; c,d]',{a:2,b:1,c:1,d:2}],
  ['T = [0,-1; 1,0]'],
  ['intersecao: r; line((0,4),(4,0))'],
  ['produto: w; vetor((0,0),(3,0))'],
  ['angulo: (1,0),(0,0),(0,1)'],
  ['triangulo: A=(0,0), B=(4,0), C=(0,3)'],
  ['fit2: (0,1),(1,2)']
];

export function runGeometry2dCases(){
  const registry=new Map();
  return GEOMETRY_2D_CASES.map(([text,params])=>{
    const r=parseGeometryInput(text,{params:params||{},registry});
    if(r&&!r.error) addGeometryDefinitions(registry,r);
    return {text,result:r};
  });
}
