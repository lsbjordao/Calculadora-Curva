"use strict";
// Adapta somente entradas reconhecidas pelo parser da Curva.
// O avaliador é o mesmo da calculadora; nunca executa JavaScript arbitrário.
import {compile,splitTop} from './parser.js';
import {buildMatrixSteps,MATRIX_STEP_OPERATIONS} from './matrix-steps.js';

function sourceOf(eq){
  const raw=String(eq?.text||'').trim();
  const declaration=raw.match(/^let\s+[a-z][a-z0-9]*\s*=\s*(.+)$/is);
  if(declaration)return declaration[1].trim();
  const calc=raw.match(/^calc\s*:\s*(.+)$/is);
  return calc?calc[1].trim():null;
}
function functionCall(source){
  const match=source.match(/^([a-z][a-z0-9_]*)\s*\(([\s\S]*)\)$/i);
  if(!match)return null;
  const operation=match[1].toLowerCase();
  if(!MATRIX_STEP_OPERATIONS.has(operation))return null;
  const args=splitTop(match[2],',').map(value=>value.trim());
  return args.length&&args.every(Boolean)?{operation,args}:null;
}
export function isMatrixWalkthroughCandidate(eq){
  if(!eq||eq.error)return false;
  if(eq.kind==='geometry'&&Array.isArray(eq.geometry?.matrix?.values))return true;
  if(eq.kind!=='result')return false;
  const source=sourceOf(eq);
  if(!source)return false;
  if(functionCall(source))return true;
  // Um literal matricial ou uma variável @M permite explorar suas colunas.
  return Array.isArray(eq.algebraResult?.value)&&Array.isArray(eq.algebraResult.value[0]);
}
export function matrixWalkthroughFromEquation(eq,{resolve=()=>{throw Error('Referência @ não disponível.');},method=null}={}){
  if(!isMatrixWalkthroughCandidate(eq))
    throw Error('Esta camada não contém uma operação matricial compatível com o visor.');
  if(eq.kind==='geometry'){
    return buildMatrixSteps({operation:'matrix',operands:[eq.geometry.matrix.values],method});
  }
  const source=sourceOf(eq);
  const call=functionCall(source);
  const args=call?.args||[source];
  const evaluate=expression=>{
    const fn=compile(expression,eq.params||{}, {},resolve);
    if(typeof fn!=='function')throw Error('Expressão matricial inválida.');
    return fn(0);
  };
  const operands=args.map(evaluate);
  return buildMatrixSteps({operation:call?.operation||'matrix',operands,method});
}
