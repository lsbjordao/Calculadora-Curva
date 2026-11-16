import { matrixInfo, validateVector } from './linear-algebra.js';

export const isStructuredResult = value => !!value && typeof value === 'object' && !Array.isArray(value) && typeof value.kind === 'string';
export function formatAlgebraNumber(value) {
  if (value === Infinity) return '∞';
  if (!Number.isFinite(value)) return 'indisponível';
  if (Object.is(value, -0) || value === 0) return '0';
  return String(Number(value.toPrecision(10)));
}
// Full precision for round trips; display rounding never changes copied values.
export function algebraSyntax(value) {
  if (Array.isArray(value)) return '['+value.map(algebraSyntax).join(',')+']';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (isStructuredResult(value)) {
    if (value.value != null) return algebraSyntax(value.value);
    return JSON.stringify(value, (_, v) => v === Infinity ? 'Infinity' : v, 2);
  }
  return '';
}
export function resultInfo(value, inputShapes = []) {
  let result;
  if (isStructuredResult(value)) result = value;
  else if (Array.isArray(value) && Array.isArray(value[0])) result = matrixInfo(value);
  else if (Array.isArray(value)) { validateVector(value); result = {kind:'vector',value,shape:[value.length],metadata:{},warnings:[]}; }
  else {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('O cálculo não produziu um número real finito.');
    result = {kind:'scalar',value,shape:[],metadata:{},warnings:[]};
  }
  return {...result, inputShapes};
}
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
function copyButtons(value, label) {
  const actions = el('div','algebra-copy');
  const status = el('span','algebra-copy-status'); status.setAttribute('role','status');
  const isMatrix = Array.isArray(value) && Array.isArray(value[0]);
  const text = isMatrix ? value.map(row => row.map(String).join('\t')).join('\n') : Array.isArray(value) ? value.join('\t') : String(value);
  for (const [caption,content] of [['copiar texto',text],['copiar Curva',algebraSyntax(value)]]) {
    const button = el('button','calc',caption); button.type = 'button';
    button.setAttribute('aria-label',`${caption}: ${label}`);
    button.onclick = async () => {
      try {
        if (!globalThis.navigator?.clipboard?.writeText) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText(content); status.textContent = 'Copiado.';
      } catch {
        // A selectable, keyboard-accessible fallback also works without HTTPS.
        const field = el('textarea','algebra-copy-fallback'); field.value = content;
        field.readOnly = true; field.setAttribute('aria-label','Resultado para copiar');
        actions.appendChild(field); field.focus(); field.select(); status.textContent = 'Use Ctrl+C ou ⌘C para copiar.';
      }
    };
    actions.appendChild(button);
  }
  actions.appendChild(status); return actions;
}
export function MatrixResultView(value, label = 'Resultado') {
  const matrix = Array.isArray(value[0]) ? value : [value];
  const root = el('div','matrix-result');
  const scroll = el('div','matrix-scroll'); scroll.tabIndex = 0;
  scroll.setAttribute('role','region'); scroll.setAttribute('aria-label',`${label}: ${matrix.length} linhas, ${matrix[0].length} colunas`);
  const table = el('table','matrix-values');
  table.appendChild(el('caption','',`${label} · ${matrix.length}×${matrix[0].length}`));
  const tbody = el('tbody');
  matrix.forEach(row => { const tr = el('tr'); row.forEach(x => tr.appendChild(el('td','',formatAlgebraNumber(x)))); tbody.appendChild(tr); });
  table.appendChild(tbody); scroll.appendChild(table); root.append(scroll,copyButtons(value,label));
  return root;
}
const labels = {types:'Tipo',rank:'Posto numérico',determinant:'Determinante',trace:'Traço',invertible:'Invertível',condition:'Condicionamento',eigenvalues:'Autovalores',
  eigenvalueNote:'Autovalores',diagonalizable:'Base completa de autovetores',repeated:'Autovalor repetido',residual:'Resíduo',relativeResidual:'Resíduo relativo',
  augmentedRank:'Posto aumentado',threshold:'Tolerância de posto',classification:'Classificação',consistent:'Sistema consistente',compatibilityResidual:'Resíduo de compatibilidade',method:'Método',order:'Ordem',identity:'Identidade'};
const classifications = {unique:'Solução única',infinite:'Infinitas soluções',inconsistent:'Sistema inconsistente','ill-conditioned':'Sistema numericamente mal condicionado'};
function metadataText(key, value) {
  if (typeof value === 'boolean') return value ? 'sim' : 'não';
  if (typeof value === 'number') return formatAlgebraNumber(value);
  if (Array.isArray(value)) return value.map(x => typeof x === 'string' ? x : formatAlgebraNumber(x)).join(', ');
  return classifications[value] || String(value);
}
export function renderAlgebraResult(host, result) {
  host.replaceChildren(); host.classList.add('algebra-result');
  host.setAttribute('aria-live','polite');
  const title = {scalar:'Resultado',vector:'Vetor',matrix:'Matriz',solveinfo:'Análise do sistema',lstsq:'Mínimos quadrados',eiginfo:'Autovalores e autovetores',qr:'A = Q R',svd:'A = U Σ Vᵀ',lu:'P A = L U',pinv:'Pseudoinversa'}[result.kind] || 'Resultado';
  host.appendChild(el('strong','algebra-result-title',title));
  const shape = result.shape?.length ? result.shape.join('×') : 'escalar';
  const inputs = result.inputShapes?.length ? result.inputShapes.map(s => s.length ? s.join('×') : 'escalar').join(', ')+' → ' : '';
  host.appendChild(el('div','algebra-shape',`Dimensões: ${inputs}${shape}`));
  if (result.value != null) {
    if (Array.isArray(result.value)) host.appendChild(MatrixResultView(result.value,result.kind==='solveinfo'&&result.metadata.classification==='infinite'?'Uma solução de norma mínima':'Resultado'));
    else { host.appendChild(el('output','algebra-scalar',formatAlgebraNumber(result.value))); host.appendChild(copyButtons(result.value,'Resultado')); }
  }
  for (const field of ['Q','R','P','L','U','S','Vt']) if (result[field]) host.appendChild(MatrixResultView(result[field],field === 'Vt' ? 'Vᵀ' : field === 'S' ? 'Valores singulares' : field));
  if (result.eigenvectors) host.appendChild(MatrixResultView(result.eigenvectors,'Autovetores (um por linha)'));
  if (result.kind === 'eiginfo') host.appendChild(el('p','','A v = λ v. Autovalores em ordem crescente; vetores normalizados.'));
  const properties = el('dl','algebra-properties');
  Object.entries(result.metadata || {}).forEach(([key,value]) => {
    if (value == null || !labels[key]) return;
    properties.append(el('dt','',labels[key]),el('dd','',metadataText(key,value)));
  });
  host.appendChild(properties);
  for (const warning of result.warnings || []) host.appendChild(el('p','algebra-warning',warning));
}
