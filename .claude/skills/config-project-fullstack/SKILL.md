---
name: config-project-fullstack
description: Cria do absoluto zero, DIRETAMENTE na raiz do repositório atual (sem subpasta), um monorepo Turborepo fullstack (Next.js na porta 3000 + NestJS na porta 4000, com @nestjs/config, CORS habilitado, arquivos .env e README.md com tecnologias/comandos) seguindo uma sequência fixa e determinística de comandos. O nome do projeto (package.json raiz) é sempre o nome da pasta/repositório atual. Use quando o usuário pedir para configurar/inicializar/criar um novo projeto fullstack com essa stack (Turborepo + Next.js + NestJS). Aceita opcionalmente um namespace/escopo npm (ex. "@minha-empresa") para renomear todos os pacotes gerados ao final.
---

# config-project-fullstack

Esta skill reproduz, de forma **determinística**, o passo a passo de
configuração de um projeto fullstack do zero (Turborepo + Next.js + NestJS).
Toda a lógica fica em `setup.js`, no mesmo diretório desta skill — não
improvise os comandos manualmente nem os substitua por variações.

Esta skill é feita para ser **reaproveitada em qualquer repositório**: o
projeto é criado diretamente na raiz do repositório atual (não numa
subpasta com nome fixo), e o nome do projeto (campo `"name"` do
`package.json` raiz) é sempre derivado do nome da pasta/repositório onde a
skill é executada.

## Como executar

Rode o script Node a partir da raiz do repositório atual (que já é um
repositório git — a skill NUNCA executa `git init`):

```
node .claude/skills/config-project-fullstack/setup.js
```

Para renomear o namespace/escopo de todos os pacotes gerados (frontend,
backend e quaisquer outros pacotes do monorepo) ao final da execução, passe o
namespace como argumento:

```
node .claude/skills/config-project-fullstack/setup.js @minha-empresa
```

(o "@" é opcional no argumento — a skill normaliza e valida o formato de
escopo npm). Isso não afeta o nome do projeto em si (`package.json` raiz),
que continua sendo sempre o nome da pasta/repositório.

## Regras para quem invoca esta skill

- Sempre execute `setup.js` via `node`; não recrie os passos manualmente com
  comandos soltos.
- Não passe `--no-verify`, não pule as verificações de segurança do script e
  não edite o script "on the fly" para pular etapas.
- Se o script falhar em qualquer etapa, pare e reporte o erro exato ao
  usuário — não tente contornar manualmente (ex.: não rode `git init`, não
  sobrescreva arquivos gerados à mão, não reinstale pacotes globais por
  conta própria).
- Se o usuário fornecer um namespace, repasse-o exatamente como o primeiro
  argumento do script.
- **Nunca** rode esta skill num repositório que já tenha `package.json`,
  `apps/`, `packages/` ou `modules/` na raiz — ela vai abortar de propósito
  para não sobrescrever um projeto existente.

## O que o script faz (em ordem)

1. **Pré-condições de segurança**: confere que `node`, `npm`, `npx` e `git`
   existem, que o diretório atual já é um repositório git (por isso a skill
   nunca inicializa um novo), e que a raiz do repositório ainda não tem
   `package.json`/`apps`/`packages`/`modules`/`turbo.json` (garante criação
   do absoluto zero — se algum já existir, o script aborta em vez de
   sobrescrever).
2. `npx create-turbo@latest .turbo-scaffold-tmp -m npm --no-git` — o
   create-turbo se recusa a rodar num diretório não vazio (a raiz do
   repositório já tem `.git`/`.claude`), então o scaffold roda numa subpasta
   oculta temporária, e todo o conteúdo gerado é movido para a raiz do
   repositório logo em seguida (a subpasta temporária é removida ao final
   desse passo). O `.git`/`.claude` da raiz nunca são tocados por esse
   processo.
3. Remove tudo dentro de `apps/*` (equivalente a `rm -rf apps/*`).
4. `npx create-next-app@latest frontend --yes --src-dir ...` dentro de
   `apps/`, com todas as flags fixadas explicitamente (TypeScript, Tailwind,
   ESLint, App Router, npm, sem git) para não depender de preferências
   salvas na máquina — mantém a porta padrão 3000.
5. Instala `@nestjs/cli` (com fallback automático para `npx @nestjs/cli` caso
   a instalação global falhe) e roda `nest new backend -g -p npm` dentro de
   `apps/`, depois `npm install @nestjs/config` no backend.
6. Reescreve `apps/backend/src/app.module.ts` para registrar o
   `ConfigModule.forRoot({ isGlobal: true })`.
7. Reescreve `apps/backend/src/main.ts` para ouvir na porta `4000`
   (via `process.env.PORT ?? 4000`) e habilitar CORS.
8. Adiciona o script `"dev": "nest start --watch"` ao
   `apps/backend/package.json` (sem remover os demais scripts existentes).
9. Remove `"deleteOutDir": true` de `apps/backend/nest-cli.json` (valor
   padrão gerado pelo `nest new`). Combinado com o cache incremental do
   `tsc` (`"incremental": true`, também padrão do `nest new`), um rebuild em
   que nada mudou no backend apaga `dist/` e o `tsc`, achando pelo cache que
   nada precisa ser reemitido, não recria os arquivos — deixando
   `dist/main.js` ausente e `npm run dev`/`nest start --watch` quebrados
   (`Cannot find module '.../dist/main'`). Sem `deleteOutDir`, a `dist/`
   nunca é apagada antes de uma recompilação incremental.
10. Cria `apps/frontend/.env.example` (`NEXT_PUBLIC_API_URL=http://localhost:4000`)
    e `apps/backend/.env.example` (`PORT=4000`), copiando cada um para o
    respectivo `.env`.
11. Define o campo `"name"` do `package.json` raiz como o nome da
    pasta/repositório atual (ex.: `ai-driven-fullstack-project`).
12. Varre o projeto criado em busca de pastas `.git` aninhadas inesperadas
    (criadas por alguma ferramenta apesar das flags) e remove qualquer uma
    que seja encontrada — **nunca** varre nem toca em `.git`/`.claude` da
    própria raiz do repositório.
13. **Se um namespace foi informado**: localiza todos os `package.json` do
    monorepo (ignorando `node_modules`, `.git` e `.claude`; e ignorando
    também o próprio `package.json` raiz, cujo nome já foi definido no passo
    11), reescreve o campo `name` de cada um para usar o novo escopo
    (preservando o identificador do pacote) e atualiza as referências
    cruzadas em `dependencies`/`devDependencies`/`peerDependencies`/
    `optionalDependencies` para os novos nomes, mantendo o monorepo
    consistente.
14. Cria `README.md` na raiz do repositório, com as tecnologias usadas
    (Turborepo, Next.js, NestJS, TypeScript), a estrutura de pastas
    (`apps/`, `packages/`, `modules/`), os comandos básicos (`npm install`,
    `npm run dev`/`build`/`lint`/`check-types`) e as variáveis de ambiente.
15. Verificação final: confirma que os `package.json`/`.env`/`README.md`
    esperados existem, que o nome do projeto é o da pasta/repositório, e que
    `main.ts` está configurado para a porta 4000 com CORS.

## Resultado esperado

- Projeto criado na **raiz do repositório** (não numa subpasta), com
  `package.json` raiz nomeado como a pasta/repositório atual.
- `apps/frontend`: Next.js, `npm run dev` sobe em `http://localhost:3000`.
- `apps/backend`: NestJS, `npm run dev` sobe em `http://localhost:4000`,
  lendo variáveis de ambiente via `@nestjs/config` (arquivo `.env` com
  `PORT=4000`) e com CORS habilitado.
- `README.md` na raiz, documentando tecnologias e comandos básicos.
