// Editor visual opcional: a fonte de verdade continua sendo a expressão calc: da Curva.
// Não avalia entradas com eval; as células aceitam somente números reais finitos.
const OPS={
  vectors:[
    ['dot','Produto escalar'],['vadd','Somar u + v'],['vsub','Subtrair u − v'],
    ['cross','Produto vetorial'],['norm','Norma de u'],['unit','Versor de u'],
    ['angle','Ângulo (radianos)'],['proj','Projetar u sobre v']
  ],
  matrices:[
    ['matmul','Produto A B'],['matadd','Somar A + B'],['matsub','Subtrair A − B'],
    ['det','Determinante'],['inv','Inversa'],['transpose','Transposta'],
    ['rank','Posto'],['rrefinfo','Gauss–Jordan: etapas'],['trace','Traço'],
    ['matpow','Potência inteira A^n'],['scale','Multiplicar por escalar'],
    ['eiginfo','Autovalores e autovetores'],['lu','LU'],['qr','QR'],['svd','SVD'],['pinv','Pseudoinversa']
  ],
  systems:[['solveinfo','Analisar e resolver Ax = b'],['linsolve','Solução única'],['rrefinfo','Escalonar [A | b] com etapas']]
};
const unary=new Set(['norm','unit','det','inv','transpose','rank','rrefinfo','trace','eiginfo','lu','qr','svd','pinv','matpow','scale']);
const binary=new Set(['dot','vadd','vsub','cross','angle','proj','matmul','matadd','matsub']);
const productShape=(A,B)=>A[0].length===B.length;
const sameShape=(A,B)=>A.length===B.length&&A[0].length===B[0].length;
function checked(A,name){
  if(!Array.isArray(A)||!A.length||!Array.isArray(A[0])||!A[0].length||A.length>20||A[0].length>20) throw Error(name+': dimensões inválidas.');
  if(A.some(r=>!Array.isArray(r)||r.length!==A[0].length||r.some(x=>!Number.isFinite(Number(x))||String(x).trim()===''))) throw Error(name+': preencha todas as células com números reais.');
  return A.map(r=>r.map(Number));
}
const syntax=A=>'['+A.map(row=>'['+row.map(String).join(',')+']').join(',')+']';
const vectorSyntax=A=>'['+A[0].map(String).join(',')+']';
export function buildWorkbenchCommand(kind,operation,A,B,k=2){
  if(!OPS[kind]?.some(([name])=>name===operation)) throw Error('Operação desconhecida.');
  const a=checked(A,'A'),b=(kind==='systems'||binary.has(operation))?checked(B,'B'):null;
  if(kind==='vectors'){
    if(a.length!==1||(b&&(b.length!==1||a[0].length!==b[0].length))) throw Error('Os vetores precisam ter igual dimensão.');
    if(operation==='cross'&&![2,3].includes(a[0].length)) throw Error('Produto vetorial: somente 2D ou 3D.');
    return 'calc: '+operation+'('+[vectorSyntax(a),...(unary.has(operation)?[]:[vectorSyntax(b)])].join(',')+')';
  }
  if(kind==='systems'){
    if(b.length!==a.length||b[0].length!==1) throw Error('O vetor b deve ter uma entrada por equação.');
    if(operation==='linsolve'&&a.length!==a[0].length) throw Error('linsolve exige matriz quadrada.');
    if(operation==='rrefinfo') return 'calc: rrefinfo('+syntax(a.map((r,i)=>[...r,b[i][0]]))+')';
    return 'calc: '+operation+'('+syntax(a)+','+b.map(r=>r[0]).reduce((s,x,i)=>s+(i?',':'')+x,'[')+'])';
  }
  if(binary.has(operation)){
    if(operation==='matmul'&&!productShape(a,b)) throw Error('No produto AB, colunas de A = linhas de B.');
    if((operation==='matadd'||operation==='matsub')&&!sameShape(a,b)) throw Error('A e B precisam ter mesmas dimensões.');
  }
  if(['det','inv','trace','eiginfo','matpow','lu'].includes(operation)&&a.length!==a[0].length) throw Error('A operação exige matriz quadrada.');
  if(operation==='eiginfo'&&![2,3].includes(a.length)) throw Error('Autovalores: 2×2 real ou 3×3 simétrica.');
  if(operation==='matpow'&&(!Number.isInteger(Number(k))||Math.abs(Number(k))>100)) throw Error('Expoente inteiro entre -100 e 100.');
  if(operation==='qr'&&a.length<a[0].length) throw Error('QR: número de linhas deve ser ≥ colunas.');
  if(operation==='matpow'||operation==='scale'){
    if(!Number.isFinite(Number(k))||String(k).trim()==='') throw Error('Escalar inválido.');
    return 'calc: '+operation+'('+(operation==='scale'?String(Number(k))+','+syntax(a):syntax(a)+','+String(Number(k)))+')';
  }
  return 'calc: '+operation+'('+[syntax(a),...(binary.has(operation)?[syntax(b)]:[])].join(',')+')';
}
const matrix=(m,n,defaultValue=0)=>Array.from({length:m},(_,i)=>Array.from({length:n},(_,j)=>defaultValue===1&&i===j?1:defaultValue));
const resize=(A,m,n)=>Array.from({length:m},(_,i)=>Array.from({length:n},(_,j)=>A[i]?.[j]??0));
const node=(tag,cls,txt)=>{
  const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;
};
function select(label,options,value,change){
  const wrapper=node('label','workbench-selector');
  wrapper.append(node('span','',label));
  const el=node('select');for(const [key,caption]of options){const opt=node('option','',caption);opt.value=key;el.append(opt);}
  el.value=String(value);el.onchange=()=>change(el.value);wrapper.append(el);return wrapper;
}
const dimOptions=Array.from({length:12},(_,i)=>[String(i+1),String(i+1)]);
export function initAlgebraWorkbench({insert}){
  const trigger=document.getElementById('algebra-workbench-open');
  if(!trigger)return;
  const dialog=node('dialog','algebra-workbench');
  dialog.setAttribute('aria-label','Editor visual de álgebra linear');
  const state={
    kind:'matrices',op:'matmul',a:[[2,1],[1,3]],b:[[1,2],[3,4]],
    vecA:[[3,4,0]],vecB:[[2,1,0]],sysA:[[2,1,0],[1,3,0],[0,0,1]],sysB:[[5],[7],[1]],k:2
  };
  const header=node('div','workbench-head');
  header.append(node('h2','', 'Editor visual de GAAL'));
  const close=node('button','workbench-close','×');close.type='button';close.title='Fechar editor';close.setAttribute('aria-label','Fechar editor');close.onclick=()=>dialog.close();header.append(close);
  const area=node('div','workbench-body'),foot=node('div','workbench-footer'),preview=node('code','workbench-preview'),error=node('p','workbench-error');
  const add=node('button','workbench-add','Inserir na Curva');add.type='button';
  const dismiss=node('button','workbench-cancel','Cancelar');dismiss.type='button';dismiss.onclick=()=>dialog.close();
  foot.append(preview,error,add,dismiss);dialog.append(header,area,foot);document.body.append(dialog);
  const sources=()=>state.kind==='vectors'?['vecA','vecB']:state.kind==='systems'?['sysA','sysB']:['a','b'];
  function updatePreview(){
    const [left,right]=sources();
    try{const command=buildWorkbenchCommand(state.kind,state.op,state[left],state[right],state.k);
      preview.textContent=command;error.textContent='';add.disabled=false;return command;
    }catch(e){preview.textContent='';error.textContent=e.message;add.disabled=true;return null;}
  }
  function grid(title,key){
    const values=state[key],block=node('div','workbench-matrix'),heading=node('h3','',title);
    block.append(heading);
    const controls=node('div','workbench-dimensions');
    const isVector=state.kind==='vectors',isB=key==='sysB';
    if(!isVector&&!isB)controls.append(select('Linhas',dimOptions,values.length,v=>{
      const n=Number(v);state[key]=resize(values,n,values[0].length);
      if(state.kind==='systems'&&key==='sysA')state.sysB=resize(state.sysB,n,1);
      render();
    }));
    if(!isB)controls.append(select(isVector?'Componentes':'Colunas',dimOptions,values[0].length,v=>{
      state[key]=resize(values,values.length,Number(v));
      if(isVector){const peer=key==='vecA'?'vecB':'vecA';state[peer]=resize(state[peer],1,Number(v));}
      render();
    }));
    if(controls.children.length)block.append(controls);
    const cells=node('div','workbench-cells');
    cells.style.gridTemplateColumns='repeat('+values[0].length+',minmax(52px,1fr))';
    values.forEach((row,i)=>row.forEach((v,j)=>{
      const input=node('input');input.type='number';input.step='any';input.value=String(v);
      input.setAttribute('aria-label',title+' linha '+(i+1)+' coluna '+(j+1));
      input.addEventListener('input',()=>{state[key][i][j]=input.value;updatePreview();});
      cells.append(input);
    }));
    block.append(cells);return block;
  }
  function render(){
    area.replaceChildren();
    area.append(select('Tipo',[['vectors','Vetores'],['matrices','Matrizes'],['systems','Sistemas Ax = b']],state.kind,kind=>{
      state.kind=kind;state.op=OPS[kind][0][0];render();
    }));
    area.append(select('Operação',OPS[state.kind],state.op,v=>{state.op=v;render();}));
    const [a,b]=sources();
    area.append(grid(state.kind==='vectors'?'Vetor u':state.kind==='systems'?'Coeficientes A':'Matriz A',a));
    if(!unary.has(state.op))area.append(grid(state.kind==='vectors'?'Vetor v':state.kind==='systems'?'Termos independentes b':'Matriz B',b));
    if(state.op==='matpow'||state.op==='scale'){
      const label=node('label','workbench-selector');label.append(node('span','',state.op==='matpow'?'Expoente inteiro':'Escalar'));
      const field=node('input');field.type='number';field.step=state.op==='matpow'?'1':'any';field.value=String(state.k);
      field.addEventListener('input',()=>{state.k=field.value;updatePreview();});label.append(field);area.append(label);
    }
    const hint=node('p','workbench-hint',state.kind==='systems'?'Com três incógnitas, a Curva pode exibir os planos no gráfico 3D.':'O comando gerado é editável na linha da Curva.');
    area.append(hint);updatePreview();
  }
  add.onclick=()=>{const cmd=updatePreview();if(!cmd)return;insert(cmd);dialog.close();};
  trigger.onclick=()=>{render();dialog.showModal();};
  dialog.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();add.click();}});
  return {open:()=>{render();dialog.showModal();}};
}
