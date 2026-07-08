# Instruções gerais

- **Idioma do código**: todo código, nomes de arquivos, identificadores, mensagens de commit e
  comentários devem ser escritos em **inglês**.
- **Idioma das respostas**: a IA deve **sempre responder ao usuário em português do Brasil**,
  independentemente do idioma usado na pergunta ou do idioma do código sendo escrito.

# Orquestração das skills de configuração de projeto

Este repositório tem 4 skills complementares em `.claude/skills/` para montar um monorepo
fullstack (Turborepo + Next.js + NestJS) e seus módulos de negócio, de forma determinística.
Quando o usuário pedir para **configurar/criar um projeto**, citando ou não nomes de módulos,
siga esta orquestração em vez de rodar os comandos manualmente ou inventar uma sequência própria.

## As 4 skills, em ordem de dependência

1. **`config-project-fullstack`** — cria o monorepo do zero (Turborepo + Next.js na porta 3000 +
   NestJS na porta 4000) **diretamente na raiz do repositório atual** (sem subpasta). Só precisa
   rodar **uma vez** por repositório — pule esta etapa se a raiz já tiver `package.json`/`apps`/
   `packages`/`modules` (o script aborta sozinho nesse caso, então é seguro tentar rodar e deixar
   ele recusar).
   ```
   node .claude/skills/config-project-fullstack/setup.js [namespace]
   ```
2. **`config-new-module`** — cria o pacote compartilhado de um módulo de negócio em
   `modules/<nome-do-modulo>` (package.json, tsconfig, jest, stub inicial). **Pré-requisito** das
   duas skills seguintes.
   ```
   node .claude/skills/config-new-module/setup.js <nome-do-modulo> <namespace>
   ```
3. **`config-module-backend`** — adiciona arquitetura NestJS (Module/Controller/Service + specs)
   ao módulo e registra no `AppModule` do backend. Só roda depois da `config-new-module`.
   ```
   node .claude/skills/config-module-backend/setup.js <nome-do-modulo>
   ```
4. **`config-module-frontend`** — adiciona uma rota Next.js (App Router) pública ou privada para
   o módulo. Só roda depois da `config-new-module`.
   ```
   node .claude/skills/config-module-frontend/setup.js <nome-do-modulo> <public|private>
   ```

Todos os comandos rodam a partir da **raiz do repositório** (é lá que o projeto vive, sem
subpasta). Cada skill tem seu próprio `SKILL.md` com o passo a passo detalhado — consulte-o antes
de rodar, e nunca pule as verificações/etapas dos scripts.

## Fluxo ao pedir para "configurar um projeto"

Quando o usuário disser algo como *"configura um projeto com os módulos auth, pagamentos e
notificações"*:

1. **Namespace**: se o usuário não informou um namespace/escopo npm, sugira
   `@<nome-da-pasta-do-repositório>` (kebab-case) como padrão e confirme com o usuário antes de
   prosseguir — não assuma silenciosamente.
2. **Projeto base**: se a raiz ainda não tem o monorepo, rode `config-project-fullstack` com o
   namespace confirmado.
3. **Para cada módulo citado pelo usuário**:
   a. Rode `config-new-module <nome-do-modulo> <namespace>`.
   b. Pergunte ao usuário (não assuma) se aquele módulo precisa de **backend**, **frontend**, ou
      **os dois** — só rode `config-module-backend`/`config-module-frontend` para o que for
      confirmado.
   c. Se o módulo tiver frontend, pergunte também se a rota é **pública** ou **privada** antes de
      rodar `config-module-frontend`.
4. Ao final, rode `npm install`, `npm run build` e (se aplicável) os testes dos módulos criados
   para validar que tudo compila e passa antes de reportar sucesso.

Nunca pule as perguntas de esclarecimento do passo 3 assumindo um padrão — cada módulo pode ter
necessidades diferentes (só backend, só frontend, ou os dois; público ou privado).
