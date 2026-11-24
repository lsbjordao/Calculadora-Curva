"use strict";
// Inspetor contextual: modelo matemático separado da UI, com seleção múltipla.
const fmt=n=>Number.isFinite(n)?Number(n.toPrecision(7)).toString():String(n);
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const length=v=>Math.hypot(...v);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

export function compareSelectedPlanes(a,b){
  const plane=eq=>(eq?.geometry?.scene3d||[])
    .find(item=>item.kind==='plane'&&item.role==='main');
  const u=plane(a),v=plane(b);
  if(!u||!v)return null;
  const n1=u.n,n2=v.n,s1=length(n1),s2=length(n2);
  if(!(s1>1e-12&&s2>1e-12))return null;
  const cosine=Math.max(-1,Math.min(1,Math.abs(dot(n1,n2)/(s1*s2))));
  const angle=Math.acos(cosine)*180/Math.PI;
  const parallel=length(cross(n1,n2))/(s1*s2)<1e-9;
  // O sinal normal é irrelevante: alinhar ambas as normais para medir distância.
  const sign=dot(n1,n2)<0?-1:1;
  const separation=Math.abs(u.d/s1-sign*v.d/s2);
  return {kind:'planes',angle,parallel,coincident:parallel&&separation<1e-8,
    separation:parallel?separation:null,
    lines:['Ângulo agudo entre planos: '+fmt(angle)+'°',
      parallel?(separation<1e-8?'Planos coincidentes':'Planos paralelos distintos'):
        'Planos secantes',
      ...(parallel?['Distância entre planos: '+fmt(separation)]:[])]};
}
export function inspectEquation(eq){
  if(!eq)return null;
  const geometry=eq.geometry;
  const title=eq.name||geometry?.label||eq.text||'Objeto';
  const lines=[];
  if(eq.error)lines.push('A expressão tem um erro de validação.');
  else if(geometry?.info?.length)lines.push(...geometry.info.map(String));
  else if(eq.algebraResult?.value!==undefined)
    lines.push('Resultado: '+JSON.stringify(eq.algebraResult.value));
  else if(eq.kind==='function')lines.push('Função: '+eq.text);
  else lines.push('Expressão: '+eq.text);
  const actions=[];
  if(geometry?.multivar?.calc){
    const {point:p,gradient:g}=geometry.multivar.calc;
    const rhs=fmt(p[2])+' + ('+fmt(g[0])+')*(x-('+fmt(p[0])+')) + ('+
      fmt(g[1])+')*(y-('+fmt(p[1])+'))';
    actions.push({label:'Adicionar plano tangente',command:'plano: z = '+rhs});
  }
  if(geometry?.generalQuadric||geometry?.implicitSurface)
    actions.push({label:'Adicionar plano z = 0',command:'plano: z = 0'});
  return {title,lines,actions,kind:eq.kind,expression:eq.text};
}
export function createMathInspector({panel,toggle,getEquations=()=>[],onInsert=()=>{}}={}){
  if(!panel||!toggle)return {select:()=>{},render:()=>{},has:()=>false};
  let ids=[],opened=false;
  const body=panel.querySelector('#math-inspector-body');
  const title=panel.querySelector('#math-inspector-title');
  const addLine=(value,kind='detail')=>{
    if(!body)return;
    const p=document.createElement('p');p.className='math-inspector-'+kind;
    p.textContent=String(value);body.appendChild(p);
  };
  const clear=()=>{
    if(body)body.textContent='';
  };
  function render(){
    panel.hidden=!opened;
    toggle.setAttribute('aria-pressed',opened?'true':'false');
    if(!opened)return;
    clear();
    const selected=ids.map(id=>getEquations().find(eq=>eq.id===id)).filter(Boolean);
    if(!selected.length){
      title.textContent='Inspetor matemático';
      addLine('Selecione uma camada, ou clique em um ponto da superfície 3D. Use Shift + clique para comparar dois planos.','hint');
      return;
    }
    title.textContent=selected.length===2?'Comparar objetos':'Inspetor matemático';
    for(const eq of selected){
      const info=inspectEquation(eq);
      addLine(info.title,'title');
      for(const line of info.lines)addLine(line);
      if(selected.length===1){
        for(const action of info.actions){
          const button=document.createElement('button');
          button.type='button';button.className='math-inspector-action';
          button.textContent=action.label;
          button.addEventListener('click',()=>onInsert(action.command));
          body.appendChild(button);
        }
      }
    }
    if(selected.length===2){
      const relation=compareSelectedPlanes(selected[0],selected[1]);
      addLine('Relação geométrica','title');
      if(relation)relation.lines.forEach(line=>addLine(line));
      else addLine('Comparação analítica disponível para dois planos.','hint');
    }
  }
  toggle.addEventListener('click',()=>{opened=!opened;render();});
  const close=panel.querySelector('#math-inspector-close');
  close?.addEventListener('click',()=>{opened=false;render();});
  function select(eq,append=false){
    if(!eq)return;
    if(append){
      ids=ids.includes(eq.id)?ids.filter(id=>id!==eq.id):[...ids.slice(-1),eq.id];
    }else ids=[eq.id];
    // O painel só se abre por uma ação explícita no botão "inspecionar".
    // Selecionar camadas não invade a visualização 3D.
    render();
  }
  render();
  return {select,render,has:id=>ids.includes(id),isOpen:()=>opened};
}
