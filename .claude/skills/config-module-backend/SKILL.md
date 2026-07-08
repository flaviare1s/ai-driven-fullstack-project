---
name: config-module-backend
description: Adiciona arquitetura Nest.js (Module + Controller + Service, com specs) dentro de um módulo de negócio já criado pela skill config-new-module em modules/<nome-do-modulo>, e registra o módulo no AppModule do backend (apps/backend/src/app.module.ts). Use quando o usuário pedir para dar estrutura/arquitetura de backend (controllers, services, module) a um módulo em modules/, seguindo boas práticas do NestJS. Pré-requisito: modules/<nome-do-modulo>/package.json já deve existir (rode config-new-module antes, se não existir).
---

# config-module-backend

Esta skill **complementa** a `config-new-module`: ela não cria o pacote do
módulo do zero, e sim adiciona a arquitetura NestJS (Module, Controller,
Service e os specs correspondentes) dentro de um módulo que a
`config-new-module` já criou em `modules/<nome-do-modulo>`, e liga esse
módulo de fato ao backend (dependência + registro no `AppModule`). Toda a
lógica fica em `setup.js`, no mesmo diretório desta skill, e os arquivos
gerados vêm literalmente da pasta `assets/` — não improvise os arquivos
manualmente nem os substitua por variações.

## Pré-requisito

`modules/<nome-do-modulo>/package.json` precisa já existir. Se não existir,
rode primeiro:

```
node .claude/skills/config-new-module/setup.js <nome-do-modulo> <namespace>
```

## Como executar

Rode o script Node a partir da **raiz do monorepo Turborepo** (a mesma pasta
onde se roda a `config-new-module` — a própria raiz do repositório, já que a
`config-project-fullstack` não cria subpasta):

```
node <caminho-para-esta-skill>/setup.js <nome-do-modulo>
```

Exemplo:

```
node .claude/skills/config-module-backend/setup.js auth
```

- `<nome-do-modulo>`: obrigatório, em kebab-case, e precisa corresponder a um
  módulo já existente (`modules/<nome-do-modulo>/package.json`).
- Não é preciso informar o namespace de novo: a skill lê o campo `"name"` de
  `modules/<nome-do-modulo>/package.json` (criado pela `config-new-module`)
  para descobrir o nome completo do pacote (ex.: `@minha-empresa/auth`).

## Regras para quem invoca esta skill

- Sempre execute `setup.js` via `node`; não recrie os passos manualmente com
  comandos soltos, e não escreva os arquivos de `modules/<nome>/src` à mão.
- Não copie/edite os templates de `assets/` "on the fly" para pular etapas, e
  não passe `--no-verify` nem pule as verificações do script.
- Não rode esta skill para um módulo que ainda não foi criado pela
  `config-new-module` — ela vai falhar de propósito com uma mensagem
  explicando isso.
- Se o script falhar em qualquer etapa, pare e reporte o erro exato ao
  usuário — não tente contornar manualmente.

## O que o script faz (em ordem)

1. **Validação de argumentos e pré-condições**: nome do módulo informado e
   válido, templates em `assets/` existem, diretório atual é a raiz do
   monorepo (com `apps/backend/package.json` e
   `apps/backend/src/app.module.ts`).
2. Localiza `modules/<nome-do-modulo>/package.json` (criado pela
   `config-new-module`) e lê o nome completo do pacote nele.
3. Gera, em `modules/<nome-do-modulo>/src/`:
   - `<nome>.module.ts`, `<nome>.controller.ts` (rota `GET` de exemplo),
     `<nome>.service.ts` (método de exemplo), `<nome>.controller.spec.ts` e
     `<nome>.service.spec.ts` — nomes de classe em PascalCase
     (`<Nome>Module`, `<Nome>Controller`, `<Nome>Service`).
4. Remove o stub genérico `test/index.test.ts` criado pela
   `config-new-module` (e a pasta `test/`, se ficar vazia) — ele fica
   obsoleto assim que a arquitetura Nest.js real substitui o `index.ts`
   genérico.
5. Sobrescreve `jest.config.ts` do módulo para também rodar specs
   colocalizados em `src/**/*.spec.ts` (convenção NestJS), mantendo
   `test/**/*.test.ts` por compatibilidade.
6. Habilita `experimentalDecorators`/`emitDecoratorMetadata` no
   `tsconfig.json` do módulo (necessários para os decorators do Nest).
7. Atualiza o `package.json` do módulo:
   - Adiciona `@nestjs/common`, `@nestjs/core`, `reflect-metadata` e `rxjs`
     em `dependencies`, e `@nestjs/testing` em `devDependencies` (sem
     sobrescrever versões já presentes).
   - Aponta `"main"`/`"types"` para `dist/index.js`/`dist/index.d.ts` (em vez
     de `src/index.ts`) — necessário para o backend conseguir de fato
     `require` o módulo em tempo de execução (ver nota abaixo).
8. Garante a dependência `"<pacote-do-módulo>": "*"` em
   `apps/backend/package.json` (idempotente).
9. Registra o módulo em `apps/backend/src/app.module.ts`: adiciona o
   `import` e a entrada no array `imports: [...]` do `@Module` (idempotente
   — não duplica se já estiver registrado).
10. Executa `npm install` na raiz do monorepo.
11. Builda **apenas o módulo** (`npm run build --workspace=<pacote>`).
12. Testa **apenas o módulo** (`npm run test --workspace=<pacote>`) —
    valida controller e service.
13. Builda o backend (`npm run build --workspace=backend`), limpando antes
    o cache incremental do `tsc` do backend (veja a nota sobre o bug do
    Nest abaixo).
14. Testa o backend (`npm run test --workspace=backend`) para garantir que
    o novo import não quebrou nada.
15. Verificação final: confirma que os arquivos, o build (`dist/index.js` do
    módulo e `dist/main.js` do backend) e o registro no `AppModule` existem.

## Por que "main"/"types" apontam para dist, não para src

A `config-new-module` cria o pacote com `"main": "src/index.ts"`, o que só
funciona para checagem de tipos (o `tsc` lê `.ts` direto). Em tempo de
execução, quando o backend compilado (`dist/main.js`) faz
`require('<namespace>/<módulo>')`, o Node não sabe carregar um `.ts`
diretamente — por isso, assim que o módulo passa a ser de fato importado
pelo `AppModule` (o que só acontece a partir desta skill), `"main"`/`"types"`
precisam apontar para a saída compilada (`dist/index.js`/`dist/index.d.ts`).
Por isso o módulo é sempre buildado (passo 11) antes do backend (passo 13).

## Por que o cache incremental do backend é limpo antes do build

Esta skill **modifica código real** de `apps/backend/src/app.module.ts` (ao
contrário da `config-new-module`, que só mexe em `package.json`). O
`nest-cli.json` do backend usa `"deleteOutDir": true` junto com cache
incremental do `tsc`; um rebuild nessa combinação pode apagar `dist/` e o
`tsc`, com o cache desatualizado, não reemitir nada — deixando
`dist/main.js` ausente (`Cannot find module '.../dist/main'` ao rodar
`npm run dev`). Por isso o script sempre apaga
`apps/backend/tsconfig.tsbuildinfo` e `apps/backend/tsconfig.build.tsbuildinfo`
antes de buildar o backend, forçando uma reemissão completa e correta.

## Resultado esperado

- `modules/<nome-do-modulo>/src/`: `<nome>.module.ts`, `<nome>.controller.ts`,
  `<nome>.service.ts` e os specs, com `dist/` buildado.
- `apps/backend/src/app.module.ts`: com `<Nome>Module` importado e listado em
  `imports: [...]`.
- `apps/backend/package.json`: com a dependência do módulo.
- Build e testes do módulo e do backend executados com sucesso.
