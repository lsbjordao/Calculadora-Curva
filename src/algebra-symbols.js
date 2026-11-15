import { compile } from './parser.js';
import { AlgebraError, validateMatrix, validateVector } from './linear-algebra.js';

// Explicit declarations and @references leave scalar parameters, functions and
// existing geometric A = ... declarations in their original namespaces.
export function algebraDeclaration(text) {
  const match = String(text).trim().match(/^let\s+([a-zA-Z][a-zA-Z0-9]*)\s*=\s*(.+)$/i);
  return match ? {name:match[1].toLowerCase(),body:match[2]} : null;
}
export function createAlgebraSymbols(equations) {
  const declarations = new Map(), duplicates = new Set(), cache = new Map(), active = [];
  for (const eq of equations) {
    const declaration = algebraDeclaration(eq.text);
    if (!declaration) continue;
    if (declarations.has(declaration.name)) duplicates.add(declaration.name);
    declarations.set(declaration.name,{...declaration,eq});
  }
  const resolve = name => {
    name = name.toLowerCase();
    if (duplicates.has(name)) throw new AlgebraError('DUPLICATE',`Variável @${name} declarada mais de uma vez.`);
    if (cache.has(name)) return cache.get(name);
    const declaration = declarations.get(name);
    if (!declaration) throw new AlgebraError('UNKNOWN_SYMBOL',`Variável @${name} não declarada. Use let ${name} = [...].`);
    if (active.includes(name)) throw new AlgebraError('CYCLE','Referência circular: '+[...active,name].map(n=>'@'+n).join(' → '));
    active.push(name);
    try {
      const fn = compile(declaration.body,declaration.eq.params || {},{},resolve);
      if (!fn) throw new AlgebraError('DECLARATION','Declaração vazia.');
      const value = fn(0);
      if (Array.isArray(value?.[0])) validateMatrix(value); else validateVector(value);
      cache.set(name,value); return value;
    } finally { active.pop(); }
  };
  return {resolve,names:[...declarations.keys()]};
}
