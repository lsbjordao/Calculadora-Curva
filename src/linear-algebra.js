// Pure, real double-precision algebra. Public inputs remain ordinary arrays.
export class AlgebraError extends Error {
  constructor(code, message, details = {}) {
    super(message); this.name = 'AlgebraError'; this.code = code; this.details = details;
  }
}
const fail = (code, message, details) => { throw new AlgebraError(code, message, details); };
const EPS = Number.EPSILON;
let limits = { maxSize: 20, advancedSize: 12 };
export function configureAlgebra(options = {}) {
  const next = { ...limits, ...options };
  if (!Number.isInteger(next.maxSize) || next.maxSize < 1 || next.maxSize > 100 ||
      !Number.isInteger(next.advancedSize) || next.advancedSize < 1 || next.advancedSize > next.maxSize)
    fail('SIZE', 'Limites inválidos: use 1 ≤ avançado ≤ geral ≤ 100.');
  limits = next;
  return { ...limits };
}
export const algebraLimits = () => ({ ...limits });
const finite = x => typeof x === 'number' && Number.isFinite(x);
export function validateVector(v, name = 'vetor') {
  if (!Array.isArray(v) || !v.length) fail('VECTOR', `${name}: vetor não vazio esperado.`);
  if (v.length > limits.maxSize) fail('SIZE', `${name}: máximo de ${limits.maxSize} componentes.`);
  if (!v.every(finite)) fail('FINITE', `${name}: componentes numéricas finitas esperadas.`);
  return v;
}
export function validateMatrix(A, name = 'matriz', advanced = false) {
  if (!Array.isArray(A) || !A.length || !Array.isArray(A[0]) || !A[0].length)
    fail('MATRIX', `${name}: matriz não vazia esperada.`);
  const n = A[0].length, max = advanced ? limits.advancedSize : limits.maxSize;
  if (A.length > max || n > max) fail('SIZE', `${name}: máximo de ${max}×${max}.`);
  if (A.some(row => !Array.isArray(row) || row.length !== n)) fail('SHAPE', `${name}: linhas de tamanhos diferentes.`);
  if (A.some(row => !row.every(finite))) fail('FINITE', `${name}: componentes numéricas finitas esperadas.`);
  return A;
}
function square(A) {
  validateMatrix(A);
  if (A.length !== A[0].length) fail('SQUARE', 'Esta operação exige uma matriz quadrada.');
  return A.length;
}
function pair(u, v) {
  validateVector(u, 'u'); validateVector(v, 'v');
  if (u.length !== v.length) fail('DIMENSION', 'Os vetores devem ter a mesma dimensão.');
}
const maxAbs = A => Math.max(...A.flat().map(Math.abs));
const tolerance = (m, n) => EPS * Math.max(m, n) * 16;
const rawDot = (u, v) => u.reduce((s, x, i) => s + x * v[i], 0);
const rawTranspose = A => A[0].map((_, j) => A.map(row => row[j]));
const rawMul = (A, B) => A.map(row => B[0].map((_, j) => row.reduce((s, x, k) => s + x * B[k][j], 0)));
const rawZeros = (m, n) => Array.from({ length: m }, () => Array(n).fill(0));
const rawEye = n => rawZeros(n, n).map((row, i) => row.map((_, j) => +(i === j)));
const scaled = A => { const scale = Math.pow(2,Math.min(1023,Math.floor(Math.log2(maxAbs(A) || 1)))); return { scale, matrix: A.map(row => row.map(x => x / scale)) }; };
function dimensions(m, n) {
  if (![m, n].every(x => Number.isInteger(x) && x > 0 && x <= limits.maxSize))
    fail('SIZE', `Dimensões devem ser inteiras entre 1 e ${limits.maxSize}.`);
}
export function dot(u, v) { pair(u, v); return rawDot(u, v); }
export function norm(v) { validateVector(v); return Math.hypot(...v); }
export function unit(v) {const n=norm(v);if(!n)fail('ZERO_VECTOR','O vetor nulo não possui versor.');return v.map(x=>x/n);}
export function vadd(u, v) { pair(u, v); return u.map((x, i) => x + v[i]); }
export function vsub(u, v) { pair(u, v); return u.map((x, i) => x - v[i]); }
// Scalar multiple of a vector or, elementwise, of a matrix: scale(2,A) = 2A.
export function scale(k, v) {
  if (!finite(k)) fail('FINITE', 'O fator de escala deve ser um número finito.');
  if (Array.isArray(v) && Array.isArray(v[0])) { validateMatrix(v); return v.map(row => row.map(x => k * x)); }
  validateVector(v); return v.map(x => k * x);
}
export function angle(u, v) {
  pair(u, v); const a = norm(u), b = norm(v);
  if (!a || !b) fail('ZERO_VECTOR', 'Ângulo indefinido para o vetor nulo.');
  return Math.acos(Math.max(-1, Math.min(1, rawDot(u.map(x => x / a), v.map(x => x / b)))));
}
export function proj(u, v) {
  pair(u, v); const n = norm(v);
  if (!n) fail('ZERO_VECTOR', 'Não é possível projetar sobre o vetor nulo.');
  const direction = v.map(x => x / n), length = rawDot(u, direction);
  return direction.map(x => x * length);
}
export function cross(u, v) {
  pair(u, v);
  if (u.length === 2) return u[0] * v[1] - u[1] * v[0];
  if (u.length === 3) return [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
  fail('DIMENSION', 'Produto vetorial exige dimensão 2 ou 3.');
}
function sameShape(A, B) {
  validateMatrix(A, 'A'); validateMatrix(B, 'B');
  if (A.length !== B.length || A[0].length !== B[0].length) fail('DIMENSION', 'As matrizes devem ter as mesmas dimensões.');
}
export function matadd(A, B) { sameShape(A, B); return A.map((r, i) => r.map((x, j) => x + B[i][j])); }
export function matsub(A, B) { sameShape(A, B); return A.map((r, i) => r.map((x, j) => x - B[i][j])); }
const isVector = X => Array.isArray(X) && X.length > 0 && !Array.isArray(X[0]);
// A vector operand is read as a column on the right (A v) and as a row on the
// left (v A); the product is then returned as a vector.
export function matmul(A, B) {
  if (isVector(A) && isVector(B)) fail('DIMENSION', 'matmul exige ao menos uma matriz. Para dois vetores, use dot(u,v).');
  if (isVector(B)) {
    validateMatrix(A, 'A'); validateVector(B, 'B');
    if (A[0].length !== B.length) fail('DIMENSION', `Multiplicação incompatível: ${A.length}×${A[0].length} e vetor de ${B.length} componentes.`);
    return A.map(row => rawDot(row, B));
  }
  if (isVector(A)) {
    validateVector(A, 'A'); validateMatrix(B, 'B');
    if (A.length !== B.length) fail('DIMENSION', `Multiplicação incompatível: vetor de ${A.length} componentes e ${B.length}×${B[0].length}.`);
    return B[0].map((_, j) => A.reduce((s, x, k) => s + x * B[k][j], 0));
  }
  validateMatrix(A, 'A'); validateMatrix(B, 'B');
  if (A[0].length !== B.length) fail('DIMENSION', `Multiplicação incompatível: ${A.length}×${A[0].length} e ${B.length}×${B[0].length}.`);
  return rawMul(A, B);
}
export function transpose(A) { validateMatrix(A); return rawTranspose(A); }
export function trace(A) { square(A); return A.reduce((s, row, i) => s + row[i], 0); }
export function eye(n) { dimensions(n, n); return rawEye(n); }
export function zeros(m, n) { dimensions(m, n); return rawZeros(m, n); }
export function frobenius(A) { validateMatrix(A); return Math.hypot(...A.flat()); }
export function matpow(A,n){
  const size=square(A);if(!Number.isInteger(n)||Math.abs(n)>100)fail('POWER','Expoente inteiro entre −100 e 100 esperado.');
  let base=n<0?inv(A):A.map(row=>[...row]), out=eye(size),k=Math.abs(n);
  while(k){if(k%2)out=matmul(out,base);k=Math.floor(k/2);if(k)base=matmul(base,base);}
  return out;
}
function relativeResidual(A, B) {
  const s = Math.max(maxAbs(A), maxAbs(B)) || 1;
  return Math.hypot(...A.flatMap((r, i) => r.map((x, j) => x/s-B[i][j]/s))) /
    (Math.hypot(...A.flat().map(x => x/s)) || 1);
}
// LU on a scaled copy, with partial pivoting. Zero pivots, numerical rank and
// conditioning are distinct concepts; a small nonzero determinant is not a test.
function factor(A) {
  const n = square(A), { scale, matrix: M } = scaled(A), permutation = Array.from({length:n}, (_, i) => i);
  let sign = 1, singular = false;
  for (let j = 0; j < n; j++) {
    let p = j;
    for (let i = j+1; i < n; i++) if (Math.abs(M[i][j]) > Math.abs(M[p][j])) p = i;
    if (M[p][j] === 0) { singular = true; continue; }
    if (p !== j) { [M[p], M[j]] = [M[j], M[p]]; [permutation[p], permutation[j]] = [permutation[j], permutation[p]]; sign *= -1; }
    for (let i = j+1; i < n; i++) {
      M[i][j] /= M[j][j];
      for (let k = j+1; k < n; k++) M[i][k] -= M[i][j]*M[j][k];
    }
  }
  return { M, permutation, scale, sign, singular };
}
function factoredSolve(f, b) {
  if (f.singular) fail('SINGULAR', 'Matriz singular: não existe solução única. Use solveinfo(A,b).');
  const {M, permutation, scale} = f, n = M.length, x = permutation.map(i => b[i]/scale);
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) x[i] -= M[i][j]*x[j];
  for (let i = n-1; i >= 0; i--) {
    for (let j = i+1; j < n; j++) x[i] -= M[i][j]*x[j];
    x[i] /= M[i][i];
  }
  if (!x.every(finite)) fail('OVERFLOW', 'Resultado fora do alcance da precisão dupla.');
  return x;
}
export function det(A) {
  const f = factor(A);
  if (f.singular) return 0;
  // Multiplication retains exact small integer cases and avoids a log roundoff.
  let value = f.sign;
  for (let i = 0; i < A.length; i++) value *= f.M[i][i]*f.scale;
  return value;
}
export function inv(A) {
  const f = factor(A), n = A.length;
  return rawTranspose(rawEye(n).map(row => factoredSolve(f, row)));
}
function rhs(A, b) {
  validateMatrix(A);
  // Legacy linsolve also accepts a column matrix.
  const v = Array.isArray(b) && b.every(row => Array.isArray(row) && row.length === 1) ? b.map(row => row[0]) : b;
  validateVector(v, 'b');
  if (v.length !== A.length) fail('DIMENSION', 'b deve ter uma componente por linha de A.');
  return v;
}
export function linsolve(A, b) { const v = rhs(A, b); return factoredSolve(factor(A), v); }
function reduce(A,{record=false}={}) {
  validateMatrix(A);
  const {matrix:M,scale} = scaled(A), m = M.length, n = M[0].length, tol = tolerance(m, n), pivots = [];
  const steps=[];const snap=(operation)=>{if(record&&steps.length<160)steps.push({operation,matrix:M.map(row=>[...row])});};
  snap(scale===1?'Matriz inicial':'Normalização numérica da matriz (dividir por '+scale+')');
  let row = 0;
  for (let col = 0; col < n && row < m; col++) {
    let p = row;
    for (let i = row+1; i < m; i++) if (Math.abs(M[i][col]) > Math.abs(M[p][col])) p = i;
    if (Math.abs(M[p][col]) <= tol) { for (let i = row; i < m; i++) M[i][col] = 0; continue; }
    if(p!==row){[M[p], M[row]] = [M[row], M[p]];snap('Trocar L'+(p+1)+' ↔ L'+(row+1));}
    const pivot = M[row][col];
    M[row] = M[row].map(x => x/pivot); M[row][col] = 1;snap('Normalizar L'+(row+1)+' pelo pivô '+pivot);
    for (let i = 0; i < m; i++) if (i !== row) {
      const f = M[i][col];
      if(Math.abs(f)<=tol){M[i][col]=0;continue;}
      for (let j = 0; j < n; j++) M[i][j] -= f*M[row][j];
      M[i][col] = 0;snap('L'+(i+1)+' ← L'+(i+1)+' − ('+f+')L'+(row+1));
    }
    pivots.push(col); row++;
  }
  return { matrix:M, pivots, steps, tol };
}
export function rref(A) { return reduce(A).matrix; }
export function rank(A) { return reduce(A).pivots.length; }
export function rrefinfo(A){
  validateMatrix(A,'matriz',true);
  const r=reduce(A,{record:true});
  return {kind:'rrefinfo',shape:[A.length,A[0].length],value:r.matrix,steps:r.steps,
    metadata:{rank:r.pivots.length,method:'Gauss–Jordan com pivotamento parcial',threshold:r.tol},
    warnings:r.steps.length>=160?['Exibidas somente 160 etapas.']:[]};
}
const structured = (kind, shape, fields, metadata = {}, warnings = []) => ({kind, shape, ...fields, metadata, warnings});
const illWarning = condition => condition > 1e10 ? ['Matriz numericamente mal condicionada; os resultados podem perder precisão.'] : [];
function conditionInfinity(A, inverse) {
  const a = maxAbs(A) || 1, b = maxAbs(inverse) || 1;
  const normA = Math.max(...A.map(row => row.reduce((s,x) => s+Math.abs(x/a),0)));
  const normB = Math.max(...inverse.map(row => row.reduce((s,x) => s+Math.abs(x/b),0)));
  return (a*b)*normA*normB;
}
// Structural classes, with a tolerance relative to the largest entry.
export function matrixTypes(A) {
  validateMatrix(A);
  const m = A.length, n = A[0].length, types = [], tol = 1e-12 * Math.max(1, maxAbs(A));
  const zero = x => Math.abs(x) <= tol;
  if (m !== n) {
    if (m === 1) types.push('linha');
    if (n === 1) types.push('coluna');
  }
  if (A.every(row => row.every(zero))) return [...types, 'nula'];
  if (m !== n) return types;
  let upper = true, lower = true, symmetric = true, antisymmetric = true;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i > j && !zero(A[i][j])) upper = false;
    if (i < j && !zero(A[i][j])) lower = false;
    if (!zero(A[i][j] - A[j][i])) symmetric = false;
    if (!zero(A[i][j] + A[j][i])) antisymmetric = false;
  }
  if (upper && lower) types.push(A.every((row, i) => Math.abs(row[i] - 1) <= tol) ? 'identidade' : 'diagonal');
  else { if (upper) types.push('triangular superior'); if (lower) types.push('triangular inferior'); }
  if (symmetric) types.push('simétrica');
  if (antisymmetric) types.push('antissimétrica');
  const product = rawMul(A, rawTranspose(A));
  if (product.every((row, i) => row.every((x, j) => Math.abs(x - +(i === j)) <= 1e-10))) types.push('ortogonal');
  return types;
}
export function matrixInfo(A) {
  validateMatrix(A);
  const shape = [A.length, A[0].length], metadata = {rank:rank(A)}, warnings = [];
  const types = matrixTypes(A); if (types.length) metadata.types = types;
  if (shape[0] === shape[1]) {
    metadata.determinant = det(A); metadata.trace = trace(A);
    try { const inverse = inv(A); metadata.invertible = true; metadata.condition = conditionInfinity(A, inverse); warnings.push(...illWarning(metadata.condition)); }
    catch (e) { if (e.code !== 'SINGULAR' && e.code !== 'OVERFLOW') throw e; metadata.invertible = e.code !== 'SINGULAR'; metadata.condition = Infinity; warnings.push(...illWarning(Infinity)); }
    if (shape[0] === 2) {
      try { const e = eiginfo(A); metadata.eigenvalues = e.value; metadata.diagonalizable = e.metadata.diagonalizable; }
      catch (e) { if (e.code !== 'COMPLEX') throw e; metadata.eigenvalueNote = e.message; }
    } else if (shape[0] === 3) {
      // Only symmetric 3×3 matrices have eigenvalues here; others stay silent.
      try { const e = eiginfo(A); metadata.eigenvalues = e.value; metadata.diagonalizable = e.metadata.diagonalizable; }
      catch (e) { if (e.code === 'CONVERGENCE') metadata.eigenvalueNote = e.message; else if (e.code !== 'UNSUPPORTED') throw e; }
    }
  }
  return structured('matrix', shape, {value:A.map(row => row.slice())}, metadata, warnings);
}
// Householder QR. Full Q (m×m) and R (m×n), including deficient/wide inputs.
export function qr(A) {
  validateMatrix(A, 'QR', true);
  const m = A.length, n = A[0].length, {matrix:R, scale:s} = scaled(A), Q = rawEye(m);
  for (let k = 0; k < Math.min(m, n); k++) {
    const v = R.slice(k).map(row => row[k]), length = Math.hypot(...v);
    if (!length) continue;
    v[0] += (v[0] >= 0 ? 1 : -1)*length;
    const nv = Math.hypot(...v); for (let i = 0; i < v.length; i++) v[i] /= nv;
    for (let j = k; j < n; j++) {
      let d = 0; for (let i = k; i < m; i++) d += v[i-k]*R[i][j];
      for (let i = k; i < m; i++) R[i][j] -= 2*v[i-k]*d;
    }
    for (let i = 0; i < m; i++) {
      let d = 0; for (let j = k; j < m; j++) d += Q[i][j]*v[j-k];
      for (let j = k; j < m; j++) Q[i][j] -= 2*d*v[j-k];
    }
    for (let i = k+1; i < m; i++) R[i][k] = 0;
  }
  const result = R.map(row => row.map(x => x*s));
  return structured('qr', [m,n], {Q, R:result}, {rank:rank(A), residual:relativeResidual(A, rawMul(Q,result)), method:'Householder'});
}
export function lu(A) {
  validateMatrix(A, 'LU', true); const f = factor(A), n = A.length;
  const L = rawEye(n), U = rawZeros(n,n), P = rawZeros(n,n);
  for (let i = 0; i < n; i++) {
    P[i][f.permutation[i]] = 1;
    for (let j = 0; j < n; j++) if (j < i) L[i][j] = f.M[i][j]; else U[i][j] = f.M[i][j]*f.scale;
  }
  return structured('lu', [n,n], {P,L,U}, {rank:rank(A), residual:relativeResidual(rawMul(P,A), rawMul(L,U)), identity:'P A = L U'});
}
// One-sided cyclic Jacobi: orthogonalize columns directly, without forming AᵀA.
// Economy SVD: U m×k, S k, Vt k×n; k=min(m,n). Singular values descend.
function tallSVD(A) {
  const m = A.length, n = A[0].length, {matrix:B, scale:s} = scaled(A), V = rawEye(n);
  let converged = false, sweeps = 0;
  for (; sweeps < 100; sweeps++) {
    let changed = false;
    for (let p = 0; p < n-1; p++) for (let q = p+1; q < n; q++) {
      const ap = Math.hypot(...B.map(row => row[p])), aq = Math.hypot(...B.map(row => row[q]));
      if (!ap || !aq) continue;
      let rho = 0; for (let i = 0; i < m; i++) rho += (B[i][p]/ap)*(B[i][q]/aq);
      if (Math.abs(rho) <= EPS*Math.max(m,n)*4) continue;
      const local = Math.max(ap, aq), a = ap/local, b = aq/local, g = a*b*rho;
      if (!g) continue;
      const tau = (b*b-a*a)/(2*g), t = (tau >= 0 ? 1 : -1)/(Math.abs(tau)+Math.hypot(1,tau));
      if (!t) continue;
      const c = 1/Math.hypot(1,t), sn = c*t;
      for (const row of B) { const x = row[p], y = row[q]; row[p] = c*x-sn*y; row[q] = sn*x+c*y; }
      for (const row of V) { const x = row[p], y = row[q]; row[p] = c*x-sn*y; row[q] = sn*x+c*y; }
      changed = true;
    }
    if (!changed) { converged = true; break; }
  }
  if (!converged) fail('CONVERGENCE', 'A SVD não convergiu no limite de 100 varreduras.');
  const lengths = Array.from({length:n}, (_, j) => Math.hypot(...B.map(row => row[j])));
  const order = Array.from({length:n}, (_, i) => i).sort((i,j) => lengths[j]-lengths[i] || i-j);
  const U = rawZeros(m,n), S = order.map(j => lengths[j]*s), Vt = order.map(j => V.map(row => row[j]));
  for (let j = 0; j < n; j++) {
    const idx = order[j], length = lengths[idx];
    let v;
    if (length > (lengths[order[0]] || 1)*tolerance(m,n)) v = B.map(row => row[idx]/length);
    else {
      // Complete the orthonormal basis at a numerically zero singular value.
      let best = [], bestLength = -1;
      for (let k = 0; k < m; k++) {
        const candidate = Array.from({length:m}, (_, i) => +(i === k));
        for (let pass = 0; pass < 2; pass++) for (let l = 0; l < j; l++) {
          const d = candidate.reduce((sum,x,i) => sum+x*U[i][l],0);
          for (let i = 0; i < m; i++) candidate[i] -= d*U[i][l];
        }
        const len = Math.hypot(...candidate);
        if (len > bestLength) { best = candidate; bestLength = len; }
      }
      v = best.map(x => x/bestLength);
      // Below the declared numerical rank threshold, discard roundoff noise.
      S[j] = 0;
    }
    let pivot = 0; for (let i = 1; i < m; i++) if (Math.abs(v[i]) > Math.abs(v[pivot])) pivot = i;
    const sign = v[pivot] < 0 ? -1 : 1;
    for (let i = 0; i < m; i++) U[i][j] = sign*v[i];
    Vt[j] = Vt[j].map(x => sign*x);
  }
  return {U,S,Vt,sweeps};
}
function computeSVD(A) {
  const m = A.length, n = A[0].length;
  if (m >= n) return tallSVD(A);
  const f = tallSVD(rawTranspose(A));
  return {U:rawTranspose(f.Vt), S:f.S, Vt:rawTranspose(f.U), sweeps:f.sweeps};
}
export function svd(A) {
  validateMatrix(A, 'SVD', true);
  return svdResult(A);
}
function svdResult(A) {
  const {U,S,Vt,sweeps} = computeSVD(A), m = A.length, n = A[0].length;
  const threshold = (S[0] || 0)*tolerance(m,n), numericalRank = S.filter(x => x > threshold).length;
  const condition = numericalRank < S.length || !S[0] ? Infinity : S[0]/S[S.length-1];
  const reconstruction = rawMul(U.map(row => row.map((x,j) => x*S[j])), Vt);
  return structured('svd', [m,n], {U,S,Vt}, {rank:numericalRank, condition, threshold, sweeps,
    residual:relativeResidual(A,reconstruction), method:'Jacobi unilateral', economy:true}, illWarning(condition));
}
function pseudo(f) {
  const {U,S,Vt,metadata:{threshold}} = f;
  return rawMul(rawTranspose(Vt).map(row => row.map((x,j) => S[j] > threshold ? x/S[j] : 0)), rawTranspose(U));
}
export function pinv(A) {
  const f = svd(A), value = pseudo(f);
  return structured('pinv', [A[0].length,A.length], {value}, {...f.metadata, residual:relativeResidual(A,rawMul(rawMul(A,value),A))}, f.warnings);
}
function solutionResult(A, b, f, kind) {
  // Solve through the factors directly; do not form an inverse/pseudoinverse.
  const bScale = Math.max(...b.map(Math.abs)) || 1, normalizedB = b.map(x => x/bScale);
  const coefficients = f.S.map((s,j) => s > f.metadata.threshold ? rawDot(f.U.map(row => row[j]),normalizedB) : 0);
  const value = f.Vt[0].map((_,i) => f.S.reduce((sum,s,j) => sum+(s > f.metadata.threshold ? f.Vt[j][i]*coefficients[j]*(bScale/s) : 0),0));
  if(!value.every(finite)) fail('OVERFLOW','Solução fora do alcance da precisão dupla.');
  // Consistency comes from projecting b onto the numerical column space.
  // A large solution norm must not conceal an incompatible component of b.
  const projectedB = f.U.map(row => rawDot(row,coefficients));
  const compatibility = Math.hypot(...projectedB.map((x,i) => x-normalizedB[i]))/(Math.hypot(...normalizedB) || 1);
  const consistent = compatibility <= tolerance(A.length,A[0].length)*4;
  const residualScale = Math.max(maxAbs(A),bScale);
  const normalizedA = A.map(row => row.map(x => x/residualScale));
  const error = normalizedA.map((row,i) => rawDot(row,value)-b[i]/residualScale);
  const normalizedResidual = Math.hypot(...error), residual = normalizedResidual*residualScale;
  const denominator = Math.hypot(...normalizedA.flat())*Math.hypot(...value)+Math.hypot(...b.map(x => x/residualScale));
  const relative = denominator ? normalizedResidual/denominator : normalizedResidual;
  const classification = !consistent ? 'inconsistent' : f.metadata.rank < A[0].length ? 'infinite' :
    f.metadata.condition > 1e10 ? 'ill-conditioned' : 'unique';
  return structured(kind, [A[0].length], {value: kind === 'solveinfo' && !consistent ? null : value},
    {...f.metadata, classification, consistent, augmentedRank:f.metadata.rank+(consistent?0:1), residual, relativeResidual:relative, compatibilityResidual:compatibility}, f.warnings);
}
export function solveinfo(A, b) {
  const v = rhs(A,b);
  // Diagnostics are available for every allowed general matrix size.
  return solutionResult(A,v,svdResult(A),'solveinfo');
}
export function lstsq(A, b) { const v = rhs(A,b); return solutionResult(A,v,svd(A),'lstsq'); }
// Symmetric 3×3 eigenpairs by cyclic Jacobi on the power-of-two-scaled matrix.
// Symmetry uses a tolerance relative to the largest entry. Equal eigenvalues
// (relative 1e-13) form one eigenspace; Jacobi keeps its basis orthonormal.
function symmetricEiginfo3(A) {
  const {matrix:M, scale:s} = scaled(A), top = maxAbs(M), n = 3;
  for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++)
    if (Math.abs(M[i][j]-M[j][i]) > 1e-12*top) fail('UNSUPPORTED', 'autovalores 3×3: só matrizes simétricas');
  const a = M.map((row,i) => row.map((x,j) => (x+M[j][i])/2)), V = rawEye(n);
  const offTarget = EPS*Math.hypot(...a.flat());
  let sweeps = 0;
  for (;; sweeps++) {
    if (Math.hypot(a[0][1],a[0][2],a[1][2])*Math.SQRT2 <= offTarget) break;
    if (sweeps === 50) fail('CONVERGENCE', 'Os autovalores 3×3 não convergiram no limite de 50 varreduras.');
    for (let p = 0; p < n-1; p++) for (let q = p+1; q < n; q++) {
      if (a[p][q] === 0) continue;
      const theta = (a[q][q]-a[p][p])/(2*a[p][q]), t = (theta >= 0 ? 1 : -1)/(Math.abs(theta)+Math.hypot(1,theta));
      const c = 1/Math.hypot(1,t), sn = t*c;
      for (const row of [...a, ...V]) { const x = row[p], y = row[q]; row[p] = c*x-sn*y; row[q] = sn*x+c*y; }
      for (let k = 0; k < n; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c*x-sn*y; a[q][k] = sn*x+c*y; }
      a[p][q] = a[q][p] = 0;
    }
  }
  const order = [0,1,2].sort((i,j) => a[i][i]-a[j][j] || i-j), values = order.map(i => a[i][i]);
  const groupTol = 1e-13*Math.max(...values.map(Math.abs)), groups = [];
  values.forEach((x,i) => i && x-values[i-1] <= groupTol ? groups[groups.length-1].push(i) : groups.push([i]));
  const multiplicity = [];
  for (const g of groups) {
    const mean = g.reduce((sum,i) => sum+values[i],0)/g.length;
    for (const i of g) { values[i] = g.length > 1 ? mean : values[i]; multiplicity[i] = g.length; }
  }
  const pairs = order.map((column,i) => {
    let v = V.map(row => row[column]), pivot = 0;
    for (let k = 1; k < n; k++) if (Math.abs(v[k]) > Math.abs(v[pivot])) pivot = k;
    if (v[pivot] < 0) v = v.map(x => -x);
    const lambda = values[i], residual = Math.hypot(...M.map((row,k) => rawDot(row,v)-lambda*v[k]));
    return {value:lambda*s, vector:v, residual, algebraicMultiplicity:multiplicity[i], geometricMultiplicity:multiplicity[i]};
  });
  return structured('eiginfo', [3,3], {value:pairs.map(p => p.value), eigenvectors:pairs.map(p => p.vector), pairs},
    {diagonalizable:true, repeated:groups.length < 3, order:'crescente', residual:Math.max(...pairs.map(p => p.residual)), method:'Jacobi cíclico', sweeps});
}
// Real 2×2 eigenpairs. Scale before the discriminant; use the determinant for
// the smaller root to avoid cancellation. Ascending eigenvalue order.
export function eiginfo(A) {
  const size = square(A);
  if (size === 3) return symmetricEiginfo3(A);
  if (size !== 2) fail('UNSUPPORTED', 'Autovalores e autovetores disponíveis apenas para matrizes reais 2×2 e 3×3 simétricas.');
  const {matrix:[[a,b],[c,d]], scale:s} = scaled(A), tr = a+d, determinant = a*d-b*c;
  let disc = (a-d)*(a-d)+4*b*c;
  const discTol = EPS*16*((a-d)*(a-d)+Math.abs(4*b*c));
  if (disc < -discTol) fail('COMPLEX', 'Autovalores complexos: esta versão representa apenas autovalores e direções reais.');
  disc = Math.max(0,disc);
  const root = Math.sqrt(disc), large = (tr+(tr < 0 ? -root : root))/2;
  let values = root === 0 ? [tr/2,tr/2] : [large, large ? determinant/large : (tr-root)/2];
  values.sort((x,y) => x-y);
  const repeated = root === 0, scalar = b === 0 && c === 0 && a === d;
  const pairs = [];
  const candidates = scalar ? [[1,0],[0,1]] : values.slice(0,repeated?1:2).map(lambda => {
    const u = [b,lambda-a], v = [lambda-d,c], selected = Math.hypot(...u) >= Math.hypot(...v) ? u : v;
    const length = Math.hypot(...selected);
    return selected.map(x => x/length);
  });
  candidates.forEach((v,i) => {
    const pivot = Math.abs(v[0]) >= Math.abs(v[1]) ? 0 : 1;
    if (v[pivot] < 0) v = v.map(x => -x);
    const lambda = values[scalar?0:i];
    const residual = Math.hypot(a*v[0]+b*v[1]-lambda*v[0],c*v[0]+d*v[1]-lambda*v[1]);
    pairs.push({value:lambda*s, vector:v, residual, algebraicMultiplicity:repeated?2:1, geometricMultiplicity:scalar?2:1});
  });
  return structured('eiginfo', [2,2], {value:values.map(x => x*s), eigenvectors:pairs.map(p => p.vector), pairs},
    {diagonalizable:pairs.length === 2, repeated, order:'crescente', residual:Math.max(...pairs.map(p => p.residual))},
    pairs.length < 2 ? ['Matriz não diagonalizável: existe apenas uma direção própria independente.'] : []);
}
export function eig(A) { return eiginfo(A).value; }
export function eigenvectors(A) { return eiginfo(A).eigenvectors; }

export const algebraFunctions = Object.freeze({dot,norm,unit,vadd,vsub,scale,angle,proj,cross,matadd,matsub,matmul,matpow,transpose,det,trace,inv,rank,rref,rrefinfo,eye,zeros,frobenius,linsolve,solveinfo,eig,eigenvectors,eiginfo,lu,qr,svd,pinv,lstsq});
export const algebraArities = Object.freeze(Object.fromEntries(Object.entries(algebraFunctions).map(([name,fn]) => [name,fn.length])));
export function callAlgebra(name, args) {
  const fn = algebraFunctions[name];
  if (!fn || args.length !== algebraArities[name]) fail('ARGUMENTS', `${name}: esperados ${algebraArities[name]} argumentos.`);
  const result = fn(...args);
  const check = value => {
    if (typeof value === 'number' && !Number.isFinite(value)) fail('OVERFLOW', 'Resultado fora do alcance da precisão dupla.');
    if (Array.isArray(value)) value.forEach(check);
  };
  if (result && !Array.isArray(result) && typeof result === 'object') {
    for (const field of ['value','Q','R','P','L','U','S','Vt']) if (result[field] != null) check(result[field]);
  } else check(result);
  return result;
}
