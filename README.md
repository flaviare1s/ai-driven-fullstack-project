# ai-driven-fullstack-project

Monorepo fullstack gerado com [Turborepo](https://turborepo.dev), [Next.js](https://nextjs.org)
e [NestJS](https://nestjs.com).

## Tecnologias

- **Monorepo**: Turborepo + npm workspaces
- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS — porta `3000`
- **Backend**: NestJS, `@nestjs/config`, CORS habilitado — porta `4000`
- **Módulos de negócio**: pacotes compartilhados em `modules/*`, testados com Jest
  (ver skills `config-new-module`, `config-module-backend` e `config-module-frontend`
  em `.claude/skills/`)

## Estrutura

```
apps/
  frontend/   # Next.js — http://localhost:3000
  backend/    # NestJS  — http://localhost:4000
packages/     # configs compartilhadas (eslint, tsconfig, ui)
modules/      # módulos de negócio compartilhados entre frontend e backend
```

Os pacotes internos usam o escopo `@ai-driven-fullstack-project` (ex.: `@ai-driven-fullstack-project/auth`).

## Comandos básicos

Rodar a partir da raiz do repositório:

| Comando | Descrição |
| --- | --- |
| `npm install` | Instala as dependências de todos os workspaces |
| `npm run dev` | Sobe frontend (3000) e backend (4000) em modo desenvolvimento |
| `npm run build` | Builda todos os apps/pacotes/módulos |
| `npm run lint` | Roda o lint em todos os workspaces |
| `npm run check-types` | Checa os tipos TypeScript de todos os workspaces |
| `npm run test --workspace=<pacote>` | Roda os testes de um workspace específico |

## Variáveis de ambiente

- `apps/frontend/.env`: `NEXT_PUBLIC_API_URL=http://localhost:4000`
- `apps/backend/.env`: `PORT=4000`
