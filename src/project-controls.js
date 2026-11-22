"use strict";
import {encodeProjectDocument,decodeProjectDocument,projectFilename,MAX_PROJECT_BYTES} from './project-file.js';

export function initProjectControls({getState,importState}){
  const save=document.getElementById('project-export');
  const open=document.getElementById('project-import');
  const picker=document.getElementById('project-file');
  const status=document.getElementById('project-status');
  if(!save||!open||!picker)return;
  const inform=(message,error=false)=>{
    if(status){status.textContent=message;status.dataset.error=error?'1':'0';}
  };
  save.onclick=()=>{
    let href;
    try{
      const serialized=encodeProjectDocument(getState());
      const blob=new Blob([serialized],{type:'application/json;charset=utf-8'});
      href=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=href;a.download=projectFilename();
      document.body.appendChild(a);
      a.click();a.remove();
      inform('Projeto exportado em JSON.');
    }catch(error){
      inform('Não foi possível exportar: '+error.message,true);
    }finally{
      if(href) URL.revokeObjectURL(href);
    }
  };
  open.onclick=()=>picker.click();
  picker.onchange=async()=>{
    const file=picker.files?.[0];
    picker.value=''; // accept importing the same file twice
    if(!file)return;
    if(file.size>MAX_PROJECT_BYTES){
      inform('Arquivo maior que 2 MB.',true);return;
    }
    try{
      const document=decodeProjectDocument(await file.text());
      importState(document.state);
      inform('Projeto "'+document.title+'" importado. Use Desfazer para recuperar a sessão anterior.');
    }catch(error){
      inform('Falha na importação: '+error.message,true);
    }
  };
}