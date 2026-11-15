// Content only: checkpoints consume computed results from the numerical engine.
const equation = (text,params,extra={}) => ({text,params,...extra});
const step = (title,text,prompt,equations,check,focus='Altere os controles e compare o resultado com a interpretação geométrica.') => ({
  title,text,focus,scene:{view:{cx:1,cy:1,scale:65},equations},
  checkpoint:{prompt,success:'Propriedade matemática verificada.',next:'Compare a previsão com o valor calculado e registre sua observação.',check}
});
const computed = (path,value,eq=0) => ({type:'computed-field',eq,path,value,tol:1e-8});
const result = (path,value,eq=0) => computed('algebraResult.'+path,value,eq);
export const ALGEBRA_LESSONS = [
  {id:'algebra-vector-norm',label:'Álgebra: vetores e norma',summary:'Comprimento, direção e vetor nulo.',steps:[
    step('Comprimento no plano','A norma euclidiana é o comprimento do vetor. Arraste B, a extremidade do vetor AB, para mudar comprimento e direção.',
      'Arraste B até uma posição em que a distância AB seja 5.',
      [equation('ponto: A=(0,0), B=(2,0)'),equation('vetor: A,B'),equation('dist: A,B')],
      {type:'geometry-distance',eq:2,value:5,tol:.08}),
    step('Norma calculada','norm([a,b]) calcula o comprimento em qualquer dimensão permitida. A norma do vetor nulo é zero.',
      'Ajuste a e b para obter norma 5; por exemplo, a=3 e b=4.',
      [equation('calc: norm([a,b])',{a:1,b:0})],result('value',5))
  ]},
  {id:'algebra-dot-angle',label:'Álgebra: produto escalar',summary:'Ortogonalidade, ângulo e projeção.',steps:[
    step('Vetores ortogonais','O produto escalar mede alinhamento. Dois vetores não nulos são ortogonais quando seu produto escalar é zero.',
      'Ajuste a até o produto escalar ser zero.',
      [equation('calc: dot([1,0],[a,1])',{a:1}),equation('produto: (0,0),(1,0); (0,0),(0,1)')],result('value',0)),
    step('Ângulo em radianos','angle(u,v) retorna radianos. Um ângulo reto corresponde a π/2. Um vetor nulo não determina um ângulo.',
      'Ajuste a para obter π/2 radianos.',[equation('calc: angle([1,0],[a,1])',{a:1})],result('value',Math.PI/2))
  ]},
  {id:'algebra-composition',label:'Álgebra: multiplicação matricial',summary:'Ordem e composição de transformações.',steps:[
    step('Primeiro B, depois A','Em A B v, B age primeiro. O produto A B combina cisalhamento e escala. A variável @C alimenta a figura e o resultado.',
      'Mude a para que a primeira entrada do produto seja 2.',
      [equation('let C = matmul([[a,0],[0,1]],[[1,1],[0,1]])',{a:1}),equation('matriz: @C')],result('value.0.0',2)),
    step('A ordem importa','Inverter a ordem em geral muda a transformação. Aqui B A escala a primeira coluna, enquanto A B também escala a segunda.',
      'Ajuste a para que a entrada da primeira linha e segunda coluna seja 3.',
      [equation('calc: matmul([[a,0],[0,1]],[[1,1],[0,1]])',{a:1})],result('value.0.1',3))
  ]},
  {id:'algebra-determinant',label:'Álgebra: determinante e área',summary:'Área orientada e inversão de orientação.',steps:[
    step('Escala de área','O determinante indica a área orientada da imagem do quadrado unitário. A animação mostra as matrizes intermediárias.',
      'Ajuste a para obter determinante 3.',[equation('matriz: [a,0; 0,1]',{a:1})],computed('geometry.matrix.det',3)),
    step('Orientação invertida','Um determinante negativo inverte a orientação. A área geométrica é o módulo do determinante.',
      'Ajuste a para obter determinante −2.',[equation('matriz: [a,0; 0,1]',{a:1})],computed('geometry.matrix.det',-2))
  ]},
  {id:'algebra-singular',label:'Álgebra: matriz singular',summary:'Perda de dimensão, posto e invertibilidade.',steps:[
    step('Colapso do plano','Quando as colunas são dependentes, a imagem do quadrado colapsa numa reta e a matriz deixa de ter inversa.',
      'Mude d até o determinante ser zero.',[equation('matriz: [1,2; 1,d]',{d:1})],computed('geometry.matrix.det',0)),
    step('Posto numérico','O posto conta direções independentes. O motor considera a escala da matriz e a precisão de ponto flutuante.',
      'Mude d até o posto da matriz ser 1.',[equation('calc: rank([[1,2],[1,d]])',{d:1})],result('value',1))
  ]},
  {id:'algebra-eigen',label:'Álgebra: autovetores',summary:'Av = λv, direções invariantes e multiplicidades.',steps:[
    step('Direções invariantes','Um autovetor mantém sua direção sob a transformação: Av = λv. λ pode inverter o sentido quando é negativo.',
      'Ajuste a para que o menor autovalor seja −1.',[equation('matriz: [a,0; 0,3]',{a:2})],computed('geometry.matrix.eigen.value.0',-1)),
    step('Autovalor repetido','Um autovalor repetido pode ter apenas uma direção própria independente. Esta matriz não fornece uma base completa de autovetores.',
      'Mude a até os dois autovalores serem 2.',[equation('calc: eiginfo([[a,1],[0,2]])',{a:1})],
      {type:'all',checks:[result('value.0',2),result('value.1',2),{type:'computed-equals',eq:0,path:'algebraResult.metadata.diagonalizable',value:false}]} )
  ]},
  {id:'algebra-systems',label:'Álgebra: sistemas lineares',summary:'Interseções, retas paralelas e coincidentes.',steps:[
    step('Retas sem interseção','As duas linhas do sistema representam retas. Parâmetros mudam seus coeficientes e atualizam o diagnóstico e o gráfico.',
      'Ajuste a para tornar as retas paralelas e o sistema inconsistente.',[equation('calc: solveinfo([[1,1],[1,a]],[2,3])',{a:2},{showAlgebraSystem:true})],
      {type:'computed-equals',eq:0,path:'algebraResult.metadata.classification',value:'inconsistent'}),
    step('Retas coincidentes','Retas coincidentes representam a mesma restrição: existem infinitas soluções. Os postos de A e da matriz aumentada coincidem.',
      'Ajuste b para obter infinitas soluções.',[equation('calc: solveinfo([[1,1],[1,1]],[2,b])',{b:3},{showAlgebraSystem:true})],
      {type:'computed-equals',eq:0,path:'algebraResult.metadata.classification',value:'infinite'})
  ]},
  {id:'algebra-svd',label:'Álgebra: SVD e direções principais',summary:'Rotações, reflexões e escalas em U Σ Vᵀ.',steps:[
    step('Etapas da SVD','Abra a transformação 2D, escolha SVD e use iniciar. Vᵀ muda a base; Σ escala; U orienta a imagem. Fatores ortogonais podem incluir reflexões.',
      'Mova o controle temporal até a metade da transformação.',[equation('calc: svd([[2,1],[0,1]])',{}, {showAlgebraTransform:true})],
      {type:'number-field',eq:0,field:'transformT',min:.45,max:.55}),
    step('Perda de uma direção','Os valores singulares são não negativos e ordenados do maior para o menor. Um valor numericamente nulo indica perda de posto.',
      'Ajuste d para obter posto numérico 1 e observe a imagem colapsar.',[equation('calc: svd([[2,0],[0,d]])',{d:1},{showAlgebraTransform:true})],result('metadata.rank',1))
  ]}
];
