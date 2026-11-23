# Curva

Calculadora científica e gráfica em JavaScript com geometria, estatística, cálculo e álgebra linear. Funciona como aplicação estática, sem dependências de execução ou servidor de aplicação.

Abra [a Curva](https://lsbjordao.github.io/Calculadora-Curva/) ou sirva este diretório localmente (`python3 -m http.server 8000`). Execute `npm test` para verificar a aplicação.

## Comandos pela URL (GET)

Passe um parâmetro **`cmd` por comando** na query string para abrir a Curva com
as linhas preenchidas e os resultados calculados automaticamente. A ordem e os
comandos repetidos são preservados. Por exemplo,
`?cmd=ponto%3A+A%3D%28-2%2C3%29&cmd=calc%3A+2%2B3` carrega
`ponto: A=(-2,3)` e `calc: 2+3` (resultado 5).

Gere os links com `URLSearchParams` para codificar corretamente sinais de `=`,
`+`, `&`, `%`, espaços e caracteres Unicode:

```js
const comandos = [
  'ponto: A=(-2,3), B=(4,-5)',
  'dist: A,B',
  'calc: ((-2)+4)/2',
  'calc: (3+(-5))/2',
  'calc: sqrt(2^2 + 3^2 + 6^2)'
];

const url = new URL('https://lsbjordao.github.io/Calculadora-Curva/');
comandos.forEach(cmd => url.searchParams.append('cmd', cmd));
console.log(url.href); // abra ou compartilhe este link
```

Esse exemplo mostra A e B, distância **10** e resultados **1**, **−1** e **7**.
Cada linha continua editável; erros aparecem na linha correspondente sem impedir
as demais. A edição recalcula as referências e salva a sessão como de costume.

Quando há comandos não vazios, a URL define uma cena nova com a vista padrão,
sem misturar as linhas da sessão salva. O tema claro ou escuro escolhido pelo
usuário é preservado, inclusive nos links com `cmd`. Sem tema salvo, a Curva
segue a preferência de cores do sistema ao abrir. Valores `cmd` vazios ou
compostos apenas de espaços são ignorados. Sem comandos úteis, a aplicação restaura a sessão anterior ou
abre o exemplo inicial. Não concatene comandos diretamente na URL: um `+` sem
codificação é interpretado como espaço; use `URLSearchParams` ou `%2B`.

Esta é uma entrada por URL executada no navegador: a resposta HTTP continua
sendo a página da calculadora, sem endpoint de resultados JSON. Não requer
servidor adicional. Para grandes listas, considere o limite de tamanho de URL
do navegador e da hospedagem. Os comandos são lidos ao abrir ou recarregar a página.

## Álgebra linear

A aba **álgebra** insere exemplos completos na linha selecionada. Edite os números ou use os parâmetros disponíveis. O cálculo é automático.

Use `calc:` para obter resultados numéricos sem traçar uma curva:

```text
calc: dot([1,2,3],[4,5,6])
calc: matmul([[1,2],[3,4]],[[2,0],[1,2]])
calc: inv([1,2;3,4])
calc: solveinfo([[1,1],[2,2]],[1,2])
calc: svd([[2,1],[0,1]])
```

Vetores usam `[1,2,3]`; matrizes usam `[[1,2],[3,4]]` ou `[1,2;3,4]`. Uma matriz com uma linha usa `[[1,2]]`. Arrays continuam aceitos pelas funções existentes. Operações entre arrays usam funções explícitas: `matmul(A,B)`, `matadd(A,B)` etc. Os operadores `+`, `-`, `*`, `/` e `^` continuam escalares e rejeitam arrays.

| Grupo | Funções |
| --- | --- |
| Vetores | `dot(u,v)`, `norm(v)`, `vadd(u,v)`, `vsub(u,v)`, `scale(k,v)`, `angle(u,v)`, `proj(u,v)`, `cross(u,v)` |
| Matrizes | `matadd(A,B)`, `matsub(A,B)`, `matmul(A,B)`, `transpose(A)`, `det(A)`, `trace(A)`, `inv(A)`, `rank(A)`, `rref(A)`, `eye(n)`, `zeros(m,n)`, `frobenius(A)` |
| Sistemas | `linsolve(A,b)`, `solveinfo(A,b)`, `lstsq(A,b)` |
| Autovalores | `eig(A)`, `eigenvectors(A)`, `eiginfo(A)` |
| Decomposições | `lu(A)`, `qr(A)`, `svd(A)`, `pinv(A)` |

`scale(k,A)` também aceita matrizes: `scale(2,inv(M))` calcula 2M⁻¹. Em `matmul`, um vetor à direita é lido como coluna (`matmul(A,[3,4])` = A·v) e à esquerda como linha; o produto volta como vetor. Dois vetores em `matmul` geram erro: use `dot(u,v)`.

Resultados matriciais informam o **tipo** da matriz quando ele se aplica: linha, coluna, nula, identidade, diagonal, triangular superior ou inferior, simétrica, antissimétrica e ortogonal (A Aᵀ = I), com tolerância relativa ao maior elemento.

`angle` retorna radianos; multiplique por `180/pi` para converter em graus. `proj(u,v)` projeta **u sobre v**. Ângulos com vetor nulo e projeções sobre vetor nulo apresentam erro. `cross` retorna um escalar em 2D e um vetor em 3D.

Os resultados exibem dimensões e propriedades disponíveis. **copiar texto** exporta matrizes como linhas e colunas separadas por tabulação; **copiar Curva** conserva a precisão numérica em sintaxe reutilizável. Decomposições oferecem cópia de cada fator. Se o navegador não permitir acesso à área de transferência, aparece um campo selecionável para cópia por teclado.

## Variáveis e atualização

```text
let M = [[a,b],[c,d]]
let N = matmul(@M,eye(2))
calc: inv(@N)
matriz: @M
```

Declarações `let` aceitam vetores e matrizes. Referências `@nome` são independentes dos parâmetros escalares e das definições geométricas existentes. Os nomes não diferenciam maiúsculas e minúsculas. Referências futuras são permitidas; nomes duplicados, referências ausentes e ciclos produzem erros. Alterar os parâmetros, editar, remover ou reordenar linhas recalcula os dependentes. O formato de estado permanece na versão 1 e preserva estados anteriores.

## Cônicas

`conica: equação` identifica circunferência, elipse, hipérbole e parábola e mostra centro ou vértice, semieixos, focos e diretrizes. Para elipse e hipérbole, informa também a orientação do eixo maior ou real, a semidistância focal `c` com a relação notável e a excentricidade `e = c/a`; a circunferência tem `e = 0` e a parábola, `e = 1`, com a direção de abertura. Toda cônica recebe o indicador `b^2 - 4ac` e o gênero (elíptico, parabólico ou hiperbólico).

Com termo `xy` (escreva `x*y`), a cônica é rotacionada: a análise mostra o tipo pelo discriminante e pelo determinante da matriz 3×3 da cônica (hipérbole, par de retas concorrentes, elipse, cônica sem pontos reais, parábola ou retas paralelas) e o ângulo de rotação dos eixos, `cot 2θ = (a − c)/b`. Focos e eixos de cônicas rotacionadas não são desenhados.

## Transformações e aulas

`matriz: [a,b; c,d]` mostra os vetores de base, a imagem do quadrado unitário, a malha transformada e as direções próprias reais. Em resultados matriciais 2×2 e em `svd`, abra **transformação 2D** para exibir esses elementos no Canvas.

Os controles permitem iniciar, pausar, reiniciar, ajustar o tempo e alternar malhas e direções próprias. No modo linear, `A(t) = (1−t)I + tA`. O determinante exibido corresponde à matriz intermediária, que pode ser singular. No modo SVD, as etapas aplicam `Vᵀ`, depois `Σ`, depois `U`; fatores ortogonais podem incluir reflexões. A interpolação entre etapas serve à explicação e pode atravessar matrizes singulares. A decomposição é reaproveitada enquanto os coeficientes não mudam.

`solveinfo` em sistemas 2×2 oferece **ver retas**, com linhas coincidentes, paralelas ou uma interseção única. Aulas e presets incluem vetores, produto escalar, composição, determinante, singularidade, autovetores, sistemas e SVD. Os checkpoints verificam propriedades calculadas.

## Contrato e precisão

O núcleo independente do DOM está em `src/linear-algebra.js`. Funções fundamentais retornam números ou arrays, sem modificar entradas. Falhas lançam `AlgebraError`, com `code`, `message` e `details`. Decomposições e diagnósticos retornam objetos discriminados com `kind`, `shape`, `metadata` e `warnings`:

- `solveinfo`: `value` é uma solução de norma mínima para sistemas consistentes, ou `null` para sistemas inconsistentes. `metadata.classification` é `unique`, `infinite`, `inconsistent` ou `ill-conditioned`; inclui posto, posto aumentado, resíduos da solução e resíduo de compatibilidade pela projeção de b no espaço das colunas de A. `linsolve` mantém o vetor numérico para sistemas quadrados com solução única e aceita também b como matriz coluna.
- `eiginfo`: `value` contém autovalores em **ordem crescente**, `eigenvectors` contém vetores unitários **por linha**, e `pairs` associa cada autovalor ao vetor e às multiplicidades. Uma matriz defeituosa informa apenas direções independentes. Os resíduos dos pares são calculados na matriz escalada por uma potência de dois. Em 3×3, aceita apenas matrizes **simétricas** (simetria com tolerância relativa de `10⁻¹²` ao maior elemento) e usa o método de Jacobi cíclico (até 50 varreduras; `metadata.method` e `metadata.sweeps`). Autovalores que diferem menos de `10⁻¹³` vezes o maior autovalor em módulo formam um autovalor repetido: são informados com o mesmo valor, as multiplicidades algébrica e geométrica coincidem, e os autovetores correspondentes formam uma base ortonormal do autoespaço. Em todo autovetor, a componente de maior módulo é positiva. Uma 3×3 não simétrica lança `AlgebraError` com código `UNSUPPORTED` e a mensagem "autovalores 3×3: só matrizes simétricas"; o painel matricial de uma 3×3 mostra autovalores apenas quando ela é simétrica.
- `lu`: fatores `P`, `L`, `U`, com `P A = L U` e pivotamento parcial.
- `qr`: fatores `Q` (m×m) e `R` (m×n), por reflexões de Householder; aceita matrizes retangulares e de posto deficiente.
- `svd`: forma econômica `U` (m×k), `S` (k valores em **ordem decrescente**) e `Vt` (k×n), onde k=min(m,n). `metadata` inclui posto estimado, tolerância e resíduo relativo de reconstrução.
- `pinv`: pseudoinversa em `value`, com diagnóstico da SVD e resíduo relativo de `A A⁺ A ≈ A`.
- `lstsq`: solução de norma mínima em `value`, com resíduos absolutos e relativos. Sistemas incompatíveis ainda possuem solução de mínimos quadrados.

Os cálculos usam precisão dupla. As tolerâncias de posto são relativas à escala e às dimensões (`16 × ε × max(m,n)` na matriz escalada; na SVD, multiplicadas pelo maior valor singular). Valores singulares abaixo dessa tolerância são tratados como zero. Matrizes singulares e matrizes invertíveis mal condicionadas têm diagnósticos distintos; condicionamento acima de `10¹⁰` gera aviso. O painel matricial estima o condicionamento pela norma infinito; a SVD usa a razão entre valores singulares. Esses indicadores não são numericamente idênticos.

Limites iniciais: **20×20** para operações gerais e diagnósticos de sistemas; **12×12** para LU, QR, SVD, pseudoinversa e mínimos quadrados. `configureAlgebra({maxSize,advancedSize})` permite ajustar os limites até 100, com o limite avançado menor ou igual ao geral. Os autovalores estão limitados a matrizes **reais 2×2 com espectro real** e **3×3 simétricas**; resultados complexos, 3×3 não simétricas e outras ordens produzem uma mensagem explícita. Matrizes com escalas extremas ou condicionamento elevado podem perder informação em precisão dupla; resíduos pequenos não garantem erro pequeno na solução.

A SVD usa Jacobi unilateral, ortogonalizando as colunas sem formar explicitamente AᵀA, conforme a [descrição do método da UT Austin](https://www.cs.utexas.edu/~flame/laff/alaff/chapter11-one-sided-Jacobi-method.html). QR usa [reflexões de Householder](https://www.netlib.org/utk/papers/factor/node12.html). A implementação é local, sem bibliotecas externas, com limite de 100 varreduras na SVD e erro explícito em caso de não convergência.

## Verificação

`npm test` executa testes numéricos e de integração: operações conhecidas, identidades algébricas, reconstruções, ortogonalidade, condições de Moore–Penrose, erros de domínio e dimensão, reatividade, símbolos, apresentações acessíveis e inicialização com estados antigos.

## Editor visual de GAAL e instalação

Na aba **álgebra**, escolha **editor visual** para preencher vetores, matrizes ou sistemas Ax=b
em células numéricas. O editor insere uma expressão `calc:` comum na Curva e preserva
o motor numérico, as variáveis e o mecanismo de undo/redo existentes.

Novas funções: `unit([3,4])` (versor), `matpow([[2,1],[0,2]],3)` (potências inteiras
de −100 a 100) e `rrefinfo([[1,2],[2,4]])` (forma reduzida e painel de etapas
de Gauss–Jordan com pivotamento parcial, escalado para estabilidade numérica).

Para sistemas `solveinfo(A,b)` de ordem 3×3, acione **ver planos 3D** no resultado.
Os planos são desenhados no renderizador nativo ou Plotly da Curva, com o ponto
de solução somente quando a classificação for de solução única.

A Curva agora possui um manifesto PWA com ícone próprio e botão de tela cheia.
Em Chrome/Edge, use a opção **Instalar aplicativo** para abrir em janela própria.
O modo offline inclui os arquivos locais; o renderizador Plotly carregado via CDN
exige rede, portanto escolha **Curva 3D (Nativa)** para trabalhar desconectado.

Os novos testes estão em `test/gaal-integration.test.mjs` e executam com `npm test`.


### Three.js (WebGL): terceiro motor 3D

A lista **Motor 3D** oferece **Canvas 2D (renderizador próprio)**, **Plotly.js** e **Three.js (WebGL)**. A opção Three.js usa o pacote `three` r187 por importação dinâmica de módulos ES locais, apenas quando selecionada. Ela desenha planos transparentes, malhas, linhas, vetores, pontos e legendas com profundidade WebGL e reutiliza a câmera e os dados geométricos da Curva.

Para sistemas `solveinfo(A,b)` de ordem 3×3, cada plano tem sua própria cor e o ponto de solução recebe destaque. O modo Three.js exige WebGL e conexão na primeira importação do módulo; se não estiver disponível, selecione Canvas 2D ou Plotly.js. O modo Canvas 2D não depende da CDN. Three.js utiliza licença MIT.


## Projetos JSON e alternância 2D/3D

O controle **2D | 3D** permanece visível mesmo em cenas exclusivamente 2D.
Ao **carregar** um preset, a vista inicial volta a ser 2D para cenas sem
objetos 3D e 3D para cenas com objetos espaciais; **adicionar** um preset não
substitui o modo escolhido. O preset **Análise de cônicas** é 2D, mas pode
ser explorado também em 3D no plano XY e depois retornar ao 2D.

Nos controles de **presets**, use **↓ exportar projeto** para baixar
`curva-projeto-AAAA-MM-DD.json` e **↑ importar projeto** para restaurar
equações, configurações, anotações, parâmetros e câmera. Importação valida
a estrutura e limita o tamanho a 2 MB; não interpreta código do JSON.
Use **Desfazer** para voltar à sessão anterior. Um arquivo de projeto
é diferente do link por comandos `?cmd=`, que não inclui a câmera.


## Transformações de matrizes 3×3 (novidade)

Para uma matriz 3×3, por exemplo
`calc: [[2,0,0],[0,1,0],[0,0,0.5]]`,
abra **transformação 3D** no resultado. A cena exibe o cubo unitário
(original e transformado) e três vetores da base. Use o controle de tempo,
**iniciar / pausar / reiniciar** e os modos **Identidade → A** ou
**SVD: Vᵀ → Σ → U**. Alterar a matriz recalcula a geometria sem alterar
a entrada. As cores dos três vetores são consistentes nos renderizadores.

As transformações são modelos visuais de interpolação, não uma solução
simbólica dos autovalores. A interpolação linear e os estágios da SVD podem
atravessar matrizes singulares e inverter orientações.


## Seções cônicas no espaço 3D

Em **Presets → Cônicas e quádricas**, escolha **Seções do cone e circunferência**
ou **Hipérbole e planos (3D)**. São construções geométricas que apresentam
o cone duplo `x² + y² = z²` em azul, o plano secante
`z = h + kx` em amarelo e a interseção em rosa. Ao substituir a cena,
o preset abre automaticamente a vista 3D; selecione Plotly.js ou Three.js
para visualizar a transparência.

O comando nativo é `secao: 2,k` com parâmetro `k` ajustável: `k=0`
dá circunferência, `0<|k|<1` elipse, `|k|=1` parábola
e `|k|>1` hipérbole. O modelo representa apenas a janela finita
do cone, portanto as seções abertas ficam truncadas nos limites de desenho.
Os presets trazem variantes inicialmente ocultas; mostre uma por vez
para comparar planos sem sobrepor quatro cones.


### Parâmetros geométricos das seções cônicas (3D)

Os presets agora usam a expressão `secao: h,k,a,d,p`. Os controles são: h (altura do plano em relação ao vértice), k (inclinação), a (abertura radial do cone), d (deslocamento vertical do vértice) e p (rotação azimutal do plano, em radianos).

A superfície é `x²+y²=a²(z-d)²` e o plano `z=d+h+k(x cos(p)+y sin(p))`. O limite entre elipse e hipérbole é `|a*k|=1`. É mantida a sintaxe original `secao: 2,k` (a=1, d=p=0). Linhas ocultas nos presets permanecem ocultas até que o usuário ative o olho.


### Inclinação até plano vertical exato

Os presets de **Cônicas e quádricas (3D)** utilizam agora `secao: h,angulo(q),a,d,p,b`. O parâmetro `q` é o ângulo de inclinação em graus, com slider de −90° até +90°; ambos os extremos são planos realmente verticais. O controle `b` é o afastamento horizontal positivo do plano, que preserva uma hipérbole não degenerada em ±90°. Os demais controles h, a, d e p foram preservados. A condição para a parábola é `a*|tan(q)|=1`; no ângulo de 90° a seção é hiperbólica. O formato antigo `secao: h,k,a,d,p` continua funcionando com k como coeficiente angular.


### Afastamento horizontal do plano atravessando o eixo X

Nos presets **Cônicas e quádricas (3D)**, o controle `b` agora varia de
**−4 a +4**, incluindo **0**. Com `q=90°` e `p=0`, a equação do plano é
`x=−b`; logo, `b=0` coloca o plano exatamente sobre `x=0`. Os valores
negativos movem o plano para o lado oposto do eixo.

Com `q=±90°` e `b=0`, o plano passa pelo vértice do cone e a seção é
**degenerada: duas retas geratrizes concorrentes**, não uma hipérbole.
A calculadora exibe essas duas retas corretamente. Com outras inclinações,
o plano pode passar pelo vértice para alguns valores negativos de `b`;
esses casos também são tratados como cônicas degeneradas. A sintaxe
existente `secao: h,angulo(q),a,d,p,b` e os presets são preservados.


## Laboratório de quádricas

O preset **Superfícies quádricas (3D)** reúne elipsoide, esfera, paraboloide elíptico, paraboloide hiperbólico (sela), hiperboloides de uma e duas folhas, e cilindro elíptico. Ative uma linha de cada vez. O comando é `quadrica: tipo,a,b,c,d`, por exemplo `quadrica: hiperboloide1,1.2,1,1,0`. Os parâmetros a,b,c são escalas geométricas positivas e d desloca a superfície verticalmente. As superfícies são malhas limitadas para visualização, compatíveis com Canvas 2D, Plotly.js e Three.js.


## Laboratório de geometria: duas vistas, quádricas e exportação (2026)

### Seção em 2D + geometria no espaço

Ao carregar **Presets → Cônicas e quádricas → Hipérbole e planos (3D)**
ou **Seções do cone e circunferência**, a Curva oferece automaticamente
duas vistas sincronizadas: o motor 3D ocupa a área principal e um painel
mostra a **mesma curva no referencial ortonormal (s,t) do plano secante**.
Com o botão **3D + 2D**, mostre ou oculte a segunda vista; essa escolha
é preservada nos projetos JSON e no estado local.

O painel matemático calcula, diretamente das equações do cone e do plano,
a equação quadrática da seção, sua forma canônica quando aplicável,
excentricidade, semieixos, centro/vértice, focos e assíntotas.
Se o plano atravessar o ápice, são identificados os casos degenerados
(duas retas, uma geratriz ou o ponto do vértice) sem inventar focos.

Passe o cursor sobre a vista 2D para ler as coordenadas no plano.
**Exportar SVG** produz desenho vetorial com eixos e curva;
**Exportar PNG** captura o painel em pixels. O botão **PNG** na barra
vertical exporta o gráfico principal 2D ou 3D, de acordo com o motor
ativo. No modo 3D + 2D esse botão exporta apenas a vista 3D; os botões
do painel exportam a seção separadamente.

### Manipulação e controles

Os parâmetros das seções cônicas ficam organizados em dois grupos,
**Plano secante** e **Cone duplo**, com opção para restaurar os valores.
Para quádricas, os grupos são **Escalas da superfície** e **Posição**.

No **Three.js**, selecione **Editar 3D** para arrastar diretamente o
plano amarelo (horizontal: deslocamento b; vertical: inclinação q), a
superfície azul do cone (abertura a e altura d), ou o ponto do vértice
(altura d). **Alt + arrastar** ativa momentaneamente a manipulação.
O arrasto altera os mesmos parâmetros dos sliders; controles de câmera,
órbita e zoom seguem disponíveis quando a ferramenta não está ativa.
A precisão do gesto depende da tela: para introduzir valores exatos,
use os campos numéricos.

O botão **Enquadrar** na barra vertical agora centraliza a câmera nos
limites efetivos dos objetos finitos, inclusive se o vértice ou
a superfície tiverem sido deslocados verticalmente.

### Quádricas

O preset **Superfícies quádricas (3D)** reúne sete famílias paramétricas
(esfera, elipsoide, paraboloide elíptico, hiperboloide de uma folha,
hiperboloide de duas folhas, paraboloide hiperbólico/sela e cilindro
elíptico). Os comandos usam `quadrica: tipo,a,b,c,d`; altere os eixos
ou altura e mantenha somente as superfícies desejadas visíveis.
O exemplo "esfera" somente é esférico quando a=b=c; em outras escalas,
a equação torna-se a de um elipsoide. Malhas são amostras finitas
das quádricas ideais.

### Verificação

A suíte matemática também verifica projeção inversível entre os
referenciais da seção, focos, semieixos, excentricidade, casos
degenerados, equações das malhas, transformações por arrasto e
enquadramento. Os testes no Chromium verificam a tela dividida
no desktop e no celular, os grupos de controles, a persistência de
b=0, os presets de quádricas e a exportação PNG. As capturas
são disponibilizadas como artefatos do GitHub Actions.

**Limitações históricas resolvidas:** as seções planas agora estão disponíveis
para sete famílias de quádricas, e o Three.js pode ser carregado localmente
depois que o aplicativo é instalado em cache. A exportação do gráfico isolado
permanece disponível; a nova ação **PNG conjunto** inclui ambas as vistas.

## Laboratório geral de seções, cálculo vetorial e compartilhamento (2026)

### Plano secante em qualquer família de quádrica

Abra **Presets → Cônicas e quádricas → Cortes de quádricas (3D + 2D)**.
O comando matemático é:

```text
corte: elipsoide,a,b,c,d,q,p,h
```

O primeiro argumento aceita `esfera`, `elipsoide`, `paraboloide`,
`hiperboloide1`, `hiperboloide2`, `sela` ou `cilindro`.
Os parâmetros `a,b,c` dão as escalas da superfície e `d` sua translação
vertical. O plano usa inclinação `q` em graus entre −90 e +90,
azimute `p` em graus e distância assinada `h` à origem.
É possível inclinar o plano verticalmente e deslocá-lo até encontrar uma
tangência ou uma seção degenerada.

A Curva restringe a equação quadrática tridimensional a um referencial
ortonormal próprio do plano, produzindo
`A s² + B st + C t² + D s + E t + F = 0`.
A classificação matemática é analítica: centro, semieixos,
excentricidade, focos e eixos principais quando aplicáveis.
Circunferências, elipses, parábolas, hipérboles, retas, pares de retas,
pontos de tangência e ausência de pontos reais são tratados explicitamente.
O desenho 3D e a curva 2D usam uma malha/contorno em janela finita:
a classificação não é inferida pela imagem discretizada.

A vista **3D + 2D** possui uma divisória arrastável. Use também
**Tab** para focar a divisória e as setas para alterar a proporção;
em telas estreitas a separação torna-se horizontal. A proporção é
lembrada localmente. Ao aproximar o cursor da curva 2D, o ponto
correspondente é marcado no 3D com as coordenadas locais `(s,t)` e
globais `(x,y,z)`; a seleção inversa funciona nos motores Canvas e
Three.js. A vinculação inversa no Plotly.js ainda não está disponível.

### Cônicas rotacionadas em 2D

O comando `conica:` agora completa a análise de expressões com
termo misto `x*y`: diagonaliza a parte quadrática, identifica e desenha
eixos principais, focos, diretrizes e assíntotas quando matematicamente
definidos. Os casos degenerados continuam identificados separadamente.

### Gradientes e planos tangentes em 3D

Abra **Planos tangentes e gradientes (3D)** ou digite:

```text
tangente: paraboloide,a,b,c,d,u,v,r
```

`u` e `v` são coordenadas paramétricas entre 0 e 1 na
superfície. `r` indica a folha (−1 ou +1) quando se trata de
hiperboloide de duas folhas. A Curva calcula e desenha o ponto P,
o gradiente analítico de `F(x,y,z)=0`, a normal unitária e
o plano tangente. Para paraboloides e selas, também informa
as derivadas parciais `∂z/∂x` e `∂z/∂y`.
Mude `u` e `v` pelos controles ou selecione um ponto da
malha com um clique no gráfico Canvas/Three.js. Pontos singulares
sem plano tangente único são rejeitados.

### Compartilhar e exportar

A ação **link** na barra do gráfico copia uma URL com as equações,
parâmetros, câmera 3D, vista 2D e estado do painel conjunto.
O formato é versionado e validado, limitado a cenas pequenas;
exporte um projeto JSON para cenas muito grandes.
No painel da seção, **PNG conjunto** monta uma composição com
os dois visores, a equação e as propriedades geométricas. Os formatos
PNG e SVG individuais continuam disponíveis.

### Three.js e offline

Os módulos oficiais **Three.js r187**, mantidos sob a
licença MIT, foram incluídos em `assets/vendor/` e carregados
sob demanda por importação ES local. O service worker inclui
esses módulos no cache do aplicativo. Isso elimina a necessidade
de acessar uma CDN para o Three.js depois de instalar o cache;
WebGL ainda depende da compatibilidade do dispositivo.

