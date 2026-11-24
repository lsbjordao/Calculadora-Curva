"use strict";
// Modelo didático puro: estados matemáticos completos para um visor navegável.
// Não substitui o motor numérico da Curva; os números são recalculados a
// partir das entradas, sem eval e sem mutação das matrizes originais.
import {det, matmul, inv, validateMatrix} from './linear-algebra.js';

const copy=A=>A.map(row=>[...row]);
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const num=x=>Object.is(x,-0)||Math.abs(x)<1e-13?'0':String(Number(x.toPrecision(7)));
const dims=A=>[A.length,A[0].length];
const identity=n=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>+(i===j)));
const zeros=(m,n)=>Array.from({length:m},()=>Array(n).fill(0));
const matrix=(label,values,other={})=>({label,values:copy(values),...other});
const scalar=(value,label='Resultado')=>({label,scalar:value});
const stage=(title,description,formula,matrices,other={})=>({title,description,formula,matrices,...other});
const rawScale=A=>Math.max(0,...A.flat().map(Math.abs));
const matrixLimit=10;
function checked(A,name='A'){
  validateMatrix(A,name);
  if(A.length>matrixLimit||A[0].length>matrixLimit)
    throw new Error('O visor didático mostra até '+matrixLimit+' linhas e colunas. O cálculo original continua disponível.');
  return copy(A);
}
function square(A){
  if(A.length!==A[0].length)throw new Error('A matriz precisa ser quadrada.');
}
const label=(row,col)=>'a'+(row+1)+(col+1);
function answer(model,steps,result){
  return {title:model.title,methods:model.methods||[],method:model.method||null,
    operation:model.operation,stages:steps,result};
}
function explainColumns(A){
  const [m,n]=dims(A),steps=[
    stage('Matriz como transformação linear',
      'Cada coluna mostra a imagem de um vetor da base canônica: A eⱼ é a coluna j.',
      'A eⱼ = coluna j de A',[matrix('A',A)])];
  for(let j=0;j<n;j++){
    const col=A.map(row=>row[j]);
    steps.push(stage('Imagem do vetor e'+(j+1),
      'Observe as entradas destacadas: elas formam a '+(j+1)+'ª coluna da transformação.',
      'A e'+(j+1)+' = ('+col.map(num).join(', ')+')',
      [matrix('A',A,{focusCol:j})]));
  }
  if(m===n){
    const d=det(A);
    steps.push(stage(n===2?'Área orientada':'Determinante e volume orientado',
      n===2?'A área do paralelogramo é |det A|.':
        n===3?'O volume do paralelepípedo é |det A|.':
          'O fator de volume em dimensão '+n+' é |det A|.',
      'det A = '+num(d)+'; medida geométrica = '+num(Math.abs(d)),
      [matrix('A',A),scalar(d,'det A')]));
  }
  return answer({title:'Matriz: imagens da base',operation:'matrix'},steps,A);
}
function determinantTwo(A){
  const [a,b]=A[0],[c,d]=A[1];
  const out=[
    stage('Determinante 2×2','Identifique a diagonal principal, cujo produto é ad.',
      'a₁₁a₂₂ = '+num(a)+' × '+num(d)+' = '+num(a*d),
      [matrix('A',A,{focusCells:[[0,0],[1,1]]})]),
    stage('Diagonal secundária','O segundo produto é bc e deve ser subtraído.',
      'a₁₂a₂₁ = '+num(b)+' × '+num(c)+' = '+num(b*c),
      [matrix('A',A,{focusCells:[[0,1],[1,0]]})]),
    stage('Área orientada','Subtraia o segundo produto do primeiro.',
      'det A = ('+num(a*d)+') − ('+num(b*c)+') = '+num(det(A)),
      [matrix('A',A),scalar(det(A),'det A')])
  ];
  return out;
}
function determinantSarrus(A){
  const pos=[],neg=[],steps=[
    stage('Regra de Sarrus (somente 3×3)',
      'Existem três produtos de diagonais descendentes e três ascendentes. Os descendentes são somados; os ascendentes, subtraídos.',
      'det A = soma(descendentes) − soma(ascendentes)',
      [matrix('A',A)])];
  for(const [group,positive] of [[pos,true],[neg,false]]){
    for(let start=0;start<3;start++){
      const coords=Array.from({length:3},(_,r)=>[r,(start+(positive?r:-r)+3)%3]);
      const factors=coords.map(([r,c])=>A[r][c]);
      const product=factors.reduce((acc,x)=>acc*x,1);
      group.push(product);
      steps.push(stage((positive?'Diagonal descendente ':'Diagonal ascendente ')+(start+1)+'/3',
        'Os três valores destacados são multiplicados. '+(positive?'O produto será somado.':'O produto será subtraído.'),
        factors.map(num).join(' × ')+' = '+num(product),
        [matrix('A',A,{focusCells:coords})]));
    }
  }
  const plus=pos.reduce((a,b)=>a+b,0),minus=neg.reduce((a,b)=>a+b,0);
  steps.push(stage('Somar as três diagonais descendentes','Os produtos podem ser negativos.',
    pos.map(x=>'('+num(x)+')').join(' + ')+' = '+num(plus),
    [matrix('A',A)]));
  steps.push(stage('Somar as três diagonais ascendentes','A segunda soma entra com sinal negativo no determinante.',
    neg.map(x=>'('+num(x)+')').join(' + ')+' = '+num(minus),
    [matrix('A',A)]));
  steps.push(stage('Determinante por Sarrus','Este valor indica o volume orientado. Seu módulo é o volume geométrico.',
    'det A = '+num(plus)+' − ('+num(minus)+') = '+num(det(A)),
    [matrix('A',A),scalar(det(A),'det A')]));
  return steps;
}
function determinantCofactors(A){
  const steps=[stage('Expansão de Laplace pela primeira linha',
    'Os sinais alternam +, −, +. Cada menor é uma matriz 2×2 obtida excluindo a primeira linha e a coluna escolhida.',
    'det A = a₁₁M₁₁ − a₁₂M₁₂ + a₁₃M₁₃',[matrix('A',A)])];
  const terms=[];
  for(let j=0;j<3;j++){
    const minor=A.slice(1).map(row=>row.filter((_,k)=>k!==j));
    const minorDet=det(minor),sign=j%2?-1:1,term=sign*A[0][j]*minorDet;
    terms.push(term);
    steps.push(stage('Cofator da coluna '+(j+1),
      'Exclua linha 1 e coluna '+(j+1)+'. O sinal desse cofator é '+(sign<0?'negativo':'positivo')+'.',
      (sign<0?'− ':'+ ')+num(A[0][j])+' × det(M₁'+(j+1)+') = '+
        (sign<0?'− ':'')+num(A[0][j])+' × '+num(minorDet)+' = '+num(term),
      [matrix('A',A,{focusRow:0,focusCol:j,focusCells:[[0,j]]}),
        matrix('Menor M₁'+(j+1),minor),scalar(term,'Parcela')]));
  }
  steps.push(stage('Somar os cofatores','O resultado deve coincidir com Sarrus e a eliminação.',
    terms.map(x=>'('+num(x)+')').join(' + ')+' = '+num(det(A)),
    [matrix('A',A),scalar(det(A),'det A')]));
  return steps;
}
function elimination(A,{reduced=false,augmentedAt=null,trackDet=false}={}){
  const U=copy(A),[m,n]=dims(U),end=augmentedAt??n,steps=[];
  let pivotRow=0,swaps=0;
  const base=()=>[matrix(augmentedAt===null?'Matriz em transformação':'Matriz aumentada',U,
    augmentedAt===null?{}:{augmentedAt})];
  steps.push(stage(trackDet?'Determinante por eliminação':'Escalonamento de Gauss–Jordan',
    trackDet?'Trocas de linhas alteram o sinal do determinante. Somar múltiplos de linhas não altera seu valor.':
      'Escolha pivôs, normalize as linhas e elimine as demais entradas das colunas de pivô.',
    trackDet?'det A = (−1)^(trocas) × produto dos pivôs da triangular':
      'Uma operação elementar é executada por etapa.',base()));
  // Uma coluna aumentada (I ou b) não define a escala dos pivôs de A:
  // uma matriz como 1e-200 I é inversível, embora [A | I] contenha 1.
  const coefficientScale=rawScale(augmentedAt===null?U:
    U.map(row=>row.slice(0,augmentedAt)));
  const threshold=coefficientScale*1e-12;
  for(let col=0;col<end&&pivotRow<m;col++){
    let best=pivotRow;
    for(let r=pivotRow+1;r<m;r++)if(Math.abs(U[r][col])>Math.abs(U[best][col]))best=r;
    if(!(Math.abs(U[best][col])>threshold)){
      steps.push(stage('Coluna '+(col+1)+' sem pivô',
        'Nenhuma entrada acima da tolerância relativa disponível. A coluna é livre na eliminação.',
        'Sem pivô na coluna '+(col+1),base(),{focusCol:col}));
      continue;
    }
    if(best!==pivotRow){
      [U[best],U[pivotRow]]=[U[pivotRow],U[best]];
      swaps++;
      steps.push(stage('Trocar linhas '+(pivotRow+1)+' e '+(best+1),
        trackDet?'Cada troca de linhas inverte o sinal do determinante.':'Escolha a entrada de maior módulo para reduzir instabilidade numérica.',
        'L'+(pivotRow+1)+' ↔ L'+(best+1),[
          matrix('Matriz após a troca',U,{focusRows:[pivotRow,best],augmentedAt})]));
    }
    const pivot=U[pivotRow][col];
    if(!trackDet){
      for(let j=col;j<n;j++)U[pivotRow][j]/=pivot;
      steps.push(stage('Normalizar pivô na coluna '+(col+1),
        'Divida toda a linha pelo valor do pivô para obter 1.',
        'L'+(pivotRow+1)+' ← L'+(pivotRow+1)+' / ('+num(pivot)+')',
        [matrix('Pivô unitário',U,{focusRow:pivotRow,focusCells:[[pivotRow,col]],augmentedAt})]));
    }else{
      steps.push(stage('Selecionar pivô '+(pivotRow+1),
        'A eliminação preserva este valor de pivô para o produto diagonal.',
        'Pivô = '+num(pivot),
        [matrix('Pivô',U,{focusCells:[[pivotRow,col]],augmentedAt})]));
    }
    for(let r=trackDet?pivotRow+1:0;r<m;r++){
      if(r===pivotRow)continue;
      const factor=trackDet?U[r][col]/pivot:U[r][col];
      if(Math.abs(factor)<=1e-14)continue;
      for(let j=col;j<n;j++)U[r][j]-=factor*U[pivotRow][j];
      U[r][col]=0;
      steps.push(stage('Eliminar entrada na linha '+(r+1),
        'Subtrair um múltiplo da linha do pivô elimina a entrada destacada.',
        'L'+(r+1)+' ← L'+(r+1)+' − ('+num(factor)+') L'+(pivotRow+1),
        [matrix('Matriz após operação',U,{focusRows:[pivotRow,r],
          focusCells:[[r,col]],augmentedAt})]));
    }
    pivotRow++;
  }
  if(trackDet){
    const diagonal=Array.from({length:Math.min(m,n)},(_,i)=>U[i][i]);
    const diagonalProduct=diagonal.reduce((a,b)=>a*b,1);
    const signed=(swaps%2?-1:1)*diagonalProduct;
    steps.push(stage('Produto da diagonal e sinal',
      'A matriz resultante é triangular. O produto dos valores diagonais, corrigido pelo número de trocas, fornece o determinante.',
      'det A ≈ (−1)^'+swaps+' × ('+diagonal.map(num).join(' × ')+') = '+num(signed),
      [matrix('Triangular superior',U),scalar(det(A),'det A (motor Curva)')]));
  }
  return {steps,U,rank:pivotRow,swaps};
}
function determinant(A,method){
  checked(A);square(A);
  const n=A.length;
  const available=n===3?['Sarrus','Cofatores','Eliminação']:n===2?['Diagonais','Eliminação']:['Eliminação'];
  const choice=available.includes(method)?method:available[0];
  const stages=n===2&&choice==='Diagonais'?determinantTwo(A):
    n===3&&choice==='Sarrus'?determinantSarrus(A):
      n===3&&choice==='Cofatores'?determinantCofactors(A):
        elimination(A,{trackDet:true}).steps;
  return answer({title:'Determinante '+n+'×'+n,operation:'det',methods:available,method:choice},stages,det(A));
}
function multiplication(A,B){
  if(A[0].length!==B.length)throw Error('Produto AB: colunas de A devem igualar linhas de B.');
  const m=A.length,n=B[0].length,k=B.length,C=zeros(m,n),steps=[];
  const cards=(focus={})=>[
    matrix('A · '+A.length+'×'+A[0].length,A,focus.row===undefined?{}:{focusRow:focus.row}),
    matrix('B · '+B.length+'×'+B[0].length,B,focus.col===undefined?{}:{focusCol:focus.col}),
    matrix('C = AB · construção',C,focus.target?{focusCells:[focus.target]}:{})];
  steps.push(stage('Regra linha × coluna',
    'O elemento cᵢⱼ é o produto escalar da linha i de A com a coluna j de B. O visor preencherá C um elemento por vez.',
    'cᵢⱼ = Σₖ aᵢₖbₖⱼ',cards()));
  for(let i=0;i<m;i++)for(let j=0;j<n;j++){
    const terms=Array.from({length:k},(_,p)=>A[i][p]*B[p][j]);
    const value=terms.reduce((a,b)=>a+b,0);
    C[i][j]=value;
    const substituted=Array.from({length:k},(_,p)=>
      '('+num(A[i][p])+' × '+num(B[p][j])+')').join(' + ');
    steps.push(stage('Calcular c'+(i+1)+(j+1),
      'Linha '+(i+1)+' de A (azul), coluna '+(j+1)+' de B (âmbar), célula de saída em verde.',
      'c'+(i+1)+(j+1)+' = '+substituted+' = '+num(value),
      cards({row:i,col:j,target:[i,j]})));
  }
  steps.push(stage('Produto matricial concluído',
    'A ordem importa: AB geralmente é diferente de BA. Compare as dimensões e as células calculadas.',
    'C = A × B',cards()));
  return answer({title:'Multiplicação matricial',operation:'matmul'},steps,matmul(A,B));
}
function inverseSteps(A){
  square(A);
  const n=A.length,aug=A.map((row,i)=>[...row,...identity(n)[i]]);
  const {steps,U,rank}=elimination(aug,{augmentedAt:n});
  if(rank<n){
    steps.push(stage('Matriz singular','Há uma coluna sem pivô independente. Não existe inversa.',
      'det A = 0; A⁻¹ não existe',[matrix('[A | I]',U,{augmentedAt:n})]));
    return answer({title:'Inversa por Gauss–Jordan',operation:'inv'},steps,null);
  }
  const inverted=U.map(row=>row.slice(n));
  steps.push(stage('A esquerda tornou-se identidade',
    'A metade direita da matriz aumentada contém a inversa.',
    '[A | I] → [I | A⁻¹]',
    [matrix('[I | A⁻¹]',U,{augmentedAt:n}),matrix('A⁻¹',inverted)]));
  return answer({title:'Inversa por Gauss–Jordan',operation:'inv'},steps,inv(A));
}
function systemSteps(A,b,operation){
  const rhs=Array.isArray(b[0])?b.map(row=>row[0]):b;
  if(rhs.length!==A.length||rhs.some(x=>!finite(x)))throw Error('b deve ter uma entrada finita por linha de A.');
  const aug=A.map((row,i)=>[...row,rhs[i]]);
  const info=elimination(aug,{augmentedAt:A[0].length}),steps=info.steps;
  const rankA=info.U.filter(row=>row.slice(0,A[0].length).some(x=>Math.abs(x)>1e-9)).length;
  const inconsistent=info.U.some(row=>row.slice(0,A[0].length).every(x=>Math.abs(x)<1e-9)&&Math.abs(row.at(-1))>1e-9);
  const verdict=inconsistent?'Sistema inconsistente: alguma linha equivale a 0 = valor não nulo.':
    rankA<A[0].length?'Sistema com variáveis livres e infinitas soluções.':
      'Sistema com solução única.';
  steps.push(stage('Interpretar o sistema escalonado',verdict,
    'posto(A) = '+rankA+'; incógnitas = '+A[0].length,
    [matrix('[A | b] escalonada',info.U,{augmentedAt:A[0].length})]));
  return answer({title:'Sistema linear: operações por linha',operation},steps,info.U);
}
function simpleMatrix(A,B,operation,k=1){
  const [m,n]=dims(A),C=zeros(m,n),steps=[];
  if(operation==='transpose'){
    const output=zeros(n,m);
    steps.push(stage('Trocar linhas por colunas','A transposta tem dimensões '+n+'×'+m,
      '(Aᵀ)ⱼᵢ = Aᵢⱼ',[matrix('A',A),matrix('Aᵀ',output)]));
    for(let i=0;i<m;i++)for(let j=0;j<n;j++){
      output[j][i]=A[i][j];
      steps.push(stage('Mover elemento a'+(i+1)+(j+1),
        'O elemento em linha '+(i+1)+', coluna '+(j+1)+' vai para linha '+(j+1)+', coluna '+(i+1)+'.',
        'a'+(i+1)+(j+1)+' → (Aᵀ)'+(j+1)+(i+1),
        [matrix('A',A,{focusCells:[[i,j]]}),matrix('Aᵀ',output,{focusCells:[[j,i]]})]));
    }
    return answer({title:'Transposição de matriz',operation},steps,output);
  }
  if(operation==='trace'){
    square(A);
    let sum=0;
    steps.push(stage('Traço da matriz','Some somente a diagonal principal.','tr(A) = Σᵢ aᵢᵢ',[matrix('A',A)]));
    for(let i=0;i<m;i++){
      sum+=A[i][i];
      steps.push(stage('Somar elemento diagonal '+(i+1),'A soma parcial é atualizada.',
        'tr parcial = '+num(sum),
        [matrix('A',A,{focusCells:[[i,i]]}),scalar(sum,'Soma parcial')]));
    }
    return answer({title:'Traço da matriz',operation},steps,sum);
  }
  if(!['matadd','matsub','scale'].includes(operation))throw Error('Operação didática ainda não suportada.');
  if(operation!=='scale'&&(B.length!==m||B[0].length!==n))throw Error('Soma/subtração exigem matrizes de dimensões iguais.');
  const opSign=operation==='matadd'?'+':operation==='matsub'?'−':'×';
  const second=operation==='scale'?null:B;
  const cards=(focus=null)=>[matrix('A',A,focus?{focusCells:[focus]}:{}),
    ...(second?[matrix('B',second,focus?{focusCells:[focus]}:{})]:[]),
    matrix('Resultado parcial',C,focus?{focusCells:[focus]}:{})];
  steps.push(stage('Operação elemento a elemento','A saída é construída uma posição de cada vez.',
    operation==='scale'?'C = '+num(k)+'A':'C = A '+opSign+' B',cards()));
  for(let i=0;i<m;i++)for(let j=0;j<n;j++){
    const a=A[i][j],b=operation==='scale'?k:B[i][j];
    C[i][j]=operation==='matadd'?a+b:operation==='matsub'?a-b:a*b;
    steps.push(stage('Calcular posição ('+(i+1)+','+(j+1)+')','Os valores destacados correspondem à mesma posição.',
      num(a)+' '+opSign+' '+num(b)+' = '+num(C[i][j]),cards([i,j])));
  }
  return answer({title:'Operação matricial: '+opSign,operation},steps,C);
}
export function buildMatrixSteps({operation,operands=[],method=null}={}){
  if(!operands.length)throw Error('Nenhuma matriz disponível para explicar.');
  const op=String(operation||'matrix').toLowerCase();
  if(op==='scale'){
    const k=operands[0],A=checked(operands[1]);
    if(!finite(k))throw Error('O escalar deve ser finito.');
    return simpleMatrix(A,null,op,k);
  }
  const A=checked(operands[0]);
  if(op==='matrix'||op==='matrixinfo')return explainColumns(A);
  if(op==='det')return determinant(A,method);
  if(op==='matmul')return multiplication(A,checked(operands[1],'B'));
  if(op==='inv')return inverseSteps(A);
  if(op==='rref'||op==='rrefinfo'){
    const info=elimination(A);
    info.steps.push(stage('Matriz reduzida obtida','Os pivôs são 1 e as outras entradas de suas colunas são 0.',
      'Forma escalonada reduzida por linhas',[matrix('RREF',info.U)]));
    return answer({title:'Gauss–Jordan: escalonamento',operation:op},info.steps,info.U);
  }
  if(op==='linsolve'||op==='solveinfo')return systemSteps(A,operands[1],op);
  if(op==='transpose'||op==='trace'||op==='matadd'||op==='matsub')
    return simpleMatrix(A,op==='matadd'||op==='matsub'?checked(operands[1],'B'):null,op);
  throw Error('Ainda não há roteiro visual para '+op+'.');
}
export const MATRIX_STEP_OPERATIONS=new Set(['det','matmul','inv','rref','rrefinfo',
  'solveinfo','linsolve','matadd','matsub','transpose','trace','scale','matrix','matrixinfo']);
