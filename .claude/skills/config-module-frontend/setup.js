#!/usr/bin/env node
'use strict';

/**
 * config-module-frontend
 *
 * Script determinístico que adiciona uma rota Next.js (App Router) pública ou
 * privada para um módulo já criado pela skill "config-new-module" em
 * modules/<nome-do-modulo>. O componente de página reutilizável vive em
 * modules/<nome-do-modulo>/src (mesmo padrão da "config-module-backend"), e o
 * arquivo de rota em apps/frontend só importa e renderiza esse componente.
 *
 * Pré-requisito: modules/<nome-do-modulo>/package.json já deve existir (rode
 * "config-new-module" antes, se ainda não existir).
 *
 * Uso (execute a partir da raiz do monorepo, ex: dentro de "projeto-capsule"):
 *   node setup.js <nome-do-modulo> <public|private>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const SKILL_DIR = __dirname;
const ASSETS_DIR = path.join(SKILL_DIR, 'assets');
const APPS_DIR = path.join(ROOT, 'apps');
const FRONTEND_DIR = path.join(APPS_DIR, 'frontend');
const FRONTEND_PKG = path.join(FRONTEND_DIR, 'package.json');
const APP_DIR = path.join(FRONTEND_DIR, 'src', 'app');
const ROOT_PKG = path.join(ROOT, 'package.json');

const REACT_DEPS = {
  react: '^19.2.0',
  'react-dom': '^19.2.0',
};
const REACT_TEST_DEPS = {
  '@types/react': '^19.2.2',
  '@types/react-dom': '^19.2.2',
  '@testing-library/react': '^16.1.0',
  'jest-environment-jsdom': '^30.0.0',
};

let currentStep = 0;
const TOTAL_STEPS = 16;

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
// Conversões de nome
// ---------------------------------------------------------------------------

function kebabToPascalCase(kebab) {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// ---------------------------------------------------------------------------
// Validação de argumentos e pré-condições
// ---------------------------------------------------------------------------

function parseArgs() {
  const moduleName = process.argv[2];
  const visibility = process.argv[3];

  if (!moduleName) {
    throw new Error(
      'Nome do módulo não informado. Uso: node setup.js <nome-do-modulo> <public|private>'
    );
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(moduleName)) {
    throw new Error(
      `Nome de módulo inválido: "${moduleName}". Use kebab-case (letras minúsculas, ` +
        'números e "-"), ex: "auth", "user-profile".'
    );
  }
  if (visibility !== 'public' && visibility !== 'private') {
    throw new Error(
      `Visibilidade inválida: "${visibility}". Use "public" ou "private". ` +
        'Uso: node setup.js <nome-do-modulo> <public|private>'
    );
  }
  return { moduleName, visibility };
}

function ensureMonorepoRoot() {
  if (!fs.existsSync(ROOT_PKG)) {
    throw new Error(
      `Nenhum package.json encontrado em ${ROOT}. Execute esta skill a partir da raiz ` +
        'do monorepo Turborepo (a pasta que contém "apps", "packages"/"modules" e o ' +
        'package.json raiz com "workspaces").'
    );
  }
  if (!fs.existsSync(FRONTEND_PKG) || !fs.existsSync(APP_DIR)) {
    throw new Error(
      `Não encontrei ${FRONTEND_PKG} e/ou ${APP_DIR}. Execute esta skill a partir da raiz ` +
        'do monorepo Turborepo, com um app Next.js (App Router) em apps/frontend.'
    );
  }
}

function ensureAssetsAvailable() {
  const required = [
    'page.tsx',
    'page.spec.tsx',
    'jest.config.ts',
    'route-page.tsx',
    'route-layout.tsx',
    'route-loading.tsx',
    'route-error.tsx',
    'route-not-found.tsx',
    'private-layout.tsx',
  ];
  for (const file of required) {
    if (!fs.existsSync(path.join(ASSETS_DIR, file))) {
      throw new Error(`Arquivo de template ausente na skill: assets/${file}`);
    }
  }
}

function resolveModule(moduleName) {
  const moduleDir = path.join(ROOT, 'modules', moduleName);
  const pkgPath = path.join(moduleDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error(
      `modules/${moduleName}/package.json não existe. Esta skill complementa a ` +
        '"config-new-module": rode "node .claude/skills/config-new-module/setup.js ' +
        `${moduleName} <namespace>" primeiro para criar o pacote do módulo.`
    );
  }
  const pkg = readJson(pkgPath);
  if (!pkg.name || !pkg.name.endsWith(`/${moduleName}`)) {
    throw new Error(
      `O campo "name" de modules/${moduleName}/package.json ("${pkg.name}") não termina ` +
        `em "/${moduleName}" como esperado.`
    );
  }
  return { moduleDir, packageName: pkg.name };
}

// ---------------------------------------------------------------------------
// Geração do componente de página reutilizável (modules/<nome>/src)
// ---------------------------------------------------------------------------

function substitute(content, names) {
  return content
    .split('__CLASS__')
    .join(names.className)
    .split('__KEBAB__')
    .join(names.moduleName)
    .split('__PACKAGE__')
    .join(names.packageName || '');
}

function writeTemplate(assetFile, destFile, names) {
  const template = fs.readFileSync(path.join(ASSETS_DIR, assetFile), 'utf8');
  fs.writeFileSync(destFile, substitute(template, names));
}

function generatePageComponent(moduleDir, names) {
  const srcDir = path.join(moduleDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });

  writeTemplate('page.tsx', path.join(srcDir, `${names.moduleName}-page.tsx`), names);
  writeTemplate('page.spec.tsx', path.join(srcDir, `${names.moduleName}-page.spec.tsx`), names);
}

function removeGenericStub(moduleDir) {
  const testDir = path.join(moduleDir, 'test');
  const stubTest = path.join(testDir, 'index.test.ts');
  if (fs.existsSync(stubTest)) {
    fs.rmSync(stubTest, { force: true });
  }
  if (fs.existsSync(testDir) && fs.readdirSync(testDir).length === 0) {
    fs.rmdirSync(testDir);
  }
}

// Merge idempotente em src/index.ts (mesma lógica da config-module-backend):
// outras skills complementares também adicionam exports no mesmo arquivo, em
// qualquer ordem de execução, então nunca sobrescrevemos o arquivo inteiro.
function upsertIndexExports(indexPath, exportLines) {
  let content = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
  content = content.replace(/export function ping\(\): string \{\n  return 'pong';\n\}\n?/, '');
  for (const line of exportLines) {
    if (!content.includes(line)) {
      content = content.length && !content.endsWith('\n') ? `${content}\n` : content;
      content += `${line}\n`;
    }
  }
  fs.writeFileSync(indexPath, content);
}

function updateJestConfig(moduleDir) {
  fs.copyFileSync(
    path.join(ASSETS_DIR, 'jest.config.ts'),
    path.join(moduleDir, 'jest.config.ts')
  );
}

function updateModuleTsconfig(moduleDir) {
  const tsconfigPath = path.join(moduleDir, 'tsconfig.json');
  const tsconfig = readJson(tsconfigPath);
  tsconfig.compilerOptions = tsconfig.compilerOptions || {};
  tsconfig.compilerOptions.jsx = 'react-jsx';
  writeJson(tsconfigPath, tsconfig);
}

function updateModulePackageJson(moduleDir) {
  const pkgPath = path.join(moduleDir, 'package.json');
  const pkg = readJson(pkgPath);

  pkg.main = 'dist/index.js';
  pkg.types = 'dist/index.d.ts';

  pkg.dependencies = pkg.dependencies || {};
  for (const [dep, version] of Object.entries(REACT_DEPS)) {
    if (!pkg.dependencies[dep]) pkg.dependencies[dep] = version;
  }

  pkg.devDependencies = pkg.devDependencies || {};
  for (const [dep, version] of Object.entries(REACT_TEST_DEPS)) {
    if (!pkg.devDependencies[dep]) pkg.devDependencies[dep] = version;
  }

  writeJson(pkgPath, pkg);
}

// ---------------------------------------------------------------------------
// Ligação com o frontend (Next.js App Router)
// ---------------------------------------------------------------------------

function ensureFrontendDependency(packageName) {
  const pkg = readJson(FRONTEND_PKG);
  pkg.dependencies = pkg.dependencies || {};
  if (pkg.dependencies[packageName]) {
    log(`    Dependência "${packageName}" já presente em apps/frontend/package.json.`);
    return;
  }
  pkg.dependencies[packageName] = '*';
  writeJson(FRONTEND_PKG, pkg);
  log(`    Dependência "${packageName}" adicionada a apps/frontend/package.json.`);
}

function ensurePrivateGroupLayout() {
  const privateLayoutPath = path.join(APP_DIR, '(private)', 'layout.tsx');
  if (fs.existsSync(privateLayoutPath)) {
    log('    apps/frontend/src/app/(private)/layout.tsx já existe; mantendo como está.');
    return;
  }
  fs.mkdirSync(path.dirname(privateLayoutPath), { recursive: true });
  fs.copyFileSync(path.join(ASSETS_DIR, 'private-layout.tsx'), privateLayoutPath);
  log('    apps/frontend/src/app/(private)/layout.tsx criado com guard placeholder.');
}

function createRouteFiles(visibility, names) {
  const routeDir = path.join(APP_DIR, `(${visibility})`, names.moduleName);
  fs.mkdirSync(routeDir, { recursive: true });

  writeTemplate('route-page.tsx', path.join(routeDir, 'page.tsx'), names);
  writeTemplate('route-layout.tsx', path.join(routeDir, 'layout.tsx'), names);
  writeTemplate('route-loading.tsx', path.join(routeDir, 'loading.tsx'), names);
  writeTemplate('route-error.tsx', path.join(routeDir, 'error.tsx'), names);
  writeTemplate('route-not-found.tsx', path.join(routeDir, 'not-found.tsx'), names);

  return routeDir;
}

// ---------------------------------------------------------------------------
// Instalação, build e testes
// ---------------------------------------------------------------------------

function installDependencies() {
  run('npm install', ROOT);
}

function buildModule(packageName) {
  run(`npm run build --workspace=${packageName}`, ROOT);
}

function testModule(packageName) {
  run(`npm run test --workspace=${packageName}`, ROOT);
}

function buildFrontend() {
  // Ao contrário do backend, o "next build" não sofre do bug de cache
  // incremental do tsc (não usa deleteOutDir + tsc incremental), então não é
  // preciso limpar nenhum cache antes de buildar de novo.
  run('npm run build --workspace=frontend', ROOT);
}

// ---------------------------------------------------------------------------
// Verificação final
// ---------------------------------------------------------------------------

function finalVerification(moduleDir, routeDir, names, packageName, visibility) {
  const srcDir = path.join(moduleDir, 'src');
  const checks = [
    [
      fs.existsSync(path.join(srcDir, `${names.moduleName}-page.tsx`)),
      'componente de página do módulo ausente',
    ],
    [
      fs.existsSync(path.join(moduleDir, 'dist', 'index.js')),
      'dist/index.js do módulo ausente (build não gerou saída)',
    ],
    [fs.existsSync(path.join(routeDir, 'page.tsx')), 'page.tsx da rota ausente'],
    [fs.existsSync(path.join(routeDir, 'layout.tsx')), 'layout.tsx da rota ausente'],
    [fs.existsSync(path.join(routeDir, 'loading.tsx')), 'loading.tsx da rota ausente'],
    [fs.existsSync(path.join(routeDir, 'error.tsx')), 'error.tsx da rota ausente'],
    [fs.existsSync(path.join(routeDir, 'not-found.tsx')), 'not-found.tsx da rota ausente'],
  ];

  if (visibility === 'private') {
    checks.push([
      fs.existsSync(path.join(APP_DIR, '(private)', 'layout.tsx')),
      'apps/frontend/src/app/(private)/layout.tsx ausente',
    ]);
  }

  const frontendPkg = readJson(FRONTEND_PKG);
  checks.push([
    !!(frontendPkg.dependencies && frontendPkg.dependencies[packageName]),
    'dependência do módulo ausente em apps/frontend/package.json',
  ]);

  checks.push([
    fs.existsSync(path.join(FRONTEND_DIR, '.next')),
    'build do frontend (.next) ausente',
  ]);

  const failures = checks.filter(([ok]) => !ok).map(([, msg]) => msg);
  if (failures.length) {
    throw new Error(`Verificação final falhou: ${failures.join('; ')}`);
  }

  log(
    `    Rota "${visibility}" de "${packageName}" criada e ligada ao frontend com sucesso em: ${routeDir}`
  );
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

function main() {
  const { moduleName, visibility } = step('Validando argumentos e pré-condições', () => {
    ensureAssetsAvailable();
    ensureMonorepoRoot();
    return parseArgs();
  });

  const { moduleDir, packageName } = step(
    `Localizando modules/${moduleName} (criado pela config-new-module)`,
    () => resolveModule(moduleName)
  );

  const names = {
    moduleName,
    className: kebabToPascalCase(moduleName),
    packageName,
  };

  step('Gerando componente de página reutilizável e spec em modules/<nome>/src', () =>
    generatePageComponent(moduleDir, names)
  );

  step('Removendo stub genérico (test/index.test.ts) da config-new-module', () =>
    removeGenericStub(moduleDir)
  );

  step('Garantindo export da página em modules/<nome>/src/index.ts', () =>
    upsertIndexExports(path.join(moduleDir, 'src', 'index.ts'), [
      `export * from './${names.moduleName}-page';`,
    ])
  );

  step('Atualizando jest.config.ts do módulo (testMatch inclui src/**/*.spec.tsx)', () =>
    updateJestConfig(moduleDir)
  );

  step('Habilitando JSX no tsconfig.json do módulo', () => updateModuleTsconfig(moduleDir));

  step(
    'Atualizando package.json do módulo (React e Testing Library, main/types apontando para dist)',
    () => updateModulePackageJson(moduleDir)
  );

  step('Garantindo dependência do módulo em apps/frontend/package.json', () =>
    ensureFrontendDependency(packageName)
  );

  step(
    `Garantindo layout de proteção em apps/frontend/src/app/(private) ${
      visibility === 'private' ? '' : '(pulado: rota é pública)'
    }`,
    () => {
      if (visibility === 'private') ensurePrivateGroupLayout();
    }
  );

  const routeDir = step(`Criando rota "${visibility}" em apps/frontend/src/app/(${visibility})`, () =>
    createRouteFiles(visibility, names)
  );

  step('Instalando dependências do projeto (npm install)', installDependencies);

  step(`Buildando o módulo "${packageName}"`, () => buildModule(packageName));

  step(`Testando o módulo "${packageName}" (componente de página)`, () =>
    testModule(packageName)
  );

  step('Buildando o frontend com a rota nova', buildFrontend);

  step('Verificação final', () =>
    finalVerification(moduleDir, routeDir, names, packageName, visibility)
  );

  log(
    `\n✔ Rota "${visibility}" do módulo "${packageName}" criada em apps/frontend/src/app/(${visibility})/${names.moduleName}.`
  );
}

main();
