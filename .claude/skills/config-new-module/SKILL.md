---
name: config-new-module
description: Cria um novo módulo de negócio dentro da pasta modules de um monorepo Turborepo (apps/frontend + apps/backend), copiando de forma determinística os arquivos de estrutura pré-definidos (jest.config.ts, tsconfig.json, tsconfig.build.json, package.json, index.ts, index.test.ts), ligando o módulo ao frontend e ao backend como dependência, e instalando/buildando/testando o projeto. Use quando o usuário pedir para criar/adicionar um novo módulo dentro de modules/. Exige um namespace/escopo npm (ex. "@projeto-capsule") — nunca execute sem ele.
---

# config-new-module

Esta skill reproduz, de forma **determinística**, a criação de um novo módulo
de negócio dentro da pasta `modules/` de um monorepo Turborepo já existente
(com `apps/frontend` e `apps/backend`). Toda a lógica fica em `setup.js`, no
mesmo diretório desta skill, e os arquivos gerados vêm literalmente da pasta
`assets/` — não improvise os arquivos manualmente nem os substitua por
variações.

## Como executar

Rode o script Node a partir da **raiz do monorepo Turborepo** (a pasta que
contém `apps/`, `packages/` e o `package.json` raiz com `"workspaces"` — por
exemplo, dentro de `projeto-capsule/`):

```
node <caminho-para-esta-skill>/setup.js <nome-do-modulo> <namespace>
```

Exemplo:

```
node .claude/skills/config-new-module/setup.js auth @projeto-capsule
```

- `<nome-do-modulo>`: obrigatório, em kebab-case (ex.: `auth`, `user-profile`).
- `<namespace>`: **obrigatório**. Escopo npm dos pacotes do monorepo (ex.:
  `@projeto-capsule`); o `@` é opcional no argumento — a skill normaliza e
  valida o formato de escopo npm.

## Regras para quem invoca esta skill

- **Nunca execute esta skill sem o namespace informado.** Se o usuário não
  disser qual namespace usar, pergunte antes de rodar o script.
- Sempre execute `setup.js` via `node`; não recrie os passos manualmente com
  comandos soltos, e não escreva os arquivos de `modules/<nome>` à mão.
- Não copie/edite os templates de `assets/` "on the fly" para pular etapas, e
  não passe `--no-verify` nem pule as verificações do script.
- Rode o comando a partir da raiz do monorepo Turborepo (não da raiz do
  repositório git externo, se houver um monorepo aninhado como
  `projeto-capsule/`).
- Se o script falhar em qualquer etapa, pare e reporte o erro exato ao
  usuário — não tente contornar manualmente (ex.: não edite `node_modules`,
  não pule o build/testes por conta própria).

## O que o script faz (em ordem)

1. **Validação de argumentos e pré-condições**: confere que o nome do módulo
   e o namespace foram informados e são válidos, que os templates em
   `assets/` existem, e que o diretório atual é a raiz de um monorepo
   Turborepo (`package.json` com `"workspaces"`, `apps/frontend/package.json`
   e `apps/backend/package.json`).
2. Cria `modules/` (se não existir) e `modules/<nome-do-modulo>/{src,test}`
   (se não existir).
3. Copia os arquivos determinísticos de `assets/` para
   `modules/<nome-do-modulo>/`:
   - `jest.config.ts`, `tsconfig.json`, `tsconfig.build.json`,
     `src/index.ts` e `test/index.test.ts` são copiados literalmente, sem
     alterações.
   - `package.json` é copiado com o campo `"name"` reescrito para
     `"<namespace>/<nome-do-modulo>"`.
   - `tsconfig.json` inclui `src` e `test` e declara `"types": ["jest",
     "node"]` explicitamente (evita o erro `Cannot find name 'describe'` no
     editor). `tsconfig.build.json` estende `tsconfig.json` mas restringe a
     compilação a `src` (mesmo padrão já usado em `apps/backend`), e é esse
     o arquivo usado pelo script `"build"` do módulo — assim o `tsc` do build
     nunca tenta compilar os arquivos de teste.
4. Adiciona `"<namespace>/<nome-do-modulo>": "*"` em `dependencies` de
   `apps/frontend/package.json` e `apps/backend/package.json`.
5. Garante `"ts-node": "^10.9.2"` em `devDependencies` do `package.json`
   raiz (sem sobrescrever uma versão já presente).
6. Garante `"modules/*"` em `"workspaces"` do `package.json` raiz (mantendo
   as demais entradas, ex.: `apps/*`, `packages/*`).
7. Executa `npm install` na raiz do monorepo.
8. Executa o build **apenas do módulo novo**
   (`npm run build --workspace=<namespace>/<nome-do-modulo>`) — nunca
   `npm run build`/`turbo run build` do projeto inteiro (veja "Por que o
   build é escopado ao módulo" abaixo).
9. Executa os testes do módulo criado
   (`npm run test --workspace=<namespace>/<nome-do-modulo>`).
10. Verificação final: confirma que todos os arquivos, dependências e
    entradas de configuração esperados existem.

## Resultado esperado

- `modules/<nome-do-modulo>/`: pacote novo, com `src/index.ts`,
  `test/index.test.ts`, `package.json` (nome `<namespace>/<nome-do-modulo>`),
  `tsconfig.json` e `jest.config.ts`.
- `apps/frontend` e `apps/backend`: com o módulo novo listado como
  dependência (`"<namespace>/<nome-do-modulo>": "*"`).
- Projeto raiz: `workspaces` incluindo `modules/*` e `ts-node` disponível em
  `devDependencies`.
- `npm install`, `npm run build` e os testes do módulo executados com
  sucesso.

## Por que o build é escopado ao módulo

A skill nunca roda `npm run build`/`turbo run build` do projeto inteiro
depois de criar um módulo — ela builda só o workspace novo
(`npm run build --workspace=<pacote>`). Isso é proposital: adicionar uma
dependência de workspace nova em `apps/frontend`/`apps/backend` muda o hash
de cache do turbo para esses apps (o `build` deles depende de `^build`), o
que forçaria `nest build`/`next build` a rodar de novo mesmo sem nenhuma
mudança de código. O `nest-cli.json` do backend usa `"deleteOutDir": true`
junto com cache incremental do `tsc` (`tsconfig.tsbuildinfo`) — um rebuild
"por nada" nessa combinação apaga `dist/` e o `tsc`, achando que nada mudou,
não reemite os arquivos, deixando `dist/main.js` ausente e o backend
quebrado (`Cannot find module '.../dist/main'` ao rodar `npm run dev`). Se
isso já tiver acontecido antes desta correção, apague
`apps/backend/tsconfig.tsbuildinfo` e `apps/backend/tsconfig.build.tsbuildinfo`
e rode `npm run build --workspace=backend` uma vez para regenerar `dist/`
corretamente.

## Nota sobre o editor (TS server)

O `extends` de `tsconfig.json`/`tsconfig.build.json` (`@repo/typescript-config/...`)
só resolve depois que `npm install` cria o link do workspace em
`node_modules/@repo/typescript-config` — e a maioria dos editores ignora
mudanças dentro de `node_modules` no watcher de arquivos. Se, logo após rodar
a skill, o editor ainda mostrar `File '@repo/typescript-config/base.json' not
found`, isso é cache do TS server, não um problema da instalação: peça para
o usuário reiniciar o TS server ("TypeScript: Restart TS Server") ou recarregar
a janela — o script já garante que `npm install` rodou com sucesso antes de
build/testes passarem pela CLI.
