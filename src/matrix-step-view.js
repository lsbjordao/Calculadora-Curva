"use strict";
import {formatAlgebraNumber} from './algebra-ui.js';

// Visor no espaço do gráfico: não interfere no motor geométrico 3D já ativo.
const node=(tag,cls,text)=>{
  const result=document.createElement(tag);
  if(cls)result.className=cls;
  if(text!==undefined)result.textContent=text;
  return result;
};
function renderMatrixCard(source){
  const card=node('section','matrix-step-card');
  const heading=node('strong','matrix-step-card-title',source.label);
  card.appendChild(heading);
  if(Object.hasOwn(source,'scalar')){
    card.appendChild(node('output','matrix-step-scalar',formatAlgebraNumber(source.scalar)));
    return card;
  }
  const outer=node('div','matrix-step-grid-scroll');
  outer.tabIndex=0;outer.setAttribute('role','region');
  outer.setAttribute('aria-label',source.label+': '+source.values.length+' linhas por '+source.values[0].length+' colunas');
  const table=node('table','matrix-step-table'),tbody=node('tbody');
  source.values.forEach((row,i)=>{
    const tr=node('tr');
    row.forEach((value,j)=>{
      const td=node('td','',formatAlgebraNumber(value));
      const active=source.focusCells?.some(([r,c])=>i===r&&j===c);
      const focusRow=source.focusRow===i||source.focusRows?.includes(i);
      const focusCol=source.focusCol===j;
      if(active)td.dataset.focus='pivot';
      else if(focusRow&&focusCol)td.dataset.focus='intersection';
      else if(focusRow)td.dataset.focus='row';
      else if(focusCol)td.dataset.focus='column';
      if(source.augmentedAt===j)td.dataset.augmented='1';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);outer.appendChild(table);card.appendChild(outer);
  return card;
}
export function createMatrixWalkthrough({panel,getModel,onVisibility=()=>{},onChange=()=>{}}={}){
  if(!panel)return {open:()=>{},refresh:()=>{},close:()=>{}};
  const title=panel.querySelector('#matrix-step-title');
  const caption=panel.querySelector('#matrix-step-caption');
  const formula=panel.querySelector('#matrix-step-formula');
  const text=panel.querySelector('#matrix-step-text');
  const cards=panel.querySelector('#matrix-step-cards');
  const progress=panel.querySelector('#matrix-step-progress');
  const indexText=panel.querySelector('#matrix-step-count');
  const prev=panel.querySelector('#matrix-step-prev');
  const next=panel.querySelector('#matrix-step-next');
  const first=panel.querySelector('#matrix-step-first');
  const last=panel.querySelector('#matrix-step-last');
  const play=panel.querySelector('#matrix-step-play');
  const method=panel.querySelector('#matrix-step-method');
  const closeBtn=panel.querySelector('#matrix-step-close');
  const status=panel.querySelector('#matrix-step-status');
  let eq=null,model=null,position=0,interval=null,currentMethod=null;
  const stop=()=>{
    if(interval!==null){clearInterval(interval);interval=null;}
    if(play){play.textContent='▶ Reproduzir';play.setAttribute('aria-pressed','false');}
  };
  function visible(shouldShow){
    if(!eq)return;
    onVisibility(shouldShow,eq);
  }
  function render(){
    if(panel.hidden||!eq)return;
    stopOnEnd();
    if(!model){
      if(status)status.textContent='Nenhum roteiro disponível.';
      return;
    }
    const stages=model.stages;
    position=Math.max(0,Math.min(stages.length-1,position));
    const step=stages[position];
    if(title)title.textContent=model.title;
    if(caption)caption.textContent=step.title;
    if(text)text.textContent=step.description;
    if(formula)formula.textContent=step.formula;
    if(cards)cards.replaceChildren(...step.matrices.map(renderMatrixCard));
    if(progress){progress.max=String(stages.length-1);progress.value=String(position);}
    if(indexText)indexText.textContent='Etapa '+(position+1)+' de '+stages.length;
    if(prev)prev.disabled=position===0;
    if(first)first.disabled=position===0;
    if(next)next.disabled=position===stages.length-1;
    if(last)last.disabled=position===stages.length-1;
    if(status)status.textContent=position===stages.length-1?'Resultado revelado nesta etapa.':'Resposta final oculta durante a resolução.';
    if(method){
      method.hidden=!model.methods?.length||model.methods.length===1;
      if(!method.hidden){
        method.replaceChildren(...model.methods.map(name=>{
          const opt=node('option','',name);opt.value=name;return opt;
        }));
        method.value=model.method;
        method.setAttribute('aria-label','Método de cálculo do determinante');
      }
    }
    visible(position===stages.length-1);
    onChange({equation:eq,index:position,total:stages.length});
  }
  function stopOnEnd(){
    if(model&&position>=model.stages.length-1)stop();
  }
  function go(nextIndex){
    if(!model)return;
    position=Math.max(0,Math.min(model.stages.length-1,nextIndex));
    render();
  }
  function open(equation){
    stop();if(eq)visible(true);
    eq=equation;currentMethod=null;position=0;panel.hidden=false;
    refresh(true);
  }
  function refresh(reset=false){
    if(panel.hidden||!eq)return;
    try{
      const nextModel=getModel(eq,currentMethod);
      const same=nextModel.operation===model?.operation;
      if(!same||reset)position=0;
      model=nextModel;
      currentMethod=model.method;
      render();
    }catch(error){
      stop();model=null;
      if(cards)cards.replaceChildren();
      if(status)status.textContent=error.message;
      if(title)title.textContent='Resolução indisponível';
      if(text)text.textContent='Revise a entrada ou use outra matriz.';
      if(formula)formula.textContent='';
      visible(true);
    }
  }
  function close(){
    stop();if(eq)visible(true);
    panel.hidden=true;eq=null;model=null;currentMethod=null;
  }
  if(first)first.onclick=()=>{stop();go(0);};
  if(prev)prev.onclick=()=>{stop();go(position-1);};
  if(next)next.onclick=()=>{stop();go(position+1);};
  if(last)last.onclick=()=>{stop();go(model?model.stages.length-1:0);};
  if(progress)progress.oninput=()=>{stop();go(Number(progress.value));};
  if(method)method.onchange=()=>{stop();currentMethod=method.value;position=0;refresh();};
  if(closeBtn)closeBtn.onclick=close;
  if(play)play.onclick=()=>{
    if(interval!==null){stop();return;}
    if(!model)return;
    if(position===model.stages.length-1)position=0;
    render();play.textContent='⏸ Pausar';play.setAttribute('aria-pressed','true');
    interval=setInterval(()=>{
      if(panel.hidden||!model||position>=model.stages.length-1){stop();return;}
      position++;render();
    },1550);
  };
  panel.addEventListener('keydown',event=>{
    if(event.target?.tagName==='INPUT'||event.target?.tagName==='SELECT')return;
    if(event.key==='ArrowRight'){event.preventDefault();stop();go(position+1);}
    if(event.key==='ArrowLeft'){event.preventDefault();stop();go(position-1);}
    if(event.key==='Escape'){event.preventDefault();close();}
  });
  return {open,refresh,close,isOpen:()=>!panel.hidden,currentEquation:()=>eq,
    getPosition:()=>position};
}
