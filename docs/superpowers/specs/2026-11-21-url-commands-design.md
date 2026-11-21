# Comandos pela URL

## Intenção e contrato

Abrir a Curva por um link com parâmetros `cmd` repetidos deve criar uma linha
editável por comando e calcular os resultados automaticamente. A ordem e as
repetições são preservadas; os comandos usam a mesma sintaxe e o mesmo tratamento
de erros das linhas inseridas manualmente. `=`, `+`, `%`, `&` e caracteres Unicode
viajam codificados com `URLSearchParams` e são decodificados uma única vez.

## Abordagens

- **Parâmetros `cmd` repetidos (aprovada):** funciona na aplicação estática atual,
  preserva repetições e não exige outra sintaxe para transportar os comandos.
- Texto multilinha em um parâmetro: possível, mas desnecessário para o contrato
  escolhido. YAML também introduziria problemas com chaves `calc:` repetidas.
- Endpoint de servidor com JSON: serve a integrações que precisam receber uma
  resposta de cálculo sem navegador; fora do escopo desta mudança.

## Decisões de implementação

Ler `window.location.search` na inicialização. Havendo ao menos um `cmd` não
vazio, iniciar uma cena padrão com esses comandos, sem misturar a cena salva.
Ignorar parâmetros `cmd` vazios ou compostos apenas de espaços. Sem comandos
úteis, manter a restauração atual e o exemplo inicial `sin(x)` quando não houver
sessão salva. Reutilizar `makeEq` e a recompilação global existente para resolver
referências entre linhas. Não criar servidor ou dependências. Links muito longos
continuam sujeitos aos limites do navegador e da hospedagem.

O usuário aprovou a abordagem e solicitou a implementação na conversa.
