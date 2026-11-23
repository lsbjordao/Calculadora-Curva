"use strict";

/**
 * Converts the compact information text used by Curva into display lines.
 * The underlying mathematical strings are unchanged: only their presentation
 * is split into accessible label/value rows. Dot products (u · v) must not
 * be mistaken for the dot that previously separated distinct properties.
 */
export function splitInfoLines(value){
  const entries=Array.isArray(value)?value:[value];
  const lines=[];
  for(const entry of entries){
    for(const paragraph of String(entry??'').split(/\r?\n/)){
      const chunks=paragraph.split(/\s+·\s+/);
      let current=(chunks.shift()||'').trim();
      for(const raw of chunks){
        const next=raw.trim();
        // Dot product expressions ("u · v = 2") are mathematical operators,
        // not boundaries between independent information fields.
        const dotProduct=/(?:^|[\s(])([A-Za-zα-ωΑ-Ω])$/.test(current) &&
          /^[A-Za-zα-ωΑ-Ω](?:\s*[=+−-]|$)/.test(next);
        if(dotProduct)current+=' · '+next;
        else{
          if(current)lines.push(current);
          current=next;
        }
      }
      if(current)lines.push(current);
    }
  }
  return lines;
}

/** Key ends at the first colon; the rest remains verbatim mathematical text. */
export function infoLabelValue(line){
  const text=String(line||'').trim();
  const match=text.match(/^([^:]{1,90}):(?:\s+|$)(.*)$/u);
  return match?{label:match[1].trim(),value:match[2]}:{label:null,value:text};
}
