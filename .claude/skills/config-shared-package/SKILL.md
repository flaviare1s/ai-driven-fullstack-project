---
name: config-shared-package
description: Cria o pacote de INFRAESTRUTURA "shared" em packages/shared (não em modules/, por não ser um módulo de negócio) de um monorepo Turborepo (apps/frontend + apps/backend), com TypeScript framework-agnostic (tipos/utilitários/constantes puros, sem React nem NestJS), e liga esse pacote como dependência de apps/frontend, apps/backend e de TODOS os módulos de negócio em modules/*. A criação builda apenas o próprio shared, sem impactar (rebuild) frontend e backend. Use quando o usuário pedir para criar/configurar um módulo/pacote compartilhado de infraestrutura ("shared") do qual todo o resto do projeto depende. O namespace/escopo npm é detectado automaticamente dos pacotes existentes (ou pode ser informado como argumento).
---

# config-shared-package

Esta skill cria, de forma **determinística**, o pacote de **infraestrutura**
`shared` em `packages/shared` (e não em `modules/`, porque `shared` não é um
módulo de negócio) e o liga como dependência de todo o monorepo:

- `apps/frontend` e `apps/backend`;
- **todos** os módulos de negócio em `modules/*` (os atuais e — via a
  `config-new-module` — os futuros).

Toda a lógica fica em `setup.js`, no mesmo diretório desta skill, e os arquivos
gerados vêm literalmente da pasta `assets/` — não improvise os arquivos
manualmente nem os substitua por variações.

## Por que `shared` é framework-agnostic

`shared` é consumido **ao mesmo tempo** pelo frontend (Next.js/React) e pelo
backend (NestJS), além dos módulos. Por isso ele contém **apenas TypeScript
puro** (tipos, constantes e utilitários), **sem** dependências de React ou
NestJS. Misturar um framework aqui recriaria o mesmo problema de "barrel
misturado" que a `config-module-frontend` resolve com subpaths: um lado
arrastaria o framework do outro para dentro do seu bundle/build.

## Por que a criação não impacta frontend e backend

A skill builda **somente** o workspace do shared
(`npm run build --workspace=<pacote>`), nunca `npm run build`/`turbo run build`
do projeto inteiro. Adicionar uma dependência de workspace nova em
`apps/frontend`/`apps/backend` invalida o hash de cache do turbo desses apps
(o `build` deles depende de `^build`); buildar só o shared evita disparar
`next build`/`nest build` "por nada" — e evita o bug de `deleteOutDir` + cache
incremental do `tsc` do backend (ver `config-new-module`/`config-module-backend`).
Os apps só passam a **usar** o shared quando alguém escrever um `import` de
`<pacote>/...` no código deles; até lá, a nova dependência é inócua.

## Como executar

Rode o script Node a partir da **raiz do monorepo Turborepo** (a própria raiz
do repositório, já que a `config-project-fullstack` não cria subpasta):

```
node .claude/skills/config-shared-package/setup.js [namespace]
```

- `[namespace]`: **opcional**. Se omitido, o escopo npm é **detectado
  automaticamente** a partir dos pacotes existentes (ex.:
  `@ai-driven-fullstack-project`), mantendo o `shared` consistente com o resto
  do monorepo. Se informado, o `@` é opcional (a skill normaliza e valida).

## Regras para quem invoca esta skill

- Sempre execute `setup.js` via `node`; não recrie os passos manualmente com
  comandos soltos, e não escreva os arquivos de `packages/shared` à mão.
- Não copie/edite os templates de `assets/` "on the fly" para pular etapas, e
  não passe `--no-verify` nem pule as verificações do script.
- **Nunca** rode `npm run build`/`turbo run build` como parte da criação do
  shared — a skill builda só o próprio pacote de propósito (ver acima).
- Rode a skill **uma vez** por repositório (o pacote `shared` é único). Uma
  reexecução é segura: os arquivos de configuração são reescritos de forma
  determinística, e os arquivos de **código-fonte** (`src/*`, `test/*`) são
  preservados se já existirem (não sobrescreve código real do time).
- Se o script falhar em qualquer etapa, pare e reporte o erro exato ao
  usuário — não tente contornar manualmente.

## O que o script faz (em ordem)

1. **Validação de pré-condições e resolução do namespace**: confere os
   templates em `assets/`, que o diretório atual é a raiz de um monorepo
   Turborepo (`package.json` com `"workspaces"`, `apps/frontend/package.json` e
   `apps/backend/package.json`), e resolve o escopo npm (argumento ou detecção
   automática). Também resolve o nome real do pacote de tsconfig compartilhado
   (ex.: `<namespace>/typescript-config`).
2. Cria `packages/shared/{src,test}`.
3. Copia os templates de `assets/`:
   - `package.json` (nome `<namespace>/shared`, `main`/`types` apontando para
     `dist`, dependência de dev no `<namespace>/typescript-config`),
     `tsconfig.json`, `tsconfig.build.json` e `jest.config.ts` são **reescritos**
     de forma determinística.
   - `src/index.ts`, `src/http.ts`, `src/types.ts` e `test/index.test.ts` são
     **create-only** (criados só se ainda não existirem — preservam código real
     numa reexecução).
4. Adiciona `"<namespace>/shared": "*"` em `dependencies` de
   `apps/frontend/package.json` e `apps/backend/package.json` (idempotente).
5. Adiciona `"<namespace>/shared": "*"` em `dependencies` de **todos** os
   `modules/*/package.json` (idempotente).
6. Garante `"packages/*"` em `"workspaces"` do `package.json` raiz.
7. Executa `npm install` na raiz do monorepo.
8. Builda **apenas o shared** (`npm run build --workspace=<pacote>`) — nunca o
   projeto inteiro.
9. Executa os testes do shared (`npm run test --workspace=<pacote>`).
10. Limpeza final: remove caches soltos (`*.tsbuildinfo`) e pastas vazias.
11. Verificação final: confirma que os arquivos, o build (`dist/index.js` e
    `dist/index.d.ts`), as dependências (apps + todos os módulos) e o
    `"packages/*"` em `workspaces` existem.

## Por que `main`/`types` apontam para `dist`

Como o shared é consumido pelo frontend (Next.js), pelo backend (NestJS) e
pelos módulos, apontar `main`/`types` para `dist/index.js`/`dist/index.d.ts`
(em vez de `src`) faz o `tsc`/Next.js/Nest resolverem um `.js` + `.d.ts` já
compilados via `node_modules`, sem precisar de `transpilePackages` no Next nem
tratar o pacote como código-fonte não compilado. O `base.json` do
`typescript-config` já emite `declaration`, então o `dist` sai com os `.d.ts`.

## Relação com as outras skills

- A `config-new-module` passa a adicionar automaticamente a dependência do
  `shared` a cada novo módulo criado **se `packages/shared` já existir** — assim
  "todos os módulos de negócio dependem do shared" também vale para os futuros.
- Rode esta skill **depois** da `config-project-fullstack` (precisa do monorepo
  pronto). Pode rodar antes ou depois dos módulos — a skill liga os módulos que
  já existirem, e a `config-new-module` liga os que vierem depois.
