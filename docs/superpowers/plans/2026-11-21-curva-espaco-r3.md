# Curva no espaço (ℝ³) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Curva ganha uma vista 3D (ℝ³) com a mesma sintaxe de comandos: pontos, vetores, operações vetoriais desenhadas, retas, planos, posições/interseções/distâncias/ângulos, espaço gerado, sistemas 3×3 como planos, matrizes 3×3, quádricas e cortes — sem dependências externas.

**Architecture:** Núcleo puro em `src/space3d/` (câmera/projeção, cena de primitivas, geometria 3D, malhas), testável com `node --test`; desenho em Canvas 2D por algoritmo do pintor (`render3d.js`); `geometry.js` delega para `geometry3d.js` quando o objeto é 3D e devolve o formato de resultado atual com `dim: 3` e `scene3d`; `app.js` ganha só o ramo de desenho, o botão 2D | 3D, a interação de câmera e o campo de estado `view3d`.

**Tech Stack:** JavaScript ES modules sem build, Canvas 2D, `node --test` (com os testes de boot de DOM falso já existentes).

**Spec:** `docs/superpowers/specs/2026-11-21-curva-espaco-r3-design.md` (leia inteiro antes de qualquer task; §5.2 é o contrato de sintaxe, §7a resolve as dúvidas de roteamento, nomes, dimensões, estilo, interação, desempenho e estado).

## Global Constraints

- Sem dependências de execução (README: "sem dependências de execução ou servidor de aplicação"); nada de Three.js/Plotly/WebGL libs.
- Nenhuma regressão 2D: `npm test` inteiro verde ao fim de cada task; linhas **sem a variável `z`** seguem exatamente os analisadores atuais (§7a.3).
- Estado salvo continua `version: 1` (`src/storage.js`, chave `curva-state-v1`); novos campos opcionais; estados antigos carregam igual.
- Interface e mensagens em português do Brasil, no tom das atuais.
- Formato de resultado de geometria preservado (`result(type,label)` em `src/geometry.js`: `info, points, segments, lines, vectors, polygons, conics, angles, matrix, definitions`), acrescido de `dim: 3` e `scene3d: Primitive[]` nos objetos 3D.
- Desempenho por orçamento: no máximo **6000 polígonos por cena** em repouso; malha de quádrica **48×48** em repouso e **20×20** durante o arrasto da câmera.
- Temas: cores lidas das variáveis CSS existentes (`style.css`), redesenho na troca de tema; layout utilizável a 390 px.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; branch `espaco-r2-r3`; nada de push nem merge.

## Review Focus

1. **Entradas degeneradas** (plano por 3 pontos colineares, normal nula, vetor diretor nulo, `ger` de vetores nulos, interseção de planos paralelos): erro ou "vazio" em português, nada de NaN desenhado — testes na Task 4 e na Task 5.
2. **Sliders levando o objeto a degenerar no meio do arrasto** (ex.: `plano: k*x + y = 1` com k = 0 é válido; `vetor: u=(k,0,0)` com k = 0 dá vetor nulo): sem exceção não tratada; a linha mostra aviso e a cena omite o objeto — teste na Task 4.
3. **Linhas 2D intocadas**: equações sem `z`, `ponto: A=(1,2)`, `conica:`, implícitas e inequações continuam com o mesmo resultado; estado v1 sem `view3d` carrega — testes na Task 3 e na Task 6.
4. **Objetos fora da caixa de recorte** (reta que não cruza a caixa, plano quase paralelo à linha de visão, ponto muito distante): recorte devolve vazio sem erro — teste na Task 1.
5. **Troca de tema e redimensionamento com a vista 3D aberta** (inclusive 390 px): redesenho com as cores novas, botões visíveis — conferência manual registrada na Task 3 e teste de `colorsFromTheme` na Task 1.

---

### Task 1: Câmera, cena e desenho 3D (núcleo puro)

**Files:**
- Create: `src/space3d/camera.js`, `src/space3d/scene3d.js`, `src/space3d/render3d.js`
- Test: `test/space3d-core.test.mjs`

**Interfaces:**
- Produces:
  - `createCamera(opts?) -> Camera` com `Camera = {azimuth, elevation, distance, target:[x,y,z], projection:'ortho'|'perspective', scale}`; padrão `azimuth:-60, elevation:25` (graus), `projection:'ortho'`, `target:[0,0,0]`.
  - `orbit(camera, dAzimuth, dElevation) -> Camera` (elevação limitada a [−89, 89]); `zoomCamera(camera, factor) -> Camera`; `panCamera(camera, dx, dy) -> Camera`; `presetView(name) -> {azimuth, elevation}` para `'xy' | 'xz' | 'yz' | 'iso'`.
  - `projectPoint(camera, [x,y,z], viewport) -> {x, y, depth}` com `viewport = {width, height}`; profundidade maior = mais longe.
  - Primitivas (`scene3d.js`): `{kind:'point', p, label?}`, `{kind:'segment', a, b, dash?:boolean, weight?}`, `{kind:'arrow', from, to, label?}`, `{kind:'polygon', points:[[x,y,z],…], alpha}`, `{kind:'mesh', vertices:[[x,y,z],…], faces:[[i,j,k,l?],…], alpha}`, `{kind:'label', p, text}`; todas aceitam `role?: 'main'|'aux'` (aux = tracejado/mais claro, §7a.5).
  - `defaultBox() -> {min:[-5,-5,-5], max:[5,5,5]}`; `clipSegmentToBox(a, b, box) -> [a,b] | null`; `clipLineToBox(p, v, box) -> [a,b] | null`; `clipPlaneToBox(n, d, box) -> [[x,y,z],…]` (polígono convexo de n·X = d dentro da caixa, ordenado; `[]` se não corta).
  - `axesPrimitives(box) -> Primitive[]` (eixos x, y, z com rótulos e marcas inteiras).
  - `buildDrawList(primitives, camera, viewport) -> DrawItem[]` (projeta; polígonos e faces de malha ordenados de trás para frente por profundidade do centroide; segmentos/setas/pontos depois das superfícies que estão atrás deles por profundidade média; rótulos por último).
  - `drawScene3d(ctx, drawList, colors)` e `colorsFromTheme(getVar) -> {axis, grid, text, bg}` (`getVar(name)` lê variável CSS).
- [ ] **Step 1: Write the failing tests** em `test/space3d-core.test.mjs`:
  - `projectPoint` com `presetView('xy')` (azimuth −90, elevation 90) leva `[1,0,0]` para a direita e `[0,1,0]` para cima do centro.
  - `orbit(createCamera(), 0, 200).elevation === 89`.
  - `clipPlaneToBox([0,0,1], 0, defaultBox())` devolve 4 pontos com z = 0 nos cantos ±5; `clipPlaneToBox([0,0,1], 9, defaultBox())` devolve `[]`.
  - `clipLineToBox([20,20,20],[1,0,0],defaultBox()) === null`; `clipSegmentToBox([0,0,0],[10,0,0],box)` termina em x = 5.
  - `buildDrawList` com dois polígonos em z = 1 e z = −1 vistos de cima (`'xy'`): o de z = −1 vem antes.
  - `colorsFromTheme(n => ({'--fg':'#111','--bg':'#fff'})[n])` devolve cores não vazias.
- [ ] **Step 2: Run** `node --test test/space3d-core.test.mjs` → FAIL (módulos ausentes).
- [ ] **Step 3: Implement** os três módulos. Projeção ortográfica: rotação por azimute (em torno de z) e elevação, escala `scale` px por unidade, centro do viewport; perspectiva: divide por `(distance - depth)`. Recorte de plano: interseção do plano com as 12 arestas da caixa, deduplicar, ordenar pelo ângulo em torno do centroide no plano.
- [ ] **Step 4: Run** `node --test test/space3d-core.test.mjs` → PASS; `npm test` → tudo verde.
- [ ] **Step 5: Commit** `feat: núcleo 3D (câmera, cena, recorte e desenho)`.

### Task 2: Pontos, vetores e segmentos 3D no analisador

**Files:**
- Create: `src/space3d/geometry3d.js`
- Modify: `src/geometry.js` (`parsePoint`, `parseVectorCommand`, `runCommand`, `define`, `addGeometryDefinitions`)
- Test: `test/space3d-geometry.test.mjs`

**Interfaces:**
- Consumes: primitivas e `clip*` da Task 1.
- Produces:
  - Pontos com 3 coordenadas: `{x, y, z, label, dim:3}`; pontos 2D ganham `dim:2` (sem mudar `x, y`).
  - `toVec3(point) -> [x,y,z]` (2D → z = 0, §7a.4) em `geometry3d.js`.
  - Resultado 3D: o formato atual + `dim:3` + `scene3d: Primitive[]`; definições registradas com `value.dim`.
  - `parse3dCommand(command, body, ctx, definitionName) -> result | null` em `geometry3d.js` (a ser estendida pelas Tasks 4, 5, 7, 9, 10); `geometry.js#runCommand` chama-a primeiro quando algum literal tem 3 coordenadas ou alguma referência tem `dim:3` (helper `involves3d(body, ctx) -> boolean`).
- [ ] **Step 1: Write the failing tests:**
  - `parseGeometryInput('ponto: A=(1,2,3)')` → `type:'point'`, `dim:3`, `scene3d` com 1 `point` em `[1,2,3]` rotulado `A`; `definitions[0].value.dim === 3`.
  - `A = (1,2,3)` como definição funciona igual.
  - `vetor: u=(1,2,3)` → seta de `[0,0,0]` a `[1,2,3]`, `info` contém `|u| = 3.74166`.
  - Com registro contendo `A=(1,0,0)` (3D) e `B=(0,1)` (2D): `vetor: A, B` → seta de `[1,0,0]` a `[0,1,0]` e `info` com aviso de promoção para z = 0.
  - `ponto: A=(1,2)` continua idêntico ao atual (`dim:2`, sem `scene3d`) — compare com o resultado antes da mudança (mesmos `points`, `info`).
  - `ponto: A=(k,0,1)` com `params:{k:2}` → `[2,0,1]`.
- [ ] **Step 2: Run** `node --test test/space3d-geometry.test.mjs` → FAIL.
- [ ] **Step 3: Implement** a leitura de 3 coordenadas em `parsePoint` (aceitar 2 ou 3; mensagem "ponto precisa de duas ou três coordenadas"), o roteamento `involves3d` e os casos `point`/`vector` em `parse3dCommand`.
- [ ] **Step 4: Run** o arquivo novo e `npm test` → verde.
- [ ] **Step 5: Commit** `feat: pontos e vetores em ℝ³`.

### Task 3: Vista 3D no aplicativo

**Files:**
- Create: `src/space3d/view3d.js`
- Modify: `src/app.js` (laço de desenho ~l.4904, estado salvo ~l.172/2292, barra da área de desenho), `src/accessibility.js` (`describeCanvas`), `index.html`, `style.css`
- Test: `test/boot-space3d.test.mjs`, `test/accessibility.test.mjs`

**Interfaces:**
- Consumes: Task 1 (`createCamera`, `orbit`, `zoomCamera`, `panCamera`, `presetView`, `buildDrawList`, `drawScene3d`, `axesPrimitives`, `colorsFromTheme`), Task 2 (`eq.geometry.dim`, `eq.geometry.scene3d`).
- Produces:
  - Estado global `view3d = {mode:'2d'|'3d', camera}` salvo no estado v1 como campo opcional `view3d`.
  - `decideViewMode({previousHas3d, nowHas3d, current}) -> '2d'|'3d'` (puro, em `view3d.js`): muda para `'3d'` só na transição sem-3D → com-3D (§5.1, §7a.10).
  - `attachCameraControls(canvas, getCamera, setCamera, requestDraw)`: arrastar = `orbit` (0,4°/px), roda/pinça = `zoomCamera`, Shift+arrastar ou dois dedos = `panCamera`, duplo clique = câmera padrão, setas/+/− no canvas focado.
  - Botões: **2D | 3D**, vistas **xy xz yz iso**, **orto/persp**; ocultos fora da vista 3D exceto o 2D | 3D (que só aparece quando há algum objeto 3D).
  - `describeCanvas({..., view3d, scene3dObjects})` acrescenta "Vista 3D: N objetos (…); câmera azimute A°, elevação E°".
- [ ] **Step 1: Write the failing tests:**
  - `decideViewMode({previousHas3d:false, nowHas3d:true, current:'2d'}) === '3d'`; `({previousHas3d:true, nowHas3d:true, current:'2d'}) === '2d'`.
  - Boot (padrão de `test/boot-geometry.test.mjs`) com estado salvo contendo `ponto: A=(1,2,3)` e `view3d:{mode:'3d'}`: inicializa sem exceção e chama o desenho 3D (espie `drawScene3d` via contexto falso).
  - Boot com estado v1 antigo sem `view3d` (cópia de um estado de `test/boot-geometry.test.mjs`): mesmo comportamento de antes.
  - `describeCanvas` com `view3d:{mode:'3d', camera:createCamera()}` contém "Vista 3D".
- [ ] **Step 2: Run** os testes novos → FAIL.
- [ ] **Step 3: Implement.** No laço de desenho: se `view3d.mode==='3d'`, desenhar fundo + `axesPrimitives` + a `scene3d` de cada linha visível (`dim:3`, e as 2D promovidas a z = 0 via `toVec3`), com cor da linha; linhas não geométricas mostram "não aparece na vista 3D". Na vista 2D, linhas `dim:3` mostram "objeto 3D: abra a vista 3D". Durante o arrasto, marcar `camera.dragging=true` (usado pela Task 9 para malha grossa).
- [ ] **Step 4: Run** `npm test` → verde. Conferência manual (`python3 -m http.server 8000`): girar, zoom, vistas prontas, troca de tema com a vista aberta, 390 px; registre no relatório.
- [ ] **Step 5: Commit** `feat: vista 3D com câmera orbital e alternância 2D | 3D`.

### Task 4: Retas e planos, posições, interseções, distâncias e ângulos

**Files:**
- Modify: `src/space3d/geometry3d.js`, `src/geometry.js` (`COMMAND_ALIASES`: `plano/plane`, `posicao/position`; `reta`, `intersecao`, `distancia`, `angulo` passam a aceitar 3D)
- Test: `test/space3d-lines-planes.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces (puras, exportadas de `geometry3d.js`):
  - `Line3 = {p:[x,y,z], v:[x,y,z]}`, `Plane = {n:[a,b,c], d}` (n·X = d).
  - `lineFromPoints(A,B)`, `lineFromPointDir(P,v)`, `parseLine3(body, ctx) -> Line3` (formas: `A, B`; `P=(…), v=(…)`; `(…) + t*(…)`; `x = 1+2t, y = …, z = …`; simétrica `(x-1)/2 = (y+1)/3 = z/1`).
  - `planeFromPoints(A,B,C)`, `planeFromPointNormal(P,n)`, `planeFromPointDirs(P,u,v)`, `parsePlane(body, ctx) -> Plane` (equação linear em x, y, z com multiplicação implícita `2x`; `A, B, C`; `P=…, n=…`; `P=…, u=…, v=…`).
  - `intersectLinePlane(l, π) -> {kind:'point'|'none'|'contained', point?}`, `intersectPlanes(π1, π2) -> {kind:'line'|'none'|'same', line?}`, `intersectThreePlanes(π1,π2,π3) -> {kind:'point'|'line'|'plane'|'none', …}`, `intersectLines3(r, s) -> {kind:'point'|'parallel'|'same'|'skew', point?}`.
  - `distancePointPlane`, `distancePointLine`, `distanceLines(r,s) -> {value, closest:[P,Q]}` (perpendicular comum para reversas), `distancePlanes`.
  - `angleBetween(objA, objB) -> graus` para reta–reta (0–90), reta–plano, plano–plano.
  - `relativePosition(objA, objB) -> string` com os textos de §5.2 ("concorrentes", "paralelas", "coincidentes", "reversas"; "fura", "paralela", "contida"; "concorrentes", "paralelos", "coincidentes").
  - Cena: reta → segmento recortado pela caixa; plano → polígono `alpha 0.25` recortado; perpendicular comum e projeções com `role:'aux'`.
  - Registro: `kind:'line3'` e `kind:'plane'`; nomes de planos aceitam `π`, `p1`, `alfa`.
- [ ] **Step 1: Write the failing tests** (valores exatos):
  - `parsePlane('2x - y + z = 3')` → `n=[2,-1,1], d=3`; `planeFromPoints([1,0,0],[0,1,0],[0,0,1])` ∝ `x+y+z=1`.
  - `planeFromPoints` com pontos colineares lança erro "pontos colineares: não determinam um plano".
  - `intersectLinePlane({p:[0,0,0],v:[1,1,1]}, {n:[1,1,1],d:3}).point` = `[1,1,1]`; com `v=[1,-1,0]` → `kind:'none'`.
  - `intersectPlanes(x+y+z=1, x−y=0)` → reta com direção ∥ `[1,1,-2]` e ponto que satisfaz as duas.
  - `intersectThreePlanes` de `x+y+z=6, x−y=0, z=2` → ponto `[2,2,2]`.
  - `distancePointPlane([1,2,3], {n:[2,-1,2],d:1}) = 5/3`.
  - Reversas `r: (0,0,0)+t(1,0,0)`, `s: (0,1,1)+t(0,1,0)` → `distanceLines = 1`, `relativePosition = 'reversas'`.
  - `angleBetween(plano z=0, plano x+z=0) = 45`.
  - `parseGeometryInput('plano: k*x + y = 1', {params:{k:0}})` → plano válido `y = 1`; `parseGeometryInput('reta: P=(0,0,0), v=(k,0,0)', {params:{k:0}})` → `type:'error'` com "vetor diretor nulo", sem lançar.
  - Simétrica `(x-1)/2 = (y+1)/3 = z/1` → `p=[1,-1,0]`, `v=[2,3,1]`.
- [ ] **Step 2: Run** `node --test test/space3d-lines-planes.test.mjs` → FAIL.
- [ ] **Step 3: Implement.** Tolerâncias relativas à escala das entradas (como `linear-algebra.js`), mensagens em português.
- [ ] **Step 4: Run** o arquivo e `npm test` → verde.
- [ ] **Step 5: Commit** `feat: retas e planos no espaço`.

### Task 5: Operações vetoriais desenhadas e espaço gerado

**Files:**
- Modify: `src/space3d/geometry3d.js`, `src/geometry.js` (`COMMAND_ALIASES`: `soma/sum`, `escala/scale`, `vetorial/cross`, `misto/triple`, `paralelepipedo/parallelepiped`, `ger/span`; `produto/escalar/dot` e `projecao` aceitam 3D)
- Test: `test/space3d-vectors.test.mjs`

**Interfaces:**
- Consumes: `cross, dot, proj, angle, rank` de `src/linear-algebra.js`; Tasks 1–2.
- Produces: resultados `type` `'sum' | 'scale' | 'dot' | 'cross' | 'triple' | 'span'` com `dim:3`, `info` e `scene3d`:
  - `soma: u, v` → setas u, v, u+v e o paralelogramo (`role:'aux'`).
  - `escala: k, u` e `vetor: 2*u` → seta de k·u.
  - `escalar: u, v` → `info` com u·v e ângulo; seta da projeção de u sobre v (`role:'aux'`).
  - `vetorial: u, v` → seta u×v, paralelogramo de u e v, `info` "área = |u×v|".
  - `misto: u, v, w` / `paralelepipedo: u, v, w` → 6 faces `alpha 0.2` + 12 arestas, `info` "[u,v,w] = …; volume = |…|"; coplanares → "vetores coplanares: volume 0".
  - `ger: u[, v[, w]]` → reta pela origem, plano pela origem ou "todo o ℝ³" (caixa sombreada leve), `info` com o posto e aviso de LD; todos nulos → "ger{0} = {0}" com ponto na origem.
- [ ] **Step 1: Write the failing tests:**
  - `vetorial: u=(1,2,3), v=(4,5,6)` → seta até `[-3,6,-3]`, `info` contém "área = 7.34847".
  - `misto: (1,0,0),(0,1,0),(0,0,1)` → `info` "[u,v,w] = 1"; `(1,0,0),(0,1,0),(1,1,0)` → "coplanares".
  - `soma: (1,0,0),(0,2,0)` → seta da soma em `[1,2,0]`.
  - `ger: (1,0,0),(2,0,0)` → posto 1, cena com uma reta; `ger: (1,0,0),(0,1,0)` → plano z = 0; `ger: (0,0,0)` → ponto.
  - `escalar: u=(3,4,0), v=(1,0,0)` → u·v = 3, projeção `[3,0,0]`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** o arquivo e `npm test` → verde.
- [ ] **Step 5: Commit** `feat: operações vetoriais e espaço gerado em ℝ³`.

### Task 6: Linhas sem prefixo e rótulos-palavra-chave

**Files:**
- Modify: `src/geometry.js` (`parseGeometryInput`, `extractGeometryParams`), `src/app.js` (`recompileEq`, só se o roteamento exigir), `src/parser.js` (somente se `z` precisar de proteção)
- Test: `test/space3d-routing.test.mjs`

**Interfaces:**
- Consumes: `parsePlane`, `parseLine3` (Task 4); a Task 9 acrescentará quádricas a este mesmo roteamento.
- Produces: `detect3dEquation(text) -> {kind:'plane'|'line3'|'quadric'|'other', degree}` em `geometry3d.js`; `extractGeometryParams` ignora rótulos `P=, n=, v=, u=, w=` dentro de argumentos e a variável ligada `t` (§7a.2).
- [ ] **Step 1: Write the failing tests:**
  - `parseGeometryInput('x + y + z = 3')` → plano `n=[1,1,1], d=3`.
  - `parseGeometryInput('(x-1)/2 = (y+1)/3 = z')` → reta 3D.
  - `parseGeometryInput('x^2 + y^2 = 4')` → `null` (continua sendo tratada pelo caminho implícito 2D atual).
  - `parseGeometryInput('x^3 + z = 1')` → erro "equação em x, y, z de grau 3: a Curva desenha planos (grau 1) e quádricas (grau 2)".
  - `extractGeometryParams('plano: P=(1,0,0), n=(2,-1,k)')` → `['k']` (sem `n`, sem `p`).
  - `extractGeometryParams('reta: (1,2,3) + t*(1,0,a)')` → `['a']`.
  - Confirme e registre no relatório se `z` tem uso atual em `src/parser.js`; se tiver, teste que esse uso continua igual.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (prefixos explícitos vencem; sem prefixo, só linhas com `z` entram no reconhecedor 3D). **Step 4: Run** o arquivo e `npm test` → verde (inclusive `parser-implicit`, `parser-inequality`, `boot-implicit`).
- [ ] **Step 5: Commit** `feat: equações em x, y, z sem prefixo`.

### Task 7: Sistemas 3×3 como planos e matrizes 3×3

**Files:**
- Create: `src/space3d/transform3d.js`
- Modify: `src/app.js` (~l.984 `buildSystemScene` para 3×3; botão "ver planos" ~l.1809; `transformScene` para 3×3), `src/geometry.js` (`parseMatrixCommand` aceita 3×3)
- Test: `test/space3d-transform.test.mjs`

**Interfaces:**
- Consumes: `solveinfo, det, matmul` de `linear-algebra.js`; `parsePlane`/`intersectThreePlanes` (Task 4); Task 1.
- Produces:
  - `buildPlanesScene(A, b, classification, solution) -> {dim:3, scene3d, info}` (3 planos com alphas distintos + ponto/reta solução).
  - `buildTransform3dScene(A, {t=1}) -> {dim:3, scene3d, info}` com `A(t) = (1−t)I + tA`: cubo unitário (arestas tracejadas), imagem (paralelepípedo), base e imagens, `info` "det = … (fator de volume)".
  - O botão existente "ver retas" passa a "ver planos" quando A é 3×3.
- [ ] **Step 1: Write the failing tests:**
  - `buildPlanesScene([[1,1,1],[1,-1,0],[0,0,1]],[6,0,2],'unique',[2,2,2])` → 3 polígonos + ponto `[2,2,2]`.
  - Sistema com infinitas soluções (`x+y+z=1`, `2x+2y+2z=2`, `x−y=0`) → cena com uma reta solução.
  - `buildTransform3dScene([[2,0,0],[0,1,0],[0,0,1]])` → `info` "det = 2"; vértice `[1,1,1]` vai para `[2,1,1]`.
  - `parseGeometryInput('matriz: [1,0,0; 0,1,0; 0,0,1]')` → `dim:3`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** o arquivo e `npm test` → verde; conferência manual do "ver planos" e da animação 3×3.
- [ ] **Step 5: Commit** `feat: sistemas 3×3 como planos e transformações 3×3`.

### Task 8: Autovalores de matrizes 3×3 simétricas

**Files:**
- Modify: `src/linear-algebra.js` (`eiginfo`, `eig`, `eigenvectors`), `src/space3d/transform3d.js`, `README.md` (seção "Contrato e precisão")
- Test: `test/linear-algebra.test.mjs`

**Interfaces:**
- Produces: `eiginfo(A)` aceita 3×3 **simétrica** (Jacobi), mesmo contrato (§5.5): `value` crescente, `eigenvectors` unitários por linha, `pairs` com multiplicidades; 3×3 não simétrica → `AlgebraError` com `code` existente para fora de escopo e mensagem "autovalores 3×3: só matrizes simétricas".
  - `buildTransform3dScene` (Task 7, `src/space3d/transform3d.js`) passa a desenhar as três direções próprias (`role:'aux'`, rotuladas "λ = …") quando A é simétrica.
- [ ] **Step 1: Write the failing tests:** `eig([[2,0,0],[0,3,4],[0,4,9]])` ≈ `[1,2,11]`; `eig([[2,1,1],[1,2,1],[1,1,2]])` ≈ `[1,1,4]` e cada par satisfaz ‖Av − λv‖ < 1e-9; não simétrica 3×3 lança com a mensagem; os testes 2×2 existentes continuam iguais; `buildTransform3dScene([[2,1,0],[1,2,0],[0,0,3]])` tem 3 rótulos "λ =" (valores 1, 3, 3).
- [ ] **Step 2: Run** `node --test test/linear-algebra.test.mjs` → FAIL. **Step 3: Implement** Jacobi cíclico (máx. 50 varreduras, tolerância relativa). **Step 4: Run** → PASS; `npm test` verde.
- [ ] **Step 5: Commit** `feat: autovalores de matrizes 3×3 simétricas`.

### Task 9: Quádricas

**Files:**
- Create: `src/space3d/quadric.js`
- Modify: `src/space3d/geometry3d.js` (`detect3dEquation` grau 2), `src/geometry.js` (`COMMAND_ALIASES`: `quadrica/quadric`)
- Test: `test/space3d-quadric.test.mjs`

**Interfaces:**
- Consumes: `eiginfo` 3×3 (Task 8); `detect3dEquation` (Task 6); `camera.dragging` (Task 3).
- Produces:
  - `parseQuadric(text, ctx) -> {A:3×3 simétrica, b:[3], c}` (equação xᵀAx + bᵀx + c = 0; termos cruzados `x*y`, `x*z`, `y*z`).
  - `classifyQuadric(q) -> {type, center?, axes?, eigen?}`; `type ∈ {'elipsoide','hiperboloide de uma folha','hiperboloide de duas folhas','paraboloide elíptico','paraboloide hiperbólico','cone','cilindro elíptico','cilindro hiperbólico','cilindro parabólico','par de planos','plano duplo','reta','ponto','vazio'}`.
  - `quadricMesh(q, {resolution, box}) -> mesh primitive(s)` por parametrização de cada tipo no referencial principal (centro + autovetores), recortada pela caixa; `resolution` 48 em repouso e 20 com `camera.dragging`; total ≤ 6000 polígonos por cena.
  - Resultado `type:'quadric'`, `info` com tipo, centro, autovalores e (se houver termos cruzados) "eixos principais: …".
- [ ] **Step 1: Write the failing tests:**
  - `x^2/4 + y^2/9 + z^2 = 1` → `'elipsoide'`, semieixos 2, 3, 1.
  - `x^2 + y^2 - z^2 = 1` → `'hiperboloide de uma folha'`; `x^2 + y^2 - z^2 = -1` → duas folhas; `x^2 + y^2 - z^2 = 0` → `'cone'`.
  - `z = x^2 + y^2` → `'paraboloide elíptico'`; `z = x^2 - y^2` → `'paraboloide hiperbólico'`; `x^2 + y^2 = 4` **com prefixo** `quadrica:` → `'cilindro elíptico'`.
  - `x^2 + y^2 + z^2 = -1` → `'vazio'` (cena vazia, sem erro).
  - `2*x*y + z^2 = 1` → autovalores 1, 1, −1, `'hiperboloide de uma folha'`.
  - `quadricMesh` do elipsoide com `resolution:48` → ≤ 6000 faces; com `resolution:20` → menos faces; todos os vértices satisfazem a equação com erro < 1e-6.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** o arquivo e `npm test` → verde; conferência manual (girar um elipsoide e um hiperboloide; troca de tema).
- [ ] **Step 5: Commit** `feat: quádricas no espaço`.

### Task 10: Cortes de quádricas por planos

**Files:**
- Modify: `src/space3d/quadric.js`, `src/space3d/geometry3d.js`, `src/geometry.js` (`COMMAND_ALIASES`: `corte/section`)
- Test: `test/space3d-section.test.mjs`

**Interfaces:**
- Consumes: Tasks 4, 9; classificador de cônicas existente (`parseConicSpec`/`parseConicCommand` em `geometry.js`).
- Produces: `sectionQuadric(q, plane) -> {type, curve3d:[[x,y,z],…][], conicEquation?}`; comando `corte: <nome ou equação da quádrica>, <nome ou equação do plano>`. Plano coordenado (`z = k`, `x = k`, `y = k`) → `conicEquation` nas outras duas variáveis + análise de `conica:`; plano qualquer → só `type` (elipse, hipérbole, parábola, par de retas, uma reta, um ponto, vazio) e a curva (§7a.8).
- [ ] **Step 1: Write the failing tests:**
  - Elipsoide `x^2/4 + y^2/9 + z^2 = 1` cortado por `z = 0` → `'elipse'`, `conicEquation` equivalente a `x^2/4 + y^2/9 = 1`.
  - Cone `x^2 + y^2 - z^2 = 0` com `z = 1` → circunferência; com `y + z = 1` (plano paralelo a uma geratriz) → `'parábola'`; com `z = 0` → `'ponto'`; com `x = 0` → `'par de retas'`.
  - `corte: Q, p1` com `Q` e `p1` definidos por nome funciona; nome inexistente → erro em português.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** o arquivo e `npm test` → verde.
- [ ] **Step 5: Commit** `feat: cortes de quádricas por planos`.

### Task 11: Presets, aula "Espaço" e README

**Files:**
- Modify: `src/presets.js`, `src/lessons.js` (ou `src/algebra-lessons.js`, seguindo o padrão das aulas de álgebra), `README.md`, `index.html` (se a aba de presets precisar de rótulo)
- Test: `test/lessons.test.mjs`, `test/space3d-presets.test.mjs`

**Interfaces:**
- Consumes: todos os comandos das Tasks 2–10.
- Produces: grupo de presets **Espaço** (vetores e produto vetorial; reta furando plano; três planos; paralelepípedo; quádricas; seções do cone; transformação 3×3) e uma aula "Espaço" com checkpoints que verificam propriedades calculadas (ex.: interseção reta–plano = (1,1,1); volume do paralelepípedo = 1; tipo da quádrica); seção "Espaço (ℝ³)" no README com a sintaxe de §5.2 e os limites (sem arrastar pontos em 3D; cortes por plano qualquer sem equação da cônica; superfícies paramétricas fora).
- [ ] **Step 1: Write the failing tests:** cada preset do grupo Espaço, analisado por `parseGeometryInput`, não gera `type:'error'`; a aula "Espaço" existe e seus checkpoints passam nos valores de referência.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` → verde; conferência manual de cada preset no navegador (claro, escuro, 390 px).
- [ ] **Step 5: Commit** `docs: presets e aula do espaço, README`.

---

Depois da Task 11: revisão de toda a branch; em seguida, no repositório do livro (tarefa separada, §5.6 E6), atualizar as receitas "🧮 Na Curva" que hoje mandam para o GeoGebra e a tabela "Limites da Curva" do Laboratório da Curva.
