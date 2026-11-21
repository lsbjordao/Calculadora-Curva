# Curva no espaço (ℝ³) — design

Data: 2026-11-21 · Branch: `espaco-r2-r3` · Repositório: `~/Repos/Calculadora-Curva`

## 1. Intenção e porquê

A Curva é usada no livro "Geometria Analítica e Álgebra Linear — do zero ao hero" (repo `~/Repos/Aula-Geometria-Analitica-e-Algebra-Linear`): cada capítulo tem uma seção "🧮 Na Curva" com receitas digitáveis, e o livro tem um "Laboratório da Curva" cuja tabela "Limites da Curva" lista o que falta. O maior limite é **desenhar no espaço**: vetores, retas, planos e quádricas vivem em ℝ³, e hoje o livro manda o aluno para o GeoGebra justamente nessas partes. O autor também dá aula com a Curva (projetor, notebook, tablet).

Objetivo: **tudo o que o livro de GAAL faz no espaço pode ser feito na Curva**, com a mesma sintaxe da Curva, sem dependências externas.

O ℝ² já está praticamente coberto pela Curva atual (`ponto:`, `vetor:`, `reta`, `intersecao`, `projecao`, `distancia`, `angulo`, `conica:` inclusive girada, `matriz:` 2×2 com malha e autovetores, `solveinfo` 2×2 com "ver retas"). Este projeto acrescenta o ℝ³ e só toca o ℝ² onde for preciso para conviver com ele.

## 2. Metas, não-metas, antimetas

**Metas**
1. Vista 3D na mesma área de desenho da Curva, com rotação por arrasto, zoom, vistas prontas e alternância 2D | 3D.
2. Objetos 3D digitados com a sintaxe atual estendida: pontos, vetores, segmentos, retas, planos, espaço gerado, paralelepípedo, quádricas, cortes, transformações 3×3, sistemas 3×3 como planos.
3. Operações de GAAL desenhadas, não só calculadas: soma de vetores, múltiplo, produto escalar (com projeção), vetorial (com paralelogramo e área), misto (com paralelepípedo e volume), interseções, distâncias, ângulos, posições relativas.
4. Os parâmetros escalares atuais (`a, b, c, d, k, m, n, p, q, r` com sliders) continuam funcionando nos objetos 3D, para animar em aula.
5. Funcionar bem nos dois temas (claro/escuro), em tela de celular (390 px) e em projetor.

**Não-metas (v1)**
- Iluminação realista, sombras, texturas; exportar modelos 3D; realidade aumentada.
- Superfícies implícitas arbitrárias `F(x,y,z) = 0` de grau > 2 (fica como possibilidade futura; ver §8).
- CAS simbólico 3D (forma exata de interseções etc. além do que `linear-algebra.js` já dá).
- Autovalores complexos ou matrizes 3×3 não simétricas com espectro complexo.

**Antimetas (falha mesmo que "funcione")**
- Quebrar qualquer comportamento 2D, teste existente ou estado salvo (versão 1 do estado em `storage.js` deve continuar carregando igual).
- Acrescentar dependência de execução (Three.js, Plotly, WebGL libs) — o README declara "sem dependências de execução".
- Sintaxe diferente da que o livro ensina: as receitas do livro devem funcionar digitadas como estão escritas.
- Ficar lenta num notebook comum de sala de aula: rotação a ~60 fps em cenas típicas de aula (alguns planos + uma quádrica + vetores).

## 3. Restrições

- JavaScript puro em módulos ES, sem build; testes com `node --test` (`npm test`), incluindo os testes de boot com DOM falso (`test/boot-*.test.mjs`).
- Canvas 2D já existente (`app.js` ~l.2958: `cv.getContext('2d')`); o desenho 2D vive em `app.js` (`drawGeometry` ~l.4578, chamado no laço principal ~l.4904).
- Comandos de geometria são analisados em `src/geometry.js` (`COMMAND_ALIASES`, `runCommand`, `parseGeometryInput`, `definitionInput`, registro de nomes com `addGeometryDefinitions`), e os resultados seguem o formato `result(type,label)` com listas `points, segments, lines, vectors, polygons, conics, angles, matrix, definitions, info`.
- Álgebra em `src/linear-algebra.js` (`dot, norm, cross, proj, angle, det, inv, rank, rref, solveinfo, eiginfo` …; `eig` hoje só 2×2 real).
- Interface em português do Brasil; acessibilidade: `describeCanvas` (`src/accessibility.js`) descreve a tela para leitores de tela.
- Temas por variáveis CSS (`--bg` etc. em `style.css`).

## 4. Abordagens consideradas

1. **Desenho 3D próprio em Canvas 2D (escolhida).** Projeção (ortográfica por padrão, perspectiva opcional) + ordenação por profundidade (algoritmo do pintor) + superfícies em malha semitransparente. Prós: zero dependências, mesmo visual da Curva, cenas testáveis sem navegador (funções puras que geram primitivas, como já faz `linear-transform-view.js`). Contra: superfícies que se cruzam podem ter pequenos erros de ordem frente/fundo; transparência + malha deixam isso aceitável para aula.
2. **WebGL feito à mão.** Profundidade correta e superfícies mais bonitas; muito mais código, testes difíceis, rótulos exigiriam uma camada extra.
3. **Biblioteca externa (Three.js/Plotly).** Mais rápido, mas viola o princípio de zero dependências. Descartada.

Escolha do autor do design (o usuário entregou o "como"): **1**, com o desenho isolado num módulo para que uma troca futura por WebGL não mexa nos comandos.

## 5. O que foi decidido

### 5.1 Uso e alternância 2D | 3D
- Mesma sintaxe; **um objeto é 3D quando tem 3 coordenadas** (ou é por natureza 3D: plano, quádrica, `ger` de vetores 3D, matriz 3×3).
- A vista vira 3D automaticamente quando aparece o primeiro objeto 3D visível; um botão **2D | 3D** na barra da área de desenho alterna manualmente, e a escolha manual vence a automática até a lista de objetos mudar de "nenhum 3D" para "algum 3D" de novo.
- Na vista 3D, objetos 2D (pontos/vetores/retas/cônicas do plano) aparecem no plano z = 0. Na vista 2D, objetos 3D não são desenhados; a linha mostra o aviso "objeto 3D: abra a vista 3D". (Escolha do design; ver §7.)
- Funções y = f(x) e demais tipos não geométricos não aparecem na vista 3D (aviso na linha).

### 5.2 Sintaxe (estende a atual; aliases em pt e en como hoje)
Pontos e vetores
- `ponto: A=(1,2,3)`, `A = (1,2,3)`, `ponto: A=(1,2,3), B=(0,1,-1)`.
- `vetor: u=(1,2,3)` (a partir da origem), `vetor: A, B` (de A até B), `vetor: (0,0,0),(1,2,3)`.
- Operações desenhadas: `soma: u, v` (regra do paralelogramo), `vetor: 2*u` ou `escala(k, u)`, `produto: u, v` / `escalar: u, v` (mostra u·v, ângulo e a projeção de u sobre v), `vetorial: u, v` (desenha u×v, o paralelogramo e a área), `misto: u, v, w` / `paralelepipedo: u, v, w` (desenha o sólido, mostra [u,v,w] e o volume), `projecao: u, v` (como hoje, em 3D).
Retas e planos
- `reta: A, B`, `reta(A, B)`, `reta: P=(1,2,3), v=(1,0,-1)`, `reta: (1,2,3) + t*(1,0,-1)`; também as formas simétricas `(x-1)/2 = (y+1)/3 = z/1`.
- `plano: 2x - y + z = 3`, `plano: A, B, C`, `plano: P=(1,0,0), n=(2,-1,1)`, `plano: P=(…), u=(…), v=(…)` (paramétrico).
- `intersecao: r, s` / `intersecao: r, π` / `intersecao: π1, π2` (reta) / três planos (ponto, reta ou vazio).
- `distancia: P, π`, `distancia: P, r`, `distancia: r, s` (inclui reversas, com o segmento perpendicular comum desenhado), `distancia: π1, π2` (paralelos).
- `angulo: r, s`, `angulo: r, π`, `angulo: π1, π2`.
- `posicao: r, s` / `posicao: r, π` / `posicao: π1, π2` → texto "concorrentes / paralelas / coincidentes / reversas", "fura / paralela / contida", "concorrentes / paralelos / coincidentes".
Espaço gerado
- `ger: u` (reta pela origem), `ger: u, v` (plano pela origem ou reta, se LD), `ger: u, v, w` (todo ℝ³ ou plano/reta, com aviso de LD), com o posto mostrado.
Sistemas 3×3
- `solveinfo(A, b)` com A 3×3 (já existente) ganha o botão **ver planos**, como hoje o 2×2 tem "ver retas": desenha os três planos e a solução (ponto, reta ou nada).
Transformações
- `matriz: [a,b,c; d,e,f; g,h,i]` 3×3 → cubo unitário e sua imagem (paralelepípedo), vetores da base e imagens, det como fator de volume, animação `A(t) = (1−t)I + tA` como a 2×2.
Quádricas e cortes
- `quadrica: x^2/4 + y^2/9 - z^2 = 1`; também reconhecida sem prefixo quando a linha é uma equação em x, y, z de grau 2. Classificação (elipsoide, hiperboloide de uma/duas folhas, paraboloide elíptico/hiperbólico, cone, cilindros elíptico/hiperbólico/parabólico, degeneradas) com o mesmo espírito do `conica:` (texto de análise na linha).
- Termos cruzados (`x*y`, `x*z`, `y*z`) permitidos: a classificação usa os autovalores da matriz simétrica 3×3 (ver §5.5).
- `corte: <nome da quádrica>, z = k` (ou qualquer plano): desenha a curva de interseção na superfície e mostra a cônica resultante (reaproveitando o classificador de `conica:` quando o plano é coordenado).
- `cone: ...` especial não é necessário: o cone é uma quádrica; as "seções do cone" do livro saem de `corte:` com plano inclinado.
Superfícies paramétricas ficam fora da v1 (ver §8).

Todos os números aceitam os parâmetros escalares atuais (sliders) e referências a nomes definidos (`A`, `u`, `π1`/`p1`).

### 5.3 Vista 3D
- Eixos x, y, z com rótulos e marcas; caixa de recorte (limites ajustáveis pelo zoom); grade opcional no plano z = 0.
- Câmera orbital: arrastar = girar (azimute/elevação), roda/pinça = zoom, arrastar com Shift ou dois dedos = mover; duplo clique = vista inicial; botões de vista pronta **xy, xz, yz, iso**; alternância ortográfica/perspectiva. Teclado (setas, +/−) para acessibilidade.
- Planos desenhados como polígonos semitransparentes recortados pela caixa; retas recortadas pela caixa; vetores como setas com ponta; pontos como discos; rótulos sempre por cima e sem sobrepor quando possível.
- Quádricas como malha semitransparente com linhas de grade da parametrização (resolução ajustada ao tamanho e ao desempenho).
- Cores e espessuras vêm da paleta/estilo atuais de cada linha (o editor de estilo existente continua valendo).
- `describeCanvas` ganha a descrição da cena 3D (objetos e câmera) em português.

### 5.4 Arquitetura
- Novos módulos (nomes indicativos): `src/space3d/geometry3d.js` (análise dos comandos 3D e contas: interseções, distâncias, ângulos, posições, classificação de quádricas; puro, sem DOM), `src/space3d/scene3d.js` (gera primitivas 3D: pontos, segmentos, setas, polígonos, malhas, rótulos; puro), `src/space3d/camera.js` (projeção e estado da câmera; puro), `src/space3d/render3d.js` (desenha no Canvas 2D: projeta, ordena, pinta), `src/space3d/view3d.js` (eventos de ponteiro/teclado e botões).
- `geometry.js` delega para `geometry3d.js` quando o comando ou as coordenadas forem 3D, devolvendo o mesmo formato de resultado com `dim: 3` e uma lista `scene3d`; nomes definidos continuam no mesmo registro (`addGeometryDefinitions`), com o tipo (ponto3, vetor3, reta3, plano, quadrica…).
- `app.js` só ganha o ramo de desenho (no laço principal) e o botão 2D | 3D; a lógica fica nos módulos novos.
- Estado salvo: continua `version: 1`; novos campos (vista 3D, câmera) são opcionais e ignorados por estados antigos.

### 5.5 Autovalores 3×3
- `eiginfo`/`eig`/`eigenvectors` passam a aceitar **3×3 simétricas** (método de Jacobi, como o livro já usa em `autoSimetrica3`), mantendo o contrato atual (autovalores em ordem crescente, vetores unitários por linha, `pairs`). Não simétricas 3×3 continuam com mensagem explícita (fora do escopo).
- Usado na classificação de quádricas com termos cruzados e para desenhar os eixos principais/autovetores na vista 3D (`matriz:` 3×3 simétrica mostra as três direções próprias).

### 5.6 Ordem de entrega
- **E1 — Núcleo:** vista 3D, câmera, eixos, alternância 2D | 3D, pontos, vetores, segmentos; testes de projeção e de boot com estado 3D.
- **E2 — Retas e planos:** todas as formas de reta e plano; interseções, distâncias, ângulos, posições; soma/escala/escalar/vetorial/misto desenhados; `ger`.
- **E3 — Sistemas e transformações:** "ver planos" no `solveinfo` 3×3; `matriz:` 3×3 com cubo, animação e det como volume.
- **E4 — Quádricas:** classificação, malhas, cortes (seções do cone incluídas).
- **E5 — Autovalores 3×3 simétricos:** `eiginfo` 3×3 + eixos principais das quádricas com termos cruzados.
- **E6 — Material didático:** presets e uma aula "Espaço" no painel de aulas; seção no README; (no repo do livro, em tarefa separada: atualizar as receitas "Na Curva" que hoje mandam para o GeoGebra e a tabela de limites do Laboratório da Curva).
Cada etapa termina com `npm test` verde, sem regressão no 2D, e conferência manual no navegador (temas claro/escuro, 390 px).

## 6. Deixado para quem constrói
- Resolução das malhas, regras exatas de recorte e de ordenação, desempenho.
- Posição dos rótulos e anti-sobreposição.
- Nomes exatos dos arquivos dentro de `src/space3d/` e a divisão interna.
- Layout fino dos botões (respeitando o estilo atual).
- Mensagens de erro (em português, no tom das atuais).

## 7. Decisões tomadas pelo autor do design (podem ser revistas pelo usuário)
- Alternância automática para 3D + botão manual (§5.1).
- Objetos 2D aparecem em z = 0 na vista 3D; objetos 3D não aparecem na vista 2D.
- Ortográfica como projeção padrão (melhor para medir e comparar com o papel), perspectiva opcional.
- Prefixo `quadrica:` opcional (equação de grau 2 em x, y, z é reconhecida).
- Nomes de planos: qualquer identificador (`p1`, `alfa`); `π` aceito como letra.

## 7a. Respostas à revisão do construtor (decisões do autor do design)
1. **Contrato de sintaxe:** §5.2 é o contrato. As receitas atuais do livro só usam comandos que a Curva já tem (`calc:`, `let`, `conica:`, `matriz:` 2×2, `solveinfo`…) e devem continuar funcionando sem mudança. A etapa E6 reescreve no livro as receitas 3D usando a sintaxe de §5.2. Ficam aceitos também, por serem comuns no livro: `π` como nome, `t` em formas paramétricas, `n` como rótulo de normal.
2. **Nomes de parâmetros × nomes 3D:**
   - Dentro de argumentos rotulados (`P=…`, `n=…`, `v=…`, `u=…`, `w=…`), o rótulo é palavra-chave do comando: não vira slider. A extração de parâmetros (`extractGeometryParams`) deve ignorar esses rótulos.
   - Definições `nome = …` seguem a regra atual: o preset existente já usa `r = reta(A,B)`, e a extração de parâmetros olha só o corpo da definição. Um nome definido é resolvido como objeto nas referências; os sliders continuam valendo nos números.
   - `t` é variável ligada somente dentro de `reta: … + t*…` e da forma `x = 1 + 2t, y = …, z = …`. Não é slider nem a variável de animação.
   - Estados salvos antigos não mudam.
3. **Roteamento de linhas sem prefixo:**
   - Os prefixos explícitos (`plano:`, `quadrica:`…) vencem sempre.
   - Sem prefixo, as linhas **que não contêm a variável `z`** seguem exatamente os analisadores atuais, sem regressão no 2D.
   - Uma equação com `z` vai para o reconhecedor 3D: grau 1 é plano, grau 2 é quádrica, outro grau dá erro em português. A forma com dois `=` em x, y, z (simétrica) é reta.
   - O construtor confirma no `parser.js` que `z` hoje não tem outro uso. Se tiver, documenta e protege.
   - A multiplicação implícita (`2x`) deve funcionar como nas cônicas atuais.
4. **Dimensões misturadas:**
   - Um ponto ou vetor 2D usado num comando com objetos 3D é promovido a z = 0.
   - O registro guarda a dimensão de cada objeto, e uma linha que referencia um nome 3D vira 3D.
   - Comprimentos incompatíveis em um mesmo literal, como `(1,2)` com `(3,4,5)`, também são promovidos, com aviso na linha.
5. **Estilo de resultados com vários objetos:**
   - Cada linha tem um estilo, como hoje. Os subobjetos derivam dele: faces e planos em versão semitransparente da cor da linha, arestas e setas sólidas, construções auxiliares (perpendicular comum, projeção, paralelogramo da soma) tracejadas ou mais claras.
   - Mostrar/ocultar, rótulos e o editor de estilo continuam por linha.
6. **Interação na vista 3D (v1):**
   - Apenas a câmera: girar, zoom, mover e as vistas prontas, mais uma leitura das coordenadas do ponto mais próximo do cursor, se for barato.
   - Arrastar pontos fica para depois. Em 3D a profundidade é ambígua, e os sliders já servem para animar em aula.
7. **Desempenho:**
   - O critério é um orçamento de primitivas: limite de polígonos por malha e por cena, e malha mais grossa durante o arrasto da câmera, refinada ao soltar.
   - Teste automático do orçamento, mais conferência manual no navegador.
8. **`corte:`**
   - Aceita o plano por nome ou pela equação na própria linha.
   - Para plano coordenado (`z = k` etc.), mostra a cônica com a equação nas outras duas variáveis, reaproveitando o classificador de `conica:`.
   - Para plano qualquer, mostra só o tipo (elipse, hipérbole, parábola, par de retas, uma reta, um ponto, vazio) e desenha a curva. A equação em coordenadas do plano fica para depois.
9. **`superficie:`** está fora da v1 e passa para §8.
10. **Estado da vista:**
    - Um campo global opcional `view3d` (modo 2D/3D e câmera), dentro do estado versão 1.
    - Ao recarregar, o modo salvo vale. A troca automática para 3D só acontece quando a lista passa de "nenhum objeto 3D" para "algum objeto 3D" durante a edição.

## 8. Futuro (fora da v1)
- Superfícies paramétricas `superficie: (u*cos(v), u*sin(v), u), u=0..2, v=0..2pi`.
- Arrastar pontos na vista 3D.
- Equação da cônica de um corte por plano qualquer em coordenadas do plano.
- Superfícies implícitas arbitrárias por malha (marching tetrahedra).
- Troca do desenho por WebGL mantendo a mesma cena.
- Link "abrir na Curva" a partir do livro com o estado na URL.
