# Curva — guia prático das novas funcionalidades

Os exemplos abaixo funcionam na aba **geo** ou por meio de **+ nova função**,
digitando cada comando em uma camada separada. Se a cena estiver em 3D, use
o botão **3D** e o seletor de renderização (Canvas 2D, Three.js, Plotly.js).
Os exemplos são independentes, exceto onde se indica que precisam ficar
juntos. No menu de **presets**, procure **Superfícies implícitas não quadráticas**
e **Campos vetoriais, circulação e fluxo**.

## 1. Inspecionar um objeto

1. Crie a camada `funcao3d: z = x^2-y^2` ou carregue o preset
   **Cálculo multivariável e curvas de nível**.
2. Clique em **inspecionar**, na barra superior do gráfico.
3. Selecione a camada pela lista à esquerda para ver o ponto P,
   as derivadas, a Hessiana, a classificação dos pontos críticos
   e a equação do plano tangente.
4. Nos controles da camada, altere **x** e **y** do ponto de inspeção.
   Também é possível clicar na superfície na vista Canvas/Three.js
   para escolher um ponto aproximado da malha.
5. Use **Adicionar plano tangente** no inspetor: o Curva cria uma
   segunda camada, conservando a função original.

O painel pode ser redimensionado arrastando a borda inferior direita.
Para fechá-lo, use **×** ou **inspecionar** novamente. Selecionar
camadas sem abrir o painel não o mostra automaticamente.

## 2. Comparar planos no inspetor

Digite duas camadas:

```text
plano: z=0
plano: z=2
```

Abra **inspecionar**, clique na primeira camada e faça **Shift + clique**
na segunda. O painel informa **planos paralelos distintos**,
**ângulo 0°** e **distância 2**.

Troque a segunda por `plano: x=0`: passam a ser **secantes** com
ângulo agudo de **90°**. A comparação é analítica para planos definidos
por equações lineares; não extrapola a objetos arbitrários.

## 3. Derivadas parciais exatas e Hessiana

```text
funcao3d: z = x^2 - y^2
```

No ponto `(x,y)=(1,2)`, o resultado matemático esperado é:

- `f(1,2) = -3`;
- `∇f(1,2)=(2,-4)`;
- `H = [[2,0],[0,-2]]`;
- `det(H)=-4`;
- plano tangente: `z+3=2(x-1)-4(y-2)`.

O sistema apresenta as expressões de
`∂f/∂x`, `∂f/∂y`, `∂²f/∂x²`, `∂²f/∂x∂y`
e `∂²f/∂y²` quando o motor simbólico aceita a entrada.
No ponto `(0,0)`, a função apresenta um **ponto de sela**.
Expressões fora do subconjunto simbólico usam derivadas
numéricas e são identificadas como tal.

Para estudar a derivada direcional, altere o ângulo
do vetor unitário nos controles da camada. A derivada vale
`∇f · (cos θ, sin θ)`.

## 4. Superfícies implícitas não quadráticas

Crie as camadas a seguir:

```text
superficie: x^3+y^3+z^3=1
plano: z=0
```

A primeira é uma superfície cúbica implícita; o segundo é
um plano secante. A interseção aparece sobre a malha 3D e no painel
**3D + 2D**, no referencial do plano. Em seguida experimente:

```text
plano: x+y+z=1
```

O Curva suporta simultaneamente até quatro planos visíveis para
os cortes. As linhas são **aproximações amostradas** e podem perder
componentes pequenas ou singulares. Não confunda essa análise
com a classificação exata das quádricas, que continua disponível
em `superficie: x^2+y^2+z^2=4`.

Outro exemplo:

```text
superficie: x^2+y^2+z^2+sin(x*y)=3
plano: z=0
```

## 5. Campo vetorial 2D: direção, divergente e rotacional

```text
campo: -y,x
```

O Curva desenha setas no plano `z=0`.
O campo é `F(x,y)=(-y,x)`: setas tangenciam
círculos em torno da origem no sentido anti-horário.
No ponto `(0,0,0)`:

- Divergente: `∂(-y)/∂x + ∂x/∂y = 0`;
- Rotacional tridimensional: `(0,0,2)`.

As derivadas espaciais dos campos são estimadas por
diferenças centrais. As setas foram normalizadas no desenho
para facilitar a leitura da orientação; seus comprimentos
não são uma escala fiel da intensidade numérica.

## 6. Campo vetorial 3D

```text
campo3d: -y,x,z
```

Gire a vista 3D para observar as componentes espaciais.
Esse campo tem **divergente 1** e
**rotacional (0,0,2)**, avaliados na origem.
Use os três planos de referência **xy**, **xz**, **yz**
e a vista **iso** para comparar os componentes.

## 7. Integral de linha: circulação

```text
integrallinha: -y,x,1
```

Calcula numericamente a circulação de
`F=(-y,x)` ao longo da circunferência de raio 1,
centrada na origem e percorrida no sentido anti-horário.
O valor esperado é `2π ≈ 6,283185`.

O último argumento é o **raio**, e não um número
de subdivisões. Para raio 2, use:

```text
integrallinha: -y,x,2
```

O resultado esperado é `8π ≈ 25,132741`.
A seta rosa próxima à circunferência indica o sentido
positivo do percurso. Por ora este comando integra
**somente círculos XY centrados na origem**, não
uma curva paramétrica arbitrária.

## 8. Fluxo pelo disco orientado

```text
fluxo: 0,0,1,1
```

Integra `F=(0,0,1)` sobre o disco
`x²+y²≤1, z=0`, com normal **+z**.
Como a intensidade normal é 1,
o valor esperado é a área do disco,
`π ≈ 3,141593`.

```text
fluxo: 0,0,1,2
```

No disco de raio 2, o resultado esperado é
`4π ≈ 12,566371`.
O círculo marca a borda; a superfície transparente
representa o disco e a seta roxa marca sua normal.
O comando não calcula ainda fluxo em superfícies
curvas nem em domínios arbitrários.

## 9. Precisão e interpretações

- **Simbólico** significa que há uma expressão algébrica de derivada;
  as demais operações podem utilizar aproximações numéricas.
- **Hessiana e pontos críticos** são locais. Uma varredura finita
  não garante encontrar todos os extremos em uma janela.
- **Malhas e curvas de corte** são discretizações de uma região finita,
  não construções analíticas da superfície inteira.
- **Integrais** usam quadratura numérica; comparar malhas com duas
  resoluções oferece um indicador de estabilidade, mas não um
  limite matemático rigoroso para o erro.
- **Canvas / Three.js / Plotly.js** são motores de visualização da
  mesma cena; as opções de câmera e as superfícies podem variar
  ligeiramente entre eles.

Para conferir a implementação, o repositório inclui testes em
`test/interactive-math.test.mjs`. Execute `npm test`
para validar cálculos e casos de regressão.
