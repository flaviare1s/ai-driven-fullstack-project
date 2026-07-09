#!/usr/bin/env node
'use strict';

/**
 * config-shared-package
 *
 * Script determinístico que cria o pacote de INFRAESTRUTURA "shared" em
 * packages/shared (não em modules/, porque não é um módulo de negócio) e o liga
 * como dependência de:
 *   - apps/frontend e apps/backend;
 *   - todos os módulos de negócio em modules/*.
 *
 * O pacote é TypeScript "framework-agnostic" (sem React, sem NestJS): como é
 * consumido tanto pelo frontend (Next.js/React) quanto pelo backend (NestJS) e
 * pelos módulos, ele nunca pode depender de um framework — senão recai no mesmo
 * problema de "barrel misturado" que a config-module-frontend resolve com
 * subpaths. Os arquivos vêm literalmente de ./assets.
 *
 * IMPORTANTE — não impacta frontend/backend: a criação builda APENAS o
 * workspace do shared (`npm run build --workspace=<pacote>`), nunca
 * `npm run build`/`turbo run build` do projeto inteiro. Adicionar uma
 * dependência de workspace nova em apps/frontend|backend muda o hash de cache
 * do turbo desses apps; buildar só o shared evita disparar rebuilds "por nada"
 * (e o bug de deleteOutDir + cache incremental do tsc do backend).
 *
 * Uso (execute a partir da raiz do monorepo):
 *   node setup.js [namespace]
 *
 * [namespace] é OPCIONAL. Se omitido, o escopo npm é detectado a partir dos
 * pacotes existentes (ex.: "@ai-driven-fullstack-project"), mantendo o shared
 * consistente com o resto do monorepo. Se informado, o "@" é opcional.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const SKILL_DIR = __dirname;
const ASSETS_DIR = path.join(SKILL_DIR, 'assets');
const APPS_DIR = path.join(ROOT, 'apps');
const MODULES_DIR = path.join(ROOT, 'modules');
const PACKAGES_DIR = path.join(ROOT, 'packages');
const FRONTEND_PKG = path.join(APPS_DIR, 'frontend', 'package.json');
const BACKEND_PKG = path.join(APPS_DIR, 'backend', 'package.json');
const ROOT_PKG = path.join(ROOT, 'package.json');
const SHARED_DIR = path.join(PACKAGES_DIR, 'shared');
const SHARED_NAME = 'shared';

let currentStep = 0;
const TOTAL_STEPS = 11;

function log(msg) {
  console.log(msg);
}

function step(name, fn) {
  currentStep += 1;
  log(`\n==> [${currentStep}/${TOTAL_STEPS}] ${name}`);
  try {
    return fn();
  } catch (err) {
    console.error(`\n[ERRO] Falha na etapa "${name}": ${err.message}`);
    process.exit(1);
  }
}

function run(command, cwd) {
  log(`    $ ${command}`);
  execSync(command, { cwd, stdio: 'inherit' });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, json) {
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Namespace / nomes de pacote
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

// Detecta o escopo npm (@algo) a partir de pacotes já existentes, para o shared
// ficar consistente com o resto do monorepo quando o namespace não é informado.
function detectScope() {
  const candidates = [
    BACKEND_PKG,
    FRONTEND_PKG,
    path.join(PACKAGES_DIR, 'typescript-config', 'package.json'),
    path.join(PACKAGES_DIR, 'ui', 'package.json'),
  ];
  for (const pkgPath of candidates) {
    if (!fs.existsSync(pkgPath)) continue;
    const name = readJson(pkgPath).name;
    if (name && name.startsWith('@') && name.includes('/')) {
      return name.split('/')[0];
    }
  }
  return null;
}

// Nome real do pacote de tsconfig compartilhado (ex.:
// "@ai-driven-fullstack-project/typescript-config"), lido do próprio pacote
// para não assumir o escopo errado.
function resolveTsconfigPackage(scope) {
  const tsconfigPkgPath = path.join(PACKAGES_DIR, 'typescript-config', 'package.json');
  if (fs.existsSync(tsconfigPkgPath)) {
    const name = readJson(tsconfigPkgPath).name;
    if (name) return name;
  }
  return `${scope}/typescript-config`;
}

function resolveNames() {
  const rawNamespace = process.argv[2];
  const scope = rawNamespace ? normalizeNamespace(rawNamespace) : detectScope();
  if (!scope) {
    throw new Error(
      'Não foi possível detectar o namespace/escopo npm do monorepo a partir dos ' +
        'pacotes existentes. Informe-o explicitamente: node setup.js <namespace> ' +
        '(ex: "@minha-empresa").'
    );
  }
  const packageName = `${scope}/${SHARED_NAME}`;
  const tsconfigPackage = resolveTsconfigPackage(scope);
  return { scope, packageName, tsconfigPackage };
}

// ---------------------------------------------------------------------------
// Pré-condições
// ---------------------------------------------------------------------------

function ensureMonorepoRoot() {
  if (!fs.existsSync(ROOT_PKG)) {
    throw new Error(
      `Nenhum package.json encontrado em ${ROOT}. Execute esta skill a partir da raiz ` +
        'do monorepo Turborepo (a pasta que contém "apps", "packages" e o package.json ' +
        'raiz com "workspaces").'
    );
  }
  const pkg = readJson(ROOT_PKG);
  if (!Array.isArray(pkg.workspaces)) {
    throw new Error(
      `O package.json em ${ROOT} não define "workspaces". Execute esta skill a partir ` +
        'da raiz do monorepo Turborepo.'
    );
  }
  if (!fs.existsSync(FRONTEND_PKG) || !fs.existsSync(BACKEND_PKG)) {
    throw new Error(
      'Não encontrei apps/frontend/package.json e apps/backend/package.json em ' +
        `${ROOT}. Execute esta skill a partir da raiz do monorepo Turborepo.`
    );
  }
}

function ensureAssetsAvailable() {
  const required = [
    'package.json',
    'tsconfig.json',
    'tsconfig.build.json',
    'jest.config.ts',
    'index.ts',
    'http.ts',
    'types.ts',
    'index.test.ts',
  ];
  for (const file of required) {
    if (!fs.existsSync(path.join(ASSETS_DIR, file))) {
      throw new Error(`Arquivo de template ausente na skill: assets/${file}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Criação do pacote packages/shared
// ---------------------------------------------------------------------------

function ensureSharedDirs() {
  fs.mkdirSync(path.join(SHARED_DIR, 'src'), { recursive: true });
  fs.mkdirSync(path.join(SHARED_DIR, 'test'), { recursive: true });
}

// Config files são determinísticos e sempre reescritos. Arquivos de código-fonte
// (src/*, test/*) são "create-only": em uma reexecução não sobrescrevemos o
// código real que já exista, para não apagar o que o time escreveu no shared.
function copyConfigFile(assetFile, destFile, substitutions) {
  let content = fs.readFileSync(path.join(ASSETS_DIR, assetFile), 'utf8');
  for (const [token, value] of Object.entries(substitutions || {})) {
    content = content.split(token).join(value);
  }
  fs.writeFileSync(destFile, content);
}

function copySourceFileIfMissing(assetFile, destFile) {
  if (fs.existsSync(destFile)) {
    log(`    ${path.relative(ROOT, destFile)} já existe; preservando (não sobrescrito).`);
    return;
  }
  fs.copyFileSync(path.join(ASSETS_DIR, assetFile), destFile);
}

function scaffoldShared(names) {
  copyConfigFile('package.json', path.join(SHARED_DIR, 'package.json'), {
    __PACKAGE_NAME__: names.packageName,
    __TSCONFIG_PKG__: names.tsconfigPackage,
  });
  copyConfigFile('tsconfig.json', path.join(SHARED_DIR, 'tsconfig.json'), {
    __TSCONFIG_PKG__: names.tsconfigPackage,
  });
  copyConfigFile('tsconfig.build.json', path.join(SHARED_DIR, 'tsconfig.build.json'), {});
  copyConfigFile('jest.config.ts', path.join(SHARED_DIR, 'jest.config.ts'), {});

  copySourceFileIfMissing('index.ts', path.join(SHARED_DIR, 'src', 'index.ts'));
  copySourceFileIfMissing('http.ts', path.join(SHARED_DIR, 'src', 'http.ts'));
  copySourceFileIfMissing('types.ts', path.join(SHARED_DIR, 'src', 'types.ts'));
  copySourceFileIfMissing('index.test.ts', path.join(SHARED_DIR, 'test', 'index.test.ts'));
}

// ---------------------------------------------------------------------------
// Ligação: todos dependem do shared
// ---------------------------------------------------------------------------

function addSharedDependency(pkgPath, sharedName) {
  const pkg = readJson(pkgPath);
  pkg.dependencies = pkg.dependencies || {};
  if (pkg.dependencies[sharedName]) {
    log(`    "${sharedName}" já presente em ${path.relative(ROOT, pkgPath)}.`);
    return;
  }
  pkg.dependencies[sharedName] = '*';
  writeJson(pkgPath, pkg);
  log(`    "${sharedName}" adicionado a ${path.relative(ROOT, pkgPath)}.`);
}

function listModulePackages() {
  if (!fs.existsSync(MODULES_DIR)) return [];
  return fs
    .readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(MODULES_DIR, entry.name, 'package.json'))
    .filter((pkgPath) => fs.existsSync(pkgPath));
}

function wireAppsToShared(sharedName) {
  addSharedDependency(FRONTEND_PKG, sharedName);
  addSharedDependency(BACKEND_PKG, sharedName);
}

function wireModulesToShared(sharedName) {
  const modulePkgs = listModulePackages();
  if (!modulePkgs.length) {
    log('    Nenhum módulo em modules/*; nada para ligar (ok).');
    return;
  }
  for (const pkgPath of modulePkgs) {
    // Um módulo nunca deve depender de si mesmo (caso improvável de existir um
    // módulo chamado "shared" em modules/, o que aqui não acontece).
    const pkg = readJson(pkgPath);
    if (pkg.name === sharedName) continue;
    addSharedDependency(pkgPath, sharedName);
  }
}

function ensurePackagesWorkspace() {
  const pkg = readJson(ROOT_PKG);
  pkg.workspaces = Array.isArray(pkg.workspaces) ? pkg.workspaces : [];
  if (pkg.workspaces.includes('packages/*')) {
    log('    "packages/*" já presente em "workspaces".');
    return;
  }
  pkg.workspaces.push('packages/*');
  writeJson(ROOT_PKG, pkg);
  log('    "packages/*" adicionado a "workspaces".');
}

// ---------------------------------------------------------------------------
// Instalação / build / testes (escopados ao shared)
// ---------------------------------------------------------------------------

function installDependencies() {
  run('npm install', ROOT);
}

function buildShared(packageName) {
  run(`npm run build --workspace=${packageName}`, ROOT);
}

function testShared(packageName) {
  run(`npm run test --workspace=${packageName}`, ROOT);
}

// ---------------------------------------------------------------------------
// Limpeza final
// ---------------------------------------------------------------------------

function finalCleanup() {
  // Remove um cache incremental do tsc que porventura tenha ficado na raiz do
  // pacote (o build usa outDir dist; qualquer tsbuildinfo solto é lixo).
  for (const file of ['tsconfig.tsbuildinfo', 'tsconfig.build.tsbuildinfo']) {
    const full = path.join(SHARED_DIR, file);
    if (fs.existsSync(full)) fs.rmSync(full, { force: true });
  }
  // Remove a pasta test/ se ela tiver ficado vazia (nunca deveria, mas mantém
  // o pacote limpo).
  const testDir = path.join(SHARED_DIR, 'test');
  if (fs.existsSync(testDir) && fs.readdirSync(testDir).length === 0) {
    fs.rmdirSync(testDir);
  }
}

// ---------------------------------------------------------------------------
// Verificação final
// ---------------------------------------------------------------------------

function finalVerification(names) {
  const checks = [
    [fs.existsSync(path.join(SHARED_DIR, 'package.json')), 'package.json do shared ausente'],
    [fs.existsSync(path.join(SHARED_DIR, 'tsconfig.json')), 'tsconfig.json do shared ausente'],
    [
      fs.existsSync(path.join(SHARED_DIR, 'tsconfig.build.json')),
      'tsconfig.build.json do shared ausente',
    ],
    [fs.existsSync(path.join(SHARED_DIR, 'jest.config.ts')), 'jest.config.ts do shared ausente'],
    [fs.existsSync(path.join(SHARED_DIR, 'src', 'index.ts')), 'src/index.ts do shared ausente'],
    [
      fs.existsSync(path.join(SHARED_DIR, 'dist', 'index.js')),
      'dist/index.js do shared ausente (build não gerou saída)',
    ],
    [
      fs.existsSync(path.join(SHARED_DIR, 'dist', 'index.d.ts')),
      'dist/index.d.ts do shared ausente (declarations não emitidas)',
    ],
  ];

  const sharedName = names.packageName;
  const frontendPkg = readJson(FRONTEND_PKG);
  const backendPkg = readJson(BACKEND_PKG);
  checks.push([
    !!(frontendPkg.dependencies && frontendPkg.dependencies[sharedName]),
    'dependência do shared ausente em apps/frontend/package.json',
  ]);
  checks.push([
    !!(backendPkg.dependencies && backendPkg.dependencies[sharedName]),
    'dependência do shared ausente em apps/backend/package.json',
  ]);

  for (const pkgPath of listModulePackages()) {
    const pkg = readJson(pkgPath);
    if (pkg.name === sharedName) continue;
    checks.push([
      !!(pkg.dependencies && pkg.dependencies[sharedName]),
      `dependência do shared ausente em ${path.relative(ROOT, pkgPath)}`,
    ]);
  }

  const rootPkg = readJson(ROOT_PKG);
  checks.push([
    rootPkg.workspaces.includes('packages/*'),
    '"packages/*" ausente em "workspaces" do package.json raiz',
  ]);

  const failures = checks.filter(([ok]) => !ok).map(([, msg]) => msg);
  if (failures.length) {
    throw new Error(`Verificação final falhou: ${failures.join('; ')}`);
  }

  log(`    Pacote "${sharedName}" criado e ligado a apps + modules com sucesso em: ${SHARED_DIR}`);
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

function main() {
  const names = step('Validando pré-condições e resolvendo namespace', () => {
    ensureAssetsAvailable();
    ensureMonorepoRoot();
    return resolveNames();
  });

  log(`    Namespace/escopo: ${names.scope}`);
  log(`    Pacote shared    : ${names.packageName}`);
  log(`    tsconfig base    : ${names.tsconfigPackage}`);

  step('Criando pasta packages/shared (src, test)', ensureSharedDirs);

  step(
    'Copiando templates determinísticos (package.json, tsconfig*, jest.config.ts, src/*, test/*)',
    () => scaffoldShared(names)
  );

  step('Ligando apps/frontend e apps/backend ao shared', () =>
    wireAppsToShared(names.packageName)
  );

  step('Ligando todos os módulos de negócio (modules/*) ao shared', () =>
    wireModulesToShared(names.packageName)
  );

  step('Garantindo "packages/*" em "workspaces" do package.json raiz', ensurePackagesWorkspace);

  step('Instalando dependências do projeto (npm install)', installDependencies);

  step(
    `Buildando SOMENTE o shared "${names.packageName}" (não impacta frontend/backend)`,
    () => buildShared(names.packageName)
  );

  step(`Testando o shared "${names.packageName}"`, () => testShared(names.packageName));

  step('Limpeza final (caches soltos, pastas vazias)', finalCleanup);

  step('Verificação final', () => finalVerification(names));

  log(`\n✔ Pacote de infraestrutura "${names.packageName}" configurado com sucesso em: ${SHARED_DIR}`);
}

main();
