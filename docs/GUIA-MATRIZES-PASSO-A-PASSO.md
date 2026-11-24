# Visor complementar de matrizes: como acompanhar cada conta

O **visor de resolução** é independente do gráfico 2D/3D. Você pode observar
o quadrado ou o volume transformado no gráfico e, simultaneamente, acompanhar
a origem numérica dos resultados no painel de cálculo.

## Abrir o visor

1. Abra a Curva e digite uma expressão matricial em uma camada, por exemplo
   `calc: det([[1,2,3],[0,1,4],[5,6,0]])`.
2. Clique na camada. Aparece o botão **▶ passo a passo** abaixo dela.
   Alternativamente, use **matrizes · passos** na barra superior do gráfico.
3. O visor surge na parte inferior, **sem substituir o gráfico**. Você pode
   aumentar ou diminuir seu tamanho pela borda inferior direita.
4. Use **◀ / ▶** para voltar ou avançar uma etapa, **|◀ / ▶|** para início/fim,
   a régua de progresso para saltar etapas ou **▶ Reproduzir** para animar.
   Dentro do painel, as setas **← / →** também passam as etapas.
5. Durante a demonstração, a resposta da camada fica oculta;
   na **última etapa** ela aparece. Fechar o visor devolve o resultado original.
6. Se alterar um parâmetro da matriz, o roteiro é recalculado sem perder
   o vínculo com a camada.

As cores ajudam a seguir a conta: **azul** para linha de A,
**âmbar** para coluna de B e **verde** para pivô/célula calculada.

## 1. Determinante 2×2

```text
calc: det([[3,4],[1,2]])
```

O visor mostra dois produtos e sua diferença:

```text
Diagonal principal: 3 × 2 = 6
Diagonal secundária: 4 × 1 = 4
det(A) = 6 − 4 = 2
```

O valor **2** também é a área orientada do paralelogramo
que resulta da transformação do quadrado unitário. A área
geométrica (sem sinal) é `|det A| = 2`.

## 2. Determinante 3×3: três métodos

```text
calc: det([[1,2,3],[0,1,4],[5,6,0]])
```

Na caixa **Método**, escolha:

- **Sarrus**: realça, uma a uma, as três diagonais descendentes e as
  três ascendentes, com a multiplicação dos seus elementos e as somas finais.
- **Cofatores**: expande pela primeira linha; exibe cada menor 2×2 e
  o sinal alternado dos cofatores.
- **Eliminação**: transforma A em matriz triangular usando trocas e
  subtrações de linhas, registrando o efeito sobre o determinante.

Os três métodos resultam em **det(A) = 1**, mas deixam visíveis
raciocínios distintos. Sarrus **só vale para 3×3**; a aplicação
não aplica essa regra a matrizes maiores.

Com `calc: det([[2,1,0,0],[0,3,1,0],[0,0,4,1],[0,0,0,5]])`,
o visor usa eliminação para o determinante 4×4, cujo valor é 120.

## 3. Multiplicação matricial, linha × coluna

```text
calc: matmul([[1,2],[3,4]],[[2,0],[1,2]])
```

Avance pelas entradas de C=AB. Para a primeira posição:

```text
Linha 1 de A: (1,2)
Coluna 1 de B: (2,1)
c11 = 1 × 2 + 2 × 1 = 4
```

Cada etapa destaca a linha e a coluna usadas e preenche
uma nova posição da matriz produto:

```text
C = [[4,4],
     [10,8]]
```

A animação ajuda a entender tanto a regra do produto como o
porquê da igualdade entre colunas da primeira matriz e linhas da segunda.

## 4. Inversa, pivôs e matriz aumentada

```text
calc: inv([[2,1],[1,3]])
```

O visor começa com `[A | I]` e executa operações
elementares de Gauss–Jordan: trocar linhas quando necessário,
dividir a linha por um pivô e zerar outras entradas da coluna.
Ao final, aparece `[I | A⁻¹]`.

Resultado:

```text
A⁻¹ = [[ 0.6,-0.2],
       [-0.2, 0.4]]
```

A linha vertical destaca o limite entre A e a identidade. Essa é
uma representação **algébrica**, complementar ao efeito geométrico
de uma transformação inversa.

## 5. Escalonamento e sistemas

```text
calc: rrefinfo([[1,2,3],[2,4,6],[1,1,1]])
```

O visor percorre as operações elementares e mostra
a forma escalonada reduzida. Para sistemas lineares:

```text
calc: solveinfo([[2,1],[1,3]],[5,10])
```

A resolução usa a matriz aumentada `[A | b]`.
Ao final, você pode interpretar a presença de pivôs,
variáveis livres e linhas inconsistentes. O resultado
numérico principal continua calculado pelo motor da Curva.

## 6. Como as colunas de A se relacionam ao gráfico 3D

```text
calc: [[2,0,0],[0,3,0],[0,0,-1]]
```

Ou:

```text
calc: matrixInfo([[2,0,0],[0,3,0],[0,0,-1]])
```

O roteiro **Matriz: imagens da base** destaca cada
coluna. Elas são, respectivamente, as imagens de
`e1`, `e2`, `e3` sob a transformação.
O determinante é **−6**, portanto o paralelepípedo tem
volume geométrico **6** e orientação invertida.

No gráfico 3D existente, veja essas direções e o volume;
no visor matricial, veja a correspondência entre as colunas
e os vetores de base. As duas representações são complementares.

## 7. Operações adicionais

O mesmo visor dá passos para operações já reconhecidas:

```text
calc: matadd([[1,2],[3,4]],[[5,6],[7,8]])
calc: matsub([[1,2],[3,4]],[[5,6],[7,8]])
calc: transpose([[1,2,3],[4,5,6]])
calc: trace([[1,2],[3,4]])
calc: scale(2,[[1,2],[3,4]])
```

Além disso, o preset **Matrizes: resolução passo a passo**
carrega exemplos de determinantes, multiplicação, inversão,
sistemas e transposição.

## Limites e precisão

O visor tem finalidade **didática** e apresenta matrizes
de até **10×10**, enquanto o motor principal continua aceitando
suas próprias dimensões máximas. As operações são realizadas
com números reais de ponto flutuante. Valores exibidos são
arredondados para facilitar a leitura e **não constituem cálculo
simbólico exato com frações**.

Em matrizes mal condicionadas, a interpretação de pivôs e postos
pode depender da tolerância numérica. Confira sempre os avisos
do resultado principal. A animação não pretende substituir
a análise formal de estabilidade numérica nem apresenta, nesta
versão, uma dedução detalhada de autovalores, SVD, QR ou LU.

O código matemático testável está em `src/matrix-steps.js`;
o visor em `src/matrix-step-view.js`.
