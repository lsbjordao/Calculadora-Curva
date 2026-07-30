"use strict";

const SUPER={
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾','n':'ⁿ','i':'ⁱ'
};

function superscript(value){
  const chars=[...String(value)];
  return chars.every(char=>SUPER[char]) ? chars.map(char=>SUPER[char]).join('') : null;
}

function matchingParen(text, open){
  let depth=0;
  for(let i=open;i<text.length;i++){
    if(text[i]==='(') depth++;
    else if(text[i]===')' && --depth===0) return i;
  }
  return -1;
}

function compactRadical(body){
  const value=body.trim();
  return /^[\p{L}\dπθ]+$/u.test(value) ? value : '('+value+')';
}

/** A presentation-only formatter. The parser continues to receive the source text. */
export function formatMathVisual(source){
  let text=String(source??'');
  // Work from the innermost call outwards so nested radicals remain readable.
  for(let pass=0;pass<20;pass++){
    const match=/(sqrt|cbrt)\s*\(/i.exec(text);
    if(!match) break;
    const open=match.index+match[0].lastIndexOf('(');
    const close=matchingParen(text,open);
    if(close<0) break;
    const root=match[1].toLowerCase()==='sqrt'?'√':'∛';
    const body=text.slice(open+1,close);
    text=text.slice(0,match.index)+root+compactRadical(body)+text.slice(close+1);
  }
  text=text.replace(/\^\s*\(([-+\d=ni]+)\)|\^\s*([-+\d=ni]+)/g,(whole,group,bare)=>{
    return superscript(group??bare) ?? whole;
  });
  return text
    .replace(/\bpi\b/gi,'π')
    .replace(/\btheta\b/gi,'θ')
    .replace(/<=/g,'≤').replace(/>=/g,'≥').replace(/!=/g,'≠')
    .replace(/\s*\*\s*/g,' · ')
    .replace(/\s+/g,' ').trim();
}

function number(value){
  if(!Number.isFinite(value)) return '?';
  return new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(value);
}

export function describeCanvas({gridMode='linear',view={},width=0,height=0,equations=[]}={}){
  const scale=Number(view.scale)||1;
  const halfX=(Number(width)||0)/(2*scale);
  const halfY=(Number(height)||0)/(2*scale);
  const cx=Number(view.cx)||0, cy=Number(view.cy)||0;
  const modes={linear:'cartesiana',log:'logarítmica',polar:'polar'};
  const visible=equations.filter(eq=>eq?.visible && !eq?.error && eq?.text?.trim());
  const items=visible.map((eq,index)=>{
    const name=String(eq.name||'').trim() || `Curva ${index+1}`;
    return `${name}: ${formatMathVisual(eq.text)}${eq.kind&&eq.kind!=='function' ? `, tipo ${eq.kind}` : ''}`;
  });
  const bounds=`x de ${number(cx-halfX)} a ${number(cx+halfX)} e y de ${number(cy-halfY)} a ${number(cy+halfY)}`;
  return `Gráfico com grade ${modes[gridMode]||gridMode}, janela visível: ${bounds}. `+
    (items.length ? `${items.length} ${items.length===1?'objeto visível':'objetos visíveis'}: ${items.join('; ')}.` : 'Nenhum objeto visível.');
}
