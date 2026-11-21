# Comandos pela URL — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir links com `cmd` repetidos e executar as linhas na Curva.

**Architecture:** Ler os comandos na inicialização de `src/app.js`, antes da
restauração do estado. Reutilizar compilação, resultados, edição e persistência.

**Tech Stack:** JavaScript ES modules, URLSearchParams, node:test; sem dependências.

**Spec:** `docs/superpowers/specs/2026-11-21-url-commands-design.md`

## Global Constraints

- Funcionar como aplicação estática, sem servidor adicional ou dependências.
- Preservar ordem, repetições e caracteres dos comandos decodificados.
- Sem comandos úteis, preservar a inicialização atual.
- Com comandos úteis, iniciar uma cena padrão definida pela URL.

## Review Focus

- `=` e `+` codificados devem chegar intactos ao parser.
- Um comando inválido não deve impedir os demais resultados.
- Comandos vazios não devem apagar uma sessão salva.
- Uma cena salva não deve contaminar os comandos da URL.
- As linhas importadas devem continuar editáveis e recalcular dependentes.

### Task 1: Carregamento de comandos e documentação

**Files:** Modify `src/app.js`, `test/boot-space3d.test.mjs`, `README.md`.

**Interfaces:** Consome `window.location.search`, `makeEq(text)` e
`recompileAllEquations()`; produz linhas normais da aplicação.

- [x] Adicionar testes de inicialização com o exemplo do usuário, ordem,
  referências, codificação, duplicatas, erros, fallback e edição/persistência.
- [x] Executar `node --test test/boot-space3d.test.mjs` e confirmar falhas
  causadas pela ausência do carregamento da URL.
- [x] Ler `new URLSearchParams(window.location?.search || '').getAll('cmd')`,
  ignorar apenas valores vazios e usar os comandos antes de `restoreState()`.
- [x] Executar os testes específicos e confirmar sucesso.
- [x] Documentar o contrato, exemplo de link e geração por URLSearchParams.
- [x] Executar `npm test` e `git diff --check`, revisar o diff completo e
  entregar as alterações locais, sem publicar.

## Verificação

- Baseline: 312 testes passaram antes da mudança.
- RED: os seis testes novos detectaram a ausência da entrada por URL.
- GREEN: 12 testes de inicialização passaram; suíte completa com 318 testes,
  sem falhas. `git diff --check` e `node --check src/app.js` passaram.
- Revisão independente sem achados. Referência algébrica futura também
  verificada pelo revisor, incluindo recálculo e persistência após edição.
