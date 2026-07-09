#!/usr/bin/env node
'use strict';

/**
 * config-new-module
 *
 * Script determinístico que cria um novo módulo de negócio dentro da pasta
 * "modules" de um monorepo Turborepo (apps/frontend + apps/backend), a partir
 * dos templates estáticos em ./assets.
 *
 * Uso (execute a partir da raiz do monorepo, que é a própria raiz do
 * repositório — a config-project-fullstack não cria subpasta):
 *   node setup.js <nome-do-modulo> <namespace>
 *
 * <nome-do-modulo>  obrigatório. kebab-case, ex: "auth", "user-profile".
 * <namespace>       obrigatório. Escopo npm dos pacotes do monorepo,
 *                   ex: "@minha-empresa" (o "@" é opcional no argumento).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const SKILL_DIR = __dirname;
const ASSETS_DIR = path.join(SKILL_DIR, 'assets');
const MODULES_DIR = path.join(ROOT, 'modules');
const APPS_DIR = path.join(ROOT, 'apps');
const FRONTEND_PKG = path.join(APPS_DIR, 'frontend', 'package.json');
const BACKEND_PKG = path.join(APPS_DIR, 'backend', 'package.json');
const ROOT_PKG = path.join(ROOT, 'package.json');

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
// Validação de argumentos
// ---------------------------------------------------------------------------

function parseArgs() {
  const moduleName = process.argv[2];
  const rawNamespace = process.argv[3];

  if (!moduleName) {
    throw new Error(
      'Nome do módulo não informado. Uso: node setup.js <nome-do-modulo> <namespace>'
    );
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(moduleName)) {
    throw new Error(
      `Nome de módulo inválido: "${moduleName}". Use kebab-case (letras minúsculas, ` +
        'números e "-"), ex: "auth", "user-profile".'
    );
  }

  if (!rawNamespace) {
    throw new Error(
      'Namespace não informado. Esta skill não pode ser executada sem um namespace ' +
        '(ex: "@minha-empresa"). Uso: node setup.js <nome-do-modulo> <namespace>'
    );
  }
  const namespace = normalizeNamespace(rawNamespace);

  return { moduleName, namespace };
}

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
    'jest.config.ts',
    'tsconfig.json',
    'tsconfig.build.json',
    'package.json',
    'index.ts',
    'index.test.ts',
  ];
  for (const file of required) {
    if (!fs.existsSync(path.join(ASSETS_DIR, file))) {
      throw new Error(`Arquivo de template ausente na skill: assets/${file}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Criação do módulo
// ---------------------------------------------------------------------------

function ensureModuleDirs(moduleName) {
  const moduleDir = path.join(MODULES_DIR, moduleName);
  fs.mkdirSync(path.join(moduleDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(moduleDir, 'test'), { recursive: true });
  return moduleDir;
}

function copyTemplates(moduleDir, moduleName, namespace) {
  const packageName = `${namespace}/${moduleName}`;

  fs.copyFileSync(path.join(ASSETS_DIR, 'jest.config.ts'), path.join(moduleDir, 'jest.config.ts'));
  fs.copyFileSync(path.join(ASSETS_DIR, 'tsconfig.json'), path.join(moduleDir, 'tsconfig.json'));
  fs.copyFileSync(
    path.join(ASSETS_DIR, 'tsconfig.build.json'),
    path.join(moduleDir, 'tsconfig.build.json')
  );
  fs.copyFileSync(path.join(ASSETS_DIR, 'index.ts'), path.join(moduleDir, 'src', 'index.ts'));
  fs.copyFileSync(
    path.join(ASSETS_DIR, 'index.test.ts'),
    path.join(moduleDir, 'test', 'index.test.ts')
  );

  const pkgTemplate = fs.readFileSync(path.join(ASSETS_DIR, 'package.json'), 'utf8');
  const pkgContent = pkgTemplate.replace('@__NAMESPACE__/__MODULE_NAME__', packageName);
  fs.writeFileSync(path.join(moduleDir, 'package.json'), pkgContent);

  return packageName;
}

// ---------------------------------------------------------------------------
// Ligação com o resto do monorepo
// ---------------------------------------------------------------------------

function addDependencyToApp(appPkgPath, packageName) {
  const pkg = readJson(appPkgPath);
  pkg.dependencies = pkg.dependencies || {};
  pkg.dependencies[packageName] = '*';
  writeJson(appPkgPath, pkg);
}

// Todo módulo de negócio depende do pacote de infraestrutura "shared"
// (packages/shared), criado pela skill config-shared-package. Só adicionamos a
// dependência SE o shared já existir — caso contrário adicionar uma dependência
// de workspace inexistente quebraria o "npm install". Assim, "todos os módulos
// dependem do shared" também vale para os módulos criados depois do shared.
function addSharedDependencyIfPresent(moduleDir) {
  const sharedPkgPath = path.join(ROOT, 'packages', 'shared', 'package.json');
  if (!fs.existsSync(sharedPkgPath)) {
    log('    packages/shared não existe ainda; módulo criado sem dependência de "shared".');
    return;
  }
  const sharedName = readJson(sharedPkgPath).name;
  const pkgPath = path.join(moduleDir, 'package.json');
  const pkg = readJson(pkgPath);
  pkg.dependencies = pkg.dependencies || {};
  if (pkg.dependencies[sharedName]) {
    log(`    "${sharedName}" já presente nas dependências do módulo.`);
    return;
  }
  pkg.dependencies[sharedName] = '*';
  writeJson(pkgPath, pkg);
  log(`    Dependência "${sharedName}" adicionada ao módulo.`);
}

function ensureTsNodeInRoot() {
  const pkg = readJson(ROOT_PKG);
  pkg.devDependencies = pkg.devDependencies || {};
  if (!pkg.devDependencies['ts-node']) {
    pkg.devDependencies['ts-node'] = '^10.9.2';
    writeJson(ROOT_PKG, pkg);
    log('    "ts-node" adicionado ao devDependencies do package.json raiz.');
  } else {
    log(`    "ts-node" já presente no package.json raiz (${pkg.devDependencies['ts-node']}).`);
  }
}

function ensureModulesWorkspace() {
  const pkg = readJson(ROOT_PKG);
  pkg.workspaces = Array.isArray(pkg.workspaces) ? pkg.workspaces : [];
  if (pkg.workspaces.includes('modules/*')) {
    log('    "modules/*" já presente em "workspaces".');
    return;
  }
  const appsIndex = pkg.workspaces.indexOf('apps/*');
  if (appsIndex >= 0) {
    pkg.workspaces.splice(appsIndex + 1, 0, 'modules/*');
  } else {
    pkg.workspaces.unshift('modules/*');
  }
  writeJson(ROOT_PKG, pkg);
  log('    "modules/*" adicionado a "workspaces".');
}

// ---------------------------------------------------------------------------
// Instalação, build e testes
// ---------------------------------------------------------------------------

function installDependencies() {
  run('npm install', ROOT);
}

function buildModule(packageName) {
  // Importante: builda SOMENTE o workspace do módulo novo (não "npm run build"
  // /"turbo run build" na raiz). Adicionar uma dependência de workspace nova
  // em apps/frontend e apps/backend invalida o cache de build do turbo para
  // esses apps (o hash de "^build" muda), forçando "nest build" a rodar de
  // novo mesmo sem nenhuma mudança de código no backend. O nest-cli.json do
  // backend usa "deleteOutDir": true; combinado com o cache incremental do
  // tsc (tsconfig.tsbuildinfo), um rebuild "por nada" pode apagar dist/ e o
  // tsc, achando que nada mudou, não reemite os arquivos — deixando
  // dist/main.js ausente e o "npm run dev" do backend quebrado. Buildar só o
  // módulo evita disparar esse bug em apps que não têm nenhuma relação com a
  // mudança.
  run(`npm run build --workspace=${packageName}`, ROOT);
}

function testModule(packageName) {
  run(`npm run test --workspace=${packageName}`, ROOT);
}

// ---------------------------------------------------------------------------
// Verificação final
// ---------------------------------------------------------------------------

function finalVerification(moduleDir, packageName) {
  const checks = [
    [fs.existsSync(path.join(moduleDir, 'package.json')), 'package.json do módulo ausente'],
    [fs.existsSync(path.join(moduleDir, 'tsconfig.json')), 'tsconfig.json do módulo ausente'],
    [
      fs.existsSync(path.join(moduleDir, 'tsconfig.build.json')),
      'tsconfig.build.json do módulo ausente',
    ],
    [fs.existsSync(path.join(moduleDir, 'jest.config.ts')), 'jest.config.ts do módulo ausente'],
    [fs.existsSync(path.join(moduleDir, 'src', 'index.ts')), 'src/index.ts do módulo ausente'],
    [fs.existsSync(path.join(moduleDir, 'test', 'index.test.ts')), 'test/index.test.ts do módulo ausente'],
  ];

  const frontendPkg = readJson(FRONTEND_PKG);
  const backendPkg = readJson(BACKEND_PKG);
  checks.push([
    !!(frontendPkg.dependencies && frontendPkg.dependencies[packageName]),
    'dependência do módulo ausente em apps/frontend/package.json',
  ]);
  checks.push([
    !!(backendPkg.dependencies && backendPkg.dependencies[packageName]),
    'dependência do módulo ausente em apps/backend/package.json',
  ]);

  const rootPkg = readJson(ROOT_PKG);
  checks.push([
    rootPkg.workspaces.includes('modules/*'),
    '"modules/*" ausente em "workspaces" do package.json raiz',
  ]);
  checks.push([
    !!(rootPkg.devDependencies && rootPkg.devDependencies['ts-node']),
    '"ts-node" ausente em devDependencies do package.json raiz',
  ]);

  const failures = checks.filter(([ok]) => !ok).map(([, msg]) => msg);
  if (failures.length) {
    throw new Error(`Verificação final falhou: ${failures.join('; ')}`);
  }

  log(`    Módulo "${packageName}" criado e testado com sucesso em: ${moduleDir}`);
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

function main() {
  const { moduleName, namespace } = step('Validando argumentos e pré-condições', () => {
    ensureAssetsAvailable();
    ensureMonorepoRoot();
    return parseArgs();
  });

  const packageName = `${namespace}/${moduleName}`;

  const moduleDir = step(`Criando pasta modules/${moduleName}`, () => ensureModuleDirs(moduleName));

  step(
    'Copiando templates determinísticos (jest.config.ts, tsconfig.json, tsconfig.build.json, package.json, index.ts, index.test.ts)',
    () => copyTemplates(moduleDir, moduleName, namespace)
  );

  step('Adicionando dependência do módulo em apps/frontend e apps/backend', () => {
    addDependencyToApp(FRONTEND_PKG, packageName);
    addDependencyToApp(BACKEND_PKG, packageName);
  });

  step('Adicionando dependência do pacote "shared" ao módulo (se packages/shared existir)', () =>
    addSharedDependencyIfPresent(moduleDir)
  );

  step('Garantindo "ts-node" no package.json raiz', ensureTsNodeInRoot);

  step('Garantindo "modules/*" em "workspaces" do package.json raiz', ensureModulesWorkspace);

  step('Instalando dependências do projeto (npm install)', installDependencies);

  step(`Executando build do módulo "${packageName}" (npm run build --workspace)`, () =>
    buildModule(packageName)
  );

  step(`Executando testes do módulo "${packageName}"`, () => testModule(packageName));

  step('Verificação final', () => finalVerification(moduleDir, packageName));

  log(`\n✔ Módulo "${packageName}" configurado com sucesso em: ${moduleDir}`);
}

main();
