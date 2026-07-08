#!/usr/bin/env node
'use strict';

/**
 * config-project-fullstack
 *
 * Script determinístico que recria, do absoluto zero, a estrutura de projeto
 * fullstack (Turborepo + Next.js + NestJS) descrita no runbook da skill.
 *
 * O projeto é criado DIRETAMENTE na raiz do repositório atual (sem subpasta):
 * a skill é pensada para ser reaproveitada em qualquer repositório git, e o
 * nome do projeto (campo "name" do package.json raiz) é sempre o nome da
 * pasta/repositório atual — não um nome fixo.
 *
 * Uso:
 *   node setup.js [namespace]
 *
 * [namespace] é opcional. Se informado (ex: "@minha-empresa" ou "minha-empresa"),
 * ao final da execução todos os package.json gerados (frontend, backend e
 * quaisquer outros pacotes do monorepo) têm seu escopo/namespace reescrito.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const PROJECT_NAME = path.basename(ROOT);
const SCAFFOLD_TMP_DIR_NAME = '.turbo-scaffold-tmp';
const SCAFFOLD_TMP_DIR = path.join(ROOT, SCAFFOLD_TMP_DIR_NAME);
const APPS_DIR = path.join(ROOT, 'apps');
const FRONTEND_DIR = path.join(APPS_DIR, 'frontend');
const BACKEND_DIR = path.join(APPS_DIR, 'backend');

// Itens que nunca fazem parte da estrutura gerada por esta skill e que,
// portanto, nunca devem ser varridos/movidos/reescritos por ela (o próprio
// repositório git, a pasta de skills do Claude Code, etc.).
const NEVER_TOUCH = new Set(['.git', '.claude']);
const IGNORED_DIRS = new Set(['node_modules', '.git', '.claude', '.turbo', '.next', 'dist']);

let currentStep = 0;
const TOTAL_STEPS = 15;

function log(msg) {
  console.log(msg);
}

function step(name, fn) {
  currentStep += 1;
  log(`\n==> [${currentStep}/${TOTAL_STEPS}] ${name}`);
  try {
    fn();
  } catch (err) {
    console.error(`\n[ERRO] Falha na etapa "${name}": ${err.message}`);
    process.exit(1);
  }
}

function run(command, cwd) {
  log(`    $ ${command}`);
  execSync(command, { cwd, stdio: 'inherit' });
}

function commandExists(command) {
  try {
    execSync(command, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Verificações de segurança (pré-condições)
// ---------------------------------------------------------------------------

function ensureGitRepository() {
  try {
    const inside = execSync('git rev-parse --is-inside-work-tree', {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (inside !== 'true') throw new Error('not inside a work tree');
  } catch {
    throw new Error(
      'Este diretório não é um repositório git. Esta skill assume que você já está ' +
        'dentro de um repositório git existente e NUNCA executa "git init". ' +
        'Rode "git init" manualmente antes, se for esse o caso, e execute a skill novamente.'
    );
  }
}

function ensureFromScratch() {
  const conflicting = ['package.json', 'apps', 'packages', 'modules', 'turbo.json'].filter(
    (entry) => fs.existsSync(path.join(ROOT, entry))
  );
  if (conflicting.length) {
    throw new Error(
      `A raiz do repositório (${ROOT}) já parece ter um projeto (encontrado: ` +
        `${conflicting.join(', ')}). Para garantir que o projeto seja criado do absoluto ` +
        'zero, remova esses itens antes de rodar a skill novamente.'
    );
  }
  if (fs.existsSync(SCAFFOLD_TMP_DIR)) {
    throw new Error(
      `A pasta temporária "${SCAFFOLD_TMP_DIR_NAME}" já existe em ${ROOT}. Remova-a antes ` +
        'de rodar a skill novamente.'
    );
  }
}

function ensureToolingAvailable() {
  const required = ['node --version', 'npm --version', 'npx --version', 'git --version'];
  for (const cmd of required) {
    if (!commandExists(cmd)) {
      throw new Error(`Comando necessário não encontrado: "${cmd.split(' ')[0]}".`);
    }
  }
}

// ---------------------------------------------------------------------------
// Etapas de scaffolding
// ---------------------------------------------------------------------------

function createTurborepo() {
  // create-turbo (como a maioria das ferramentas de scaffold) se recusa a
  // rodar num diretório não vazio — e a raiz do repositório já tem pelo
  // menos ".git" (e normalmente ".claude"). Por isso o scaffold roda numa
  // subpasta temporária oculta, e o resultado é movido para a raiz logo em
  // seguida (flattenScaffoldIntoRoot).
  run(`npx --yes create-turbo@latest ${SCAFFOLD_TMP_DIR_NAME} -m npm --no-git`, ROOT);
  if (!fs.existsSync(path.join(SCAFFOLD_TMP_DIR, 'apps'))) {
    throw new Error('create-turbo não gerou a pasta "apps" esperada.');
  }
  flattenScaffoldIntoRoot();
}

function flattenScaffoldIntoRoot() {
  for (const entry of fs.readdirSync(SCAFFOLD_TMP_DIR)) {
    const src = path.join(SCAFFOLD_TMP_DIR, entry);
    const dest = path.join(ROOT, entry);
    if (fs.existsSync(dest)) {
      throw new Error(`Não é possível mover "${entry}" para a raiz: já existe ${dest}.`);
    }
    fs.renameSync(src, dest);
  }
  fs.rmSync(SCAFFOLD_TMP_DIR, { recursive: true, force: true });
}

function cleanApps() {
  for (const entry of fs.readdirSync(APPS_DIR)) {
    fs.rmSync(path.join(APPS_DIR, entry), { recursive: true, force: true });
  }
}

function createFrontend() {
  // Flags fixadas explicitamente (em vez de depender de preferências salvas do
  // create-next-app na máquina do usuário) para manter a execução determinística.
  run(
    'npx --yes create-next-app@latest frontend --yes --src-dir --ts --tailwind --eslint ' +
      '--app --use-npm --disable-git',
    APPS_DIR
  );
  if (!fs.existsSync(path.join(FRONTEND_DIR, 'package.json'))) {
    throw new Error('create-next-app não gerou o package.json do frontend.');
  }
}

function createBackend() {
  let nestCmd = 'nest';
  try {
    run('npm i -g @nestjs/cli');
    if (!commandExists('nest --version')) throw new Error('nest indisponível no PATH');
  } catch {
    log('    [aviso] instalação global de @nestjs/cli falhou; usando "npx @nestjs/cli" como alternativa.');
    nestCmd = 'npx --yes @nestjs/cli@latest';
  }
  run(`${nestCmd} new backend -g -p npm`, APPS_DIR);
  if (!fs.existsSync(path.join(BACKEND_DIR, 'package.json'))) {
    throw new Error('nest new não gerou o package.json do backend.');
  }
  run('npm install @nestjs/config', BACKEND_DIR);
}

function patchAppModule() {
  const content = `import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
`;
  fs.writeFileSync(path.join(BACKEND_DIR, 'src', 'app.module.ts'), content);
}

function patchMain() {
  const content = `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.PORT ?? 4000);
}

bootstrap();
`;
  fs.writeFileSync(path.join(BACKEND_DIR, 'src', 'main.ts'), content);
}

function patchBackendPackageJson() {
  const pkgPath = path.join(BACKEND_DIR, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.scripts = pkg.scripts || {};
  pkg.scripts.dev = 'nest start --watch';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

function patchNestCliJson() {
  // "nest new" gera nest-cli.json com "compilerOptions.deleteOutDir": true.
  // Combinado com o cache incremental do tsc (tsconfig.json tem
  // "incremental": true por padrão), um rebuild em que nada mudou no
  // backend apaga "dist/" e o tsc, achando (pelo cache) que nada precisa
  // ser reemitido, não recria os arquivos — deixando dist/main.js ausente
  // e "npm run dev"/"nest start --watch" quebrados com "Cannot find module
  // '.../dist/main'". Removemos deleteOutDir para que dist/ nunca seja
  // apagada antes de uma recompilação incremental.
  const nestCliPath = path.join(BACKEND_DIR, 'nest-cli.json');
  const nestCli = JSON.parse(fs.readFileSync(nestCliPath, 'utf8'));
  if (nestCli.compilerOptions) {
    delete nestCli.compilerOptions.deleteOutDir;
    if (Object.keys(nestCli.compilerOptions).length === 0) {
      delete nestCli.compilerOptions;
    }
  }
  fs.writeFileSync(nestCliPath, JSON.stringify(nestCli, null, 2) + '\n');
}

function createEnvFiles() {
  const frontendEnvExample = path.join(FRONTEND_DIR, '.env.example');
  const backendEnvExample = path.join(BACKEND_DIR, '.env.example');

  fs.writeFileSync(frontendEnvExample, 'NEXT_PUBLIC_API_URL=http://localhost:4000\n');
  fs.copyFileSync(frontendEnvExample, path.join(FRONTEND_DIR, '.env'));

  fs.writeFileSync(backendEnvExample, 'PORT=4000\n');
  fs.copyFileSync(backendEnvExample, path.join(BACKEND_DIR, '.env'));
}

// ---------------------------------------------------------------------------
// Nome do projeto e README (a raiz do projeto é a raiz do repositório)
// ---------------------------------------------------------------------------

function patchRootPackageName() {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.name = PROJECT_NAME;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

function createReadme(namespace) {
  const scopeNote = namespace
    ? `Os pacotes internos usam o escopo \`${namespace}\` (ex.: \`${namespace}/auth\`).`
    : 'Os pacotes internos ainda não têm um escopo npm definido (nenhum namespace foi informado ao rodar esta skill).';

  const content = `# ${PROJECT_NAME}

Monorepo fullstack gerado com [Turborepo](https://turborepo.dev), [Next.js](https://nextjs.org)
e [NestJS](https://nestjs.com).

## Tecnologias

- **Monorepo**: Turborepo + npm workspaces
- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS — porta \`3000\`
- **Backend**: NestJS, \`@nestjs/config\`, CORS habilitado — porta \`4000\`
- **Módulos de negócio**: pacotes compartilhados em \`modules/*\`, testados com Jest
  (ver skills \`config-new-module\`, \`config-module-backend\` e \`config-module-frontend\`
  em \`.claude/skills/\`)

## Estrutura

\`\`\`
apps/
  frontend/   # Next.js — http://localhost:3000
  backend/    # NestJS  — http://localhost:4000
packages/     # configs compartilhadas (eslint, tsconfig, ui)
modules/      # módulos de negócio compartilhados entre frontend e backend
\`\`\`

${scopeNote}

## Comandos básicos

Rodar a partir da raiz do repositório:

| Comando | Descrição |
| --- | --- |
| \`npm install\` | Instala as dependências de todos os workspaces |
| \`npm run dev\` | Sobe frontend (3000) e backend (4000) em modo desenvolvimento |
| \`npm run build\` | Builda todos os apps/pacotes/módulos |
| \`npm run lint\` | Roda o lint em todos os workspaces |
| \`npm run check-types\` | Checa os tipos TypeScript de todos os workspaces |
| \`npm run test --workspace=<pacote>\` | Roda os testes de um workspace específico |

## Variáveis de ambiente

- \`apps/frontend/.env\`: \`NEXT_PUBLIC_API_URL=http://localhost:4000\`
- \`apps/backend/.env\`: \`PORT=4000\`
`;

  fs.writeFileSync(path.join(ROOT, 'README.md'), content);
}

// ---------------------------------------------------------------------------
// Sweep de segurança: remove qualquer .git aninhado criado por alguma
// ferramenta de scaffold, já que o projeto vive na raiz do repositório
// existente. NUNCA varre ".git"/".claude" da própria raiz (NEVER_TOUCH).
// ---------------------------------------------------------------------------

function removeNestedGitDirs() {
  const stack = [];
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (NEVER_TOUCH.has(entry.name) || entry.name === 'node_modules') continue;
    stack.push(path.join(ROOT, entry.name));
  }

  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.name === '.git') {
        log(`    [aviso] removendo repositório git aninhado inesperado: ${full}`);
        fs.rmSync(full, { recursive: true, force: true });
        continue;
      }
      stack.push(full);
    }
  }
}

// ---------------------------------------------------------------------------
// Renomeação de namespace/escopo dos pacotes (etapa final, opcional)
// ---------------------------------------------------------------------------

function normalizeNamespace(raw) {
  const withAt = raw.startsWith('@') ? raw : `@${raw}`;
  if (!/^@[a-z0-9][a-z0-9._-]*$/.test(withAt)) {
    throw new Error(
      `Namespace inválido: "${raw}". Use apenas o formato de escopo npm, ` +
        'ex: "@minha-empresa" (letras minúsculas, números, "-", "_" ou ".").'
    );
  }
  return withAt;
}

function findPackageJsonFiles(rootDir) {
  const results = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        stack.push(path.join(dir, entry.name));
      } else if (entry.isFile() && entry.name === 'package.json') {
        results.push(path.join(dir, entry.name));
      }
    }
  }
  return results;
}

function applyNamespace(rawNamespace) {
  if (!rawNamespace) {
    log('    Nenhum namespace informado; mantendo os nomes de pacote gerados por padrão.');
    return;
  }

  const namespace = normalizeNamespace(rawNamespace);
  const pkgPaths = findPackageJsonFiles(ROOT).filter(
    (pkgPath) => path.dirname(pkgPath) !== ROOT // não reescreve o package.json raiz (já tem PROJECT_NAME)
  );

  const packages = pkgPaths.map((pkgPath) => ({
    pkgPath,
    json: JSON.parse(fs.readFileSync(pkgPath, 'utf8')),
  }));

  const nameMap = new Map();
  for (const { json } of packages) {
    if (!json.name) continue;
    const suffix = json.name.includes('/') ? json.name.split('/').pop() : json.name;
    nameMap.set(json.name, `${namespace}/${suffix}`);
  }

  const depFields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

  for (const { pkgPath, json } of packages) {
    if (json.name && nameMap.has(json.name)) {
      json.name = nameMap.get(json.name);
    }
    for (const field of depFields) {
      if (!json[field]) continue;
      for (const [depName, version] of Object.entries(json[field])) {
        if (nameMap.has(depName) && nameMap.get(depName) !== depName) {
          delete json[field][depName];
          json[field][nameMap.get(depName)] = version;
        }
      }
    }
    fs.writeFileSync(pkgPath, JSON.stringify(json, null, 2) + '\n');
  }

  log(`    Namespace "${namespace}" aplicado a ${packages.length} package.json.`);
}

// ---------------------------------------------------------------------------
// Verificação final
// ---------------------------------------------------------------------------

function finalVerification() {
  const checks = [
    [fs.existsSync(path.join(FRONTEND_DIR, 'package.json')), 'package.json do frontend ausente'],
    [fs.existsSync(path.join(BACKEND_DIR, 'package.json')), 'package.json do backend ausente'],
    [fs.existsSync(path.join(FRONTEND_DIR, '.env')), '.env do frontend ausente'],
    [fs.existsSync(path.join(BACKEND_DIR, '.env')), '.env do backend ausente'],
    [fs.existsSync(path.join(ROOT, 'README.md')), 'README.md da raiz ausente'],
  ];

  const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  checks.push([rootPkg.name === PROJECT_NAME, 'nome do package.json raiz não é o nome da pasta/repositório']);

  const mainTs = fs.readFileSync(path.join(BACKEND_DIR, 'src', 'main.ts'), 'utf8');
  checks.push([mainTs.includes('4000'), 'backend não está configurado para a porta 4000']);
  checks.push([mainTs.includes('enableCors'), 'CORS não habilitado no backend']);

  const failures = checks.filter(([ok]) => !ok).map(([, msg]) => msg);
  if (failures.length) {
    throw new Error(`Verificação final falhou: ${failures.join('; ')}`);
  }

  log(`    Projeto: ${PROJECT_NAME}`);
  log('    Frontend (Next.js): npm run dev -> http://localhost:3000');
  log('    Backend  (NestJS) : npm run dev -> http://localhost:4000');
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

function main() {
  const namespace = process.argv[2];

  step('Verificando pré-condições de segurança', () => {
    ensureToolingAvailable();
    ensureGitRepository();
    ensureFromScratch();
  });

  step(`Criando monorepo Turborepo na raiz do repositório ("${PROJECT_NAME}")`, createTurborepo);
  step('Limpando apps/* geradas pelo template padrão', cleanApps);
  step('Criando app frontend (Next.js)', createFrontend);
  step('Criando app backend (NestJS) + @nestjs/config', createBackend);
  step('Configurando ConfigModule em app.module.ts', patchAppModule);
  step('Configurando porta 4000 e CORS em main.ts', patchMain);
  step('Adicionando script "dev" ao package.json do backend', patchBackendPackageJson);
  step('Removendo "deleteOutDir" de nest-cli.json (evita bug de cache incremental)', patchNestCliJson);
  step('Criando arquivos .env.example e .env', createEnvFiles);
  step(`Definindo nome do projeto ("${PROJECT_NAME}") no package.json raiz`, patchRootPackageName);
  step('Removendo repositórios git aninhados indevidos', removeNestedGitDirs);
  step('Aplicando namespace informado (se houver)', () => applyNamespace(namespace));
  step('Criando README.md com tecnologias e comandos básicos', () => createReadme(namespace));
  step('Verificação final da configuração', finalVerification);

  log(`\n✔ Projeto "${PROJECT_NAME}" configurado com sucesso em: ${ROOT}`);
}

main();
