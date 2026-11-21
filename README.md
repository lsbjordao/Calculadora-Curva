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
sem misturar a sessão salva. Valores `cmd` vazios ou compostos apenas de espaços
são ignorados. Sem comandos úteis, a aplicação restaura a sessão anterior ou
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
