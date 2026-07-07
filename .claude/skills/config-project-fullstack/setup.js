#!/usr/bin/env node
'use strict';

/**
 * config-project-fullstack
 *
 * Script determinístico que recria, do absoluto zero, a estrutura de projeto
 * fullstack (Turborepo + Next.js + NestJS) descrita no runbook da skill.
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
const TURBOREPO_DIR_NAME = 'projeto-capsule';
const TURBOREPO_DIR = path.join(ROOT, TURBOREPO_DIR_NAME);
const APPS_DIR = path.join(TURBOREPO_DIR, 'apps');
const FRONTEND_DIR = path.join(APPS_DIR, 'frontend');
const BACKEND_DIR = path.join(APPS_DIR, 'backend');

const IGNORED_DIRS = new Set(['node_modules', '.git', '.turbo', '.next', 'dist']);

let currentStep = 0;
const TOTAL_STEPS = 12;

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
  if (fs.existsSync(TURBOREPO_DIR)) {
    throw new Error(
      `A pasta "${TURBOREPO_DIR_NAME}" já existe em ${ROOT}. ` +
        'Para garantir que o projeto seja criado do absoluto zero, remova ou renomeie ' +
        'essa pasta antes de rodar a skill novamente.'
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
  run(`npx --yes create-turbo@latest ${TURBOREPO_DIR_NAME} -m npm --no-git`, ROOT);
  if (!fs.existsSync(APPS_DIR)) {
    throw new Error('create-turbo não gerou a pasta "apps" esperada.');
  }
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

function createEnvFiles() {
  const frontendEnvExample = path.join(FRONTEND_DIR, '.env.example');
  const backendEnvExample = path.join(BACKEND_DIR, '.env.example');

  fs.writeFileSync(frontendEnvExample, 'NEXT_PUBLIC_API_URL=http://localhost:4000\n');
  fs.copyFileSync(frontendEnvExample, path.join(FRONTEND_DIR, '.env'));

  fs.writeFileSync(backendEnvExample, 'PORT=4000\n');
  fs.copyFileSync(backendEnvExample, path.join(BACKEND_DIR, '.env'));
}

// ---------------------------------------------------------------------------
// Sweep de segurança: remove qualquer .git aninhado criado por alguma
// ferramenta de scaffold, já que o projeto deve viver no repositório existente.
// ---------------------------------------------------------------------------

function removeNestedGitDirs() {
  const stack = [TURBOREPO_DIR];
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
  const pkgPaths = findPackageJsonFiles(TURBOREPO_DIR);

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
  ];

  const mainTs = fs.readFileSync(path.join(BACKEND_DIR, 'src', 'main.ts'), 'utf8');
  checks.push([mainTs.includes('4000'), 'backend não está configurado para a porta 4000']);
  checks.push([mainTs.includes('enableCors'), 'CORS não habilitado no backend']);

  const failures = checks.filter(([ok]) => !ok).map(([, msg]) => msg);
  if (failures.length) {
    throw new Error(`Verificação final falhou: ${failures.join('; ')}`);
  }

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

  step(`Criando monorepo Turborepo ("${TURBOREPO_DIR_NAME}")`, createTurborepo);
  step('Limpando apps/* geradas pelo template padrão', cleanApps);
  step('Criando app frontend (Next.js)', createFrontend);
  step('Criando app backend (NestJS) + @nestjs/config', createBackend);
  step('Configurando ConfigModule em app.module.ts', patchAppModule);
  step('Configurando porta 4000 e CORS em main.ts', patchMain);
  step('Adicionando script "dev" ao package.json do backend', patchBackendPackageJson);
  step('Criando arquivos .env.example e .env', createEnvFiles);
  step('Removendo repositórios git aninhados indevidos', removeNestedGitDirs);
  step('Aplicando namespace informado (se houver)', () => applyNamespace(namespace));
  step('Verificação final da configuração', finalVerification);

  log('\n✔ Projeto configurado com sucesso em: ' + TURBOREPO_DIR);
}

main();
