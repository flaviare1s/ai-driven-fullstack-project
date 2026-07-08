---
name: config-module-frontend
description: Cria uma rota Next.js (App Router) pública ou privada em apps/frontend/src/app/(public|private)/<nome-do-modulo>, seguindo boas práticas (layout, loading, error, not-found), para um módulo de negócio já criado pela skill config-new-module em modules/<nome-do-modulo>. Use quando o usuário pedir para dar uma rota/página de frontend a um módulo em modules/, pública ou protegida por autenticação. Pré-requisito: modules/<nome-do-modulo>/package.json já deve existir (rode config-new-module antes, se não existir).
---

# config-module-frontend

Esta skill **complementa** a `config-new-module` (assim como a
`config-module-backend`): ela não cria o pacote do módulo do zero, e sim
adiciona um componente de página reutilizável dentro de
`modules/<nome-do-modulo>/src` e uma rota Next.js (App Router) real em
`apps/frontend/src/app/(public|private)/<nome-do-modulo>` que só importa e
renderiza esse componente. Toda a lógica fica em `setup.js`, no mesmo
diretório desta skill, e os arquivos gerados vêm literalmente da pasta
`assets/` — não improvise os arquivos manualmente nem os substitua por
variações.

## Pré-requisito

`modules/<nome-do-modulo>/package.json` precisa já existir. Se não existir,
rode primeiro:

```
node .claude/skills/config-new-module/setup.js <nome-do-modulo> <namespace>
```

## Como executar

Rode o script Node a partir da **raiz do monorepo Turborepo** (a mesma pasta
onde se roda a `config-new-module`/`config-module-backend` — a própria raiz
do repositório, já que a `config-project-fullstack` não cria subpasta):

```
node <caminho-para-esta-skill>/setup.js <nome-do-modulo> <public|private>
```

Exemplos:

```
node .claude/skills/config-module-frontend/setup.js user-profile private
node .claude/skills/config-module-frontend/setup.js auth public
```

- `<nome-do-modulo>`: obrigatório, em kebab-case, e precisa corresponder a um
  módulo já existente (`modules/<nome-do-modulo>/package.json`).
- `<public|private>`: obrigatório. Decide em qual route group a rota é
  criada (`apps/frontend/src/app/(public)/...` ou `.../(private)/...`).

## Regras para quem invoca esta skill

- Sempre execute `setup.js` via `node`; não recrie os passos manualmente com
  comandos soltos, e não escreva os arquivos de rota nem o componente de
  página à mão.
- Não copie/edite os templates de `assets/` "on the fly" para pular etapas, e
  não passe `--no-verify` nem pule as verificações do script.
- Não rode esta skill para um módulo que ainda não foi criado pela
  `config-new-module` — ela vai falhar de propósito com uma mensagem
  explicando isso.
- Se o script falhar em qualquer etapa, pare e reporte o erro exato ao
  usuário — não tente contornar manualmente.

## O que o script faz (em ordem)

1. **Validação de argumentos e pré-condições**: nome do módulo e
   visibilidade (`public`/`private`) informados e válidos, templates em
   `assets/` existem, diretório atual é a raiz do monorepo (com
   `apps/frontend/package.json` e `apps/frontend/src/app`).
2. Localiza `modules/<nome-do-modulo>/package.json` (criado pela
   `config-new-module`) e lê o nome completo do pacote nele.
3. Gera, em `modules/<nome-do-modulo>/src/`: `<nome>-page.tsx` (componente
   `<Nome>Page`, com um `<h1>` de exemplo) e `<nome>-page.spec.tsx`
   (renderiza o componente com Testing Library e confere o título).
4. Remove o stub genérico `test/index.test.ts` criado pela
   `config-new-module`, se ainda existir.
5. Garante (merge idempotente, sem sobrescrever o arquivo inteiro — outra
   skill como a `config-module-backend` pode já ter escrito outros exports
   nele) o export do componente de página em
   `modules/<nome-do-modulo>/src/index.ts`, removendo o `ping` genérico se
   ainda estiver lá.
6. Sobrescreve `jest.config.ts` do módulo para rodar specs `.spec.ts` e
   `.spec.tsx` colocalizados em `src/` (mesmo arquivo final que a
   `config-module-backend` também escreve — as duas skills convergem para o
   mesmo conteúdo, então a ordem de execução não importa).
7. Habilita `"jsx": "react-jsx"` no `tsconfig.json` do módulo.
8. Atualiza o `package.json` do módulo:
   - Adiciona `react`/`react-dom` em `dependencies`, e `@types/react`,
     `@types/react-dom`, `@testing-library/react` e `jest-environment-jsdom`
     em `devDependencies` (sem sobrescrever versões já presentes).
   - Aponta `"main"`/`"types"` para `dist/index.js`/`dist/index.d.ts` — o
     `tsc` do módulo já compila `.tsx` para JS puro (usando o runtime
     automático do JSX), então o Next.js consome o pacote via `node_modules`
     normalmente, sem precisar de `transpilePackages` no `next.config.ts`.
9. Garante a dependência `"<pacote-do-módulo>": "*"` em
   `apps/frontend/package.json` (idempotente).
10. Se a visibilidade for `private` e
    `apps/frontend/src/app/(private)/layout.tsx` ainda não existir, cria
    esse layout de grupo com um guard de autenticação **placeholder**
    (`isAuthenticated()` sempre `false`, redireciona para `/login`) —
    reaproveitado por todas as rotas privadas futuras. Se já existir, não
    mexe nele.
11. Cria, em `apps/frontend/src/app/(public|private)/<nome-do-modulo>/`:
    `page.tsx` (importa e renderiza `<Nome>Page`), `layout.tsx`,
    `loading.tsx`, `error.tsx` (Client Component, com botão de retry) e
    `not-found.tsx`.
12. Executa `npm install` na raiz do monorepo.
13. Builda **apenas o módulo** (`npm run build --workspace=<pacote>`).
14. Testa **apenas o módulo** (`npm run test --workspace=<pacote>`) —
    valida o componente de página.
15. Builda o frontend (`npm run build --workspace=frontend`) para validar
    que a rota nova compila. Diferente do backend, o `next build` não sofre
    do bug de cache incremental do `tsc` (não usa `deleteOutDir` + cache
    incremental), então não é preciso limpar nada antes.
16. Verificação final: confirma que os arquivos, o build (`dist/index.js` do
    módulo e `.next/` do frontend) e a dependência existem.

## Por que "main"/"types" apontam para dist, não para src

Mesmo raciocínio da `config-module-backend`: uma vez que o Next.js
efetivamente importa o pacote (`import { <Nome>Page } from '<pacote>'`), o
`tsc` já compilou o `.tsx` para JS puro (com `jsx: "react-jsx"`) antes disso
acontecer (passo 13, sempre antes do build do frontend no passo 15) — então
o Next.js resolve um `.js` comum via `node_modules`, sem precisar tratar o
pacote como código-fonte não compilado.

## Nota sobre o guard de `(private)/layout.tsx`

O guard gerado é um **placeholder determinístico**: `isAuthenticated()`
sempre retorna `false`, então qualquer rota privada redireciona para
`/login` até alguém substituir essa função por uma checagem real de
sessão/autenticação (por exemplo, integrando com o módulo `auth` já criado
pela `config-module-backend`/`config-new-module`, se existir). Esta skill
não cria a rota `/login` nem implementa autenticação de verdade — isso é
trabalho de um módulo próprio, fora do escopo aqui.

## Resultado esperado

- `modules/<nome-do-modulo>/src/`: `<nome>-page.tsx`, `<nome>-page.spec.tsx`,
  com `dist/` buildado.
- `apps/frontend/src/app/(public|private)/<nome-do-modulo>/`: `page.tsx`,
  `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`.
- `apps/frontend/src/app/(private)/layout.tsx`: guard placeholder (só se
  alguma rota privada já foi criada).
- `apps/frontend/package.json`: com a dependência do módulo.
- Build e testes do módulo, e build do frontend, executados com sucesso.
