"use strict";

// Normalize any CSS-ish color the app produces (#rgb, #rrggbb, rgb(...)) to a
// 6-digit hex string for the native <input type=color>.
export function toHex(c){
  if(typeof c!=='string'||!c) return '#000000';
  if(c[0]==='#'){ if(c.length===4) return '#'+[...c.slice(1)].map(x=>x+x).join(''); return c; }
  const m=c.match(/\d+/g); if(!m) return '#000000';
  return '#'+m.slice(0,3).map(n=>(+n).toString(16).padStart(2,'0')).join('');
}

// Validate a persisted color override. Returns a canonical #rrggbb string, or
// null when the value is missing/garbage so callers can fall back to the palette.
export function sanitizeColor(c){
  if(typeof c!=='string') return null;
  const s=c.trim();
  if(/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if(/^#[0-9a-fA-F]{3}$/.test(s)) return ('#'+[...s.slice(1)].map(x=>x+x).join('')).toLowerCase();
  return null;
}

// Builds the per-equation color/style popover. Dependencies are injected so the
// module stays free of app-level globals:
//   getPalette() -> array of palette colors for the current theme
//   eqColor(eq)  -> the resolved color string for an equation
//   onChange()   -> called after any edit (redraw + persist)
export function createStyleEditor({getPalette, eqColor, onChange}){
  let pop=null;
  let lastAnchor=null;

  function onAway(ev){ if(pop && !pop.contains(ev.target)) close(); }
  function onKey(ev){ if(ev.key==='Escape'){ ev.stopPropagation(); close(); } }

  function close(){
    if(!pop) return;
    pop.remove();
    pop=null;
    document.removeEventListener('mousedown',onAway,true);
    document.removeEventListener('keydown',onKey,true);
    if(lastAnchor&&document.contains(lastAnchor)) lastAnchor.focus();
    lastAnchor=null;
  }

  function open(eq, anchor){
    close();
    lastAnchor=anchor;
    const palette=getPalette();
    pop=document.createElement('div'); pop.className='style-pop';
    pop.setAttribute('role','dialog');
    pop.setAttribute('aria-label','Cor e estilo da linha');

    const swatches=document.createElement('div'); swatches.className='sp-swatches';
    let firstSwatch=null;
    palette.forEach((c,i)=>{
      const s=document.createElement('button'); s.className='sp-sw'; s.style.background=c;
      s.title='Cor '+(i+1);
      if(!eq.colorOverride && eq.ci%palette.length===i) s.dataset.sel='1';
      if(i===0) firstSwatch=s;
      s.onclick=()=>{ eq.ci=i; eq.colorOverride=null; refreshChip(); markSel(swatches,s); syncCustom(); onChange(); };
      swatches.appendChild(s);
    });
    const custom=document.createElement('input'); custom.type='color'; custom.className='sp-custom';
    custom.title='Cor personalizada';
    custom.value=toHex(eqColor(eq));
    custom.oninput=()=>{ eq.colorOverride=custom.value; refreshChip(); markSel(swatches,null); onChange(); };
    function syncCustom(){ custom.value=toHex(eqColor(eq)); }

    const styleRow=document.createElement('div'); styleRow.className='sp-row';
    [['solid','—'],['dashed','– –'],['dotted','· ·']].forEach(([k,lbl])=>{
      const b=document.createElement('button'); b.className='sp-opt'; b.textContent=lbl;
      b.dataset.sel=eq.style===k?'1':'0';
      b.onclick=()=>{ eq.style=k; [...styleRow.children].forEach(c=>c.dataset.sel='0'); b.dataset.sel='1'; onChange(); };
      styleRow.appendChild(b);
    });

    const widthRow=document.createElement('div'); widthRow.className='sp-row';
    [['fina',1.3],['média',2],['grossa',3]].forEach(([lbl,w])=>{
      const b=document.createElement('button'); b.className='sp-opt'; b.textContent=lbl;
      b.dataset.sel=Math.abs(eq.lw-w)<0.01?'1':'0';
      b.onclick=()=>{ eq.lw=w; [...widthRow.children].forEach(c=>c.dataset.sel='0'); b.dataset.sel='1'; onChange(); };
      widthRow.appendChild(b);
    });

    function refreshChip(){ anchor.style.background=eqColor(eq); }
    function markSel(container,sel){ [...container.children].forEach(c=>c.dataset.sel='0'); if(sel) sel.dataset.sel='1'; }
    function label(t){ const d=document.createElement('div'); d.className='sp-label'; d.textContent=t; return d; }

    pop.append(label('Cor'), swatches, custom, label('Linha'), styleRow, label('Espessura'), widthRow);

    document.body.appendChild(pop);
    const r=anchor.getBoundingClientRect();
    pop.style.left=Math.min(r.left, window.innerWidth-pop.offsetWidth-12)+'px';
    pop.style.top=(r.bottom+6)+'px';
    if(firstSwatch) firstSwatch.focus();
    setTimeout(()=>{
      document.addEventListener('mousedown',onAway,true);
      document.addEventListener('keydown',onKey,true);
    },0);
  }

  return { open, close };
}
