---
name: config-project-fullstack
description: Cria do absoluto zero um monorepo Turborepo fullstack (Next.js na porta 3000 + NestJS na porta 4000, com @nestjs/config, CORS habilitado e arquivos .env) seguindo uma sequência fixa e determinística de comandos. Use quando o usuário pedir para configurar/inicializar/criar um novo projeto fullstack com essa stack (Turborepo + Next.js + NestJS), ou para reproduzir o processo de setup descrito neste projeto. Aceita opcionalmente um namespace/escopo npm (ex. "@minha-empresa") para renomear todos os pacotes gerados ao final.
---

# config-project-fullstack

Esta skill reproduz, de forma **determinística**, o passo a passo de configuração
usado para criar este projeto do zero (Turborepo + Next.js + NestJS). Toda a
lógica fica em `setup.js`, no mesmo diretório desta skill — não improvise os
comandos manualmente nem os substitua por variações.

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
escopo npm).

## Regras para quem invoca esta skill

- Sempre execute `setup.js` via `node`; não recrie os passos manualmente com
  comandos soltos.
- Não passe `--no-verify`, não pule as verificações de segurança do script e
  não edite o script "on the fly" para pular etapas.
- Se o script falhar em qualquer etapa, pare e reporte o erro exato ao
  usuário — não tente contornar manualmente (ex.: não rode `git init`, não
  sobrescreva a pasta gerada, não reinstale pacotes globais por conta própria).
- Se o usuário fornecer um namespace, repasse-o exatamente como o primeiro
  argumento do script.

## O que o script faz (em ordem)

1. **Pré-condições de segurança**: confere que `node`, `npm`, `npx` e `git`
   existem, que o diretório atual já é um repositório git (por isso a skill
   nunca inicializa um novo) e que a pasta `projeto-capsule` ainda não existe
   (garante criação do absoluto zero — se já existir, o script aborta em vez
   de sobrescrever).
2. `npx create-turbo@latest projeto-capsule -m npm --no-git` — cria o monorepo
   sem inicializar um novo repositório git aninhado.
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
11. Varre o projeto criado em busca de pastas `.git` aninhadas inesperadas
    (criadas por alguma ferramenta apesar das flags) e remove qualquer uma
    que seja encontrada.
12. **Se um namespace foi informado**: localiza todos os `package.json` do
    monorepo (ignorando `node_modules`), reescreve o campo `name` de cada um
    para usar o novo escopo (preservando o identificador do pacote) e
    atualiza as referências cruzadas em `dependencies`/`devDependencies`/
    `peerDependencies`/`optionalDependencies` para os novos nomes, mantendo o
    monorepo consistente.
13. Verificação final: confirma que os `package.json`/`.env` esperados
    existem e que `main.ts` está configurado para a porta 4000 com CORS.

## Resultado esperado

- `projeto-capsule/apps/frontend`: Next.js, `npm run dev` sobe em
  `http://localhost:3000`.
- `projeto-capsule/apps/backend`: NestJS, `npm run dev` sobe em
  `http://localhost:4000`, lendo variáveis de ambiente via `@nestjs/config`
  (arquivo `.env` com `PORT=4000`) e com CORS habilitado.
