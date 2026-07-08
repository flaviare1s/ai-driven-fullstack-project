#!/usr/bin/env node
'use strict';

/**
 * config-module-backend
 *
 * Script determinístico que adiciona arquitetura Nest.js (Module + Controller
 * + Service, com specs) dentro de um módulo já criado pela skill
 * "config-new-module" em modules/<nome-do-modulo>, e registra o módulo no
 * AppModule do backend (apps/backend/src/app.module.ts).
 *
 * Pré-requisito: modules/<nome-do-modulo>/package.json já deve existir (rode
 * a skill "config-new-module" antes, se ainda não existir).
 *
 * Uso (execute a partir da raiz do monorepo, ex: dentro de "projeto-capsule"):
 *   node setup.js <nome-do-modulo>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const SKILL_DIR = __dirname;
const ASSETS_DIR = path.join(SKILL_DIR, 'assets');
const APPS_DIR = path.join(ROOT, 'apps');
const BACKEND_DIR = path.join(APPS_DIR, 'backend');
const BACKEND_PKG = path.join(BACKEND_DIR, 'package.json');
const APP_MODULE_PATH = path.join(BACKEND_DIR, 'src', 'app.module.ts');
const ROOT_PKG = path.join(ROOT, 'package.json');

const NEST_RUNTIME_DEPS = {
  '@nestjs/common': '^11.0.1',
  '@nestjs/core': '^11.0.1',
  'reflect-metadata': '^0.2.2',
  rxjs: '^7.8.1',
};
const NEST_TEST_DEPS = {
  '@nestjs/testing': '^11.0.1',
};

let currentStep = 0;
const TOTAL_STEPS = 15;

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

function kebabToCamelCase(kebab) {
  const pascal = kebabToPascalCase(kebab);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// ---------------------------------------------------------------------------
// Validação de argumentos e pré-condições
// ---------------------------------------------------------------------------

function parseArgs() {
  const moduleName = process.argv[2];
  if (!moduleName) {
    throw new Error('Nome do módulo não informado. Uso: node setup.js <nome-do-modulo>');
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(moduleName)) {
    throw new Error(
      `Nome de módulo inválido: "${moduleName}". Use kebab-case (letras minúsculas, ` +
        'números e "-"), ex: "auth", "user-profile".'
    );
  }
  return moduleName;
}

function ensureMonorepoRoot() {
  if (!fs.existsSync(ROOT_PKG)) {
    throw new Error(
      `Nenhum package.json encontrado em ${ROOT}. Execute esta skill a partir da raiz ` +
        'do monorepo Turborepo (a pasta que contém "apps", "packages"/"modules" e o ' +
        'package.json raiz com "workspaces").'
    );
  }
  if (!fs.existsSync(BACKEND_PKG) || !fs.existsSync(APP_MODULE_PATH)) {
    throw new Error(
      `Não encontrei ${BACKEND_PKG} e/ou ${APP_MODULE_PATH}. Execute esta skill a partir ` +
        'da raiz do monorepo Turborepo, com um app NestJS em apps/backend.'
    );
  }
}

function ensureAssetsAvailable() {
  const required = [
    'module.ts',
    'controller.ts',
    'service.ts',
    'controller.spec.ts',
    'service.spec.ts',
    'jest.config.ts',
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
  return { moduleDir, pkgPath, packageName: pkg.name };
}

// ---------------------------------------------------------------------------
// Geração dos arquivos Nest.js (module, controller, service, specs)
// ---------------------------------------------------------------------------

function substitute(content, names) {
  return content
    .split('__CLASS__')
    .join(names.className)
    .split('__KEBAB__')
    .join(names.moduleName)
    .split('__CAMEL__')
    .join(names.camelName);
}

function writeTemplate(assetFile, destFile, names) {
  const template = fs.readFileSync(path.join(ASSETS_DIR, assetFile), 'utf8');
  fs.writeFileSync(destFile, substitute(template, names));
}

function generateNestArchitecture(moduleDir, names) {
  const srcDir = path.join(moduleDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });

  writeTemplate('module.ts', path.join(srcDir, `${names.moduleName}.module.ts`), names);
  writeTemplate('controller.ts', path.join(srcDir, `${names.moduleName}.controller.ts`), names);
  writeTemplate('service.ts', path.join(srcDir, `${names.moduleName}.service.ts`), names);
  writeTemplate(
    'controller.spec.ts',
    path.join(srcDir, `${names.moduleName}.controller.spec.ts`),
    names
  );
  writeTemplate(
    'service.spec.ts',
    path.join(srcDir, `${names.moduleName}.service.spec.ts`),
    names
  );
  upsertIndexExports(path.join(srcDir, 'index.ts'), [
    `export * from './${names.moduleName}.module';`,
    `export * from './${names.moduleName}.service';`,
  ]);
}

// Faz um merge idempotente em src/index.ts em vez de sobrescrevê-lo por
// inteiro: outras skills complementares (ex.: config-module-frontend) também
// adicionam exports no mesmo arquivo, em qualquer ordem de execução. Também
// remove o stub genérico "export function ping()" da config-new-module,
// caso ainda esteja presente.
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
  tsconfig.compilerOptions.experimentalDecorators = true;
  tsconfig.compilerOptions.emitDecoratorMetadata = true;
  writeJson(tsconfigPath, tsconfig);
}

function updateModulePackageJson(moduleDir) {
  const pkgPath = path.join(moduleDir, 'package.json');
  const pkg = readJson(pkgPath);

  pkg.main = 'dist/index.js';
  pkg.types = 'dist/index.d.ts';

  pkg.dependencies = pkg.dependencies || {};
  for (const [dep, version] of Object.entries(NEST_RUNTIME_DEPS)) {
    if (!pkg.dependencies[dep]) pkg.dependencies[dep] = version;
  }

  pkg.devDependencies = pkg.devDependencies || {};
  for (const [dep, version] of Object.entries(NEST_TEST_DEPS)) {
    if (!pkg.devDependencies[dep]) pkg.devDependencies[dep] = version;
  }

  writeJson(pkgPath, pkg);
}

// ---------------------------------------------------------------------------
// Ligação com o backend
// ---------------------------------------------------------------------------

function ensureBackendDependency(packageName) {
  const pkg = readJson(BACKEND_PKG);
  pkg.dependencies = pkg.dependencies || {};
  if (pkg.dependencies[packageName]) {
    log(`    Dependência "${packageName}" já presente em apps/backend/package.json.`);
    return;
  }
  pkg.dependencies[packageName] = '*';
  writeJson(BACKEND_PKG, pkg);
  log(`    Dependência "${packageName}" adicionada a apps/backend/package.json.`);
}

function registerInAppModule(packageName, className) {
  let content = fs.readFileSync(APP_MODULE_PATH, 'utf8');
  const moduleClassName = `${className}Module`;
  let changed = false;

  if (!content.includes(`from '${packageName}'`)) {
    const importLine = `import { ${moduleClassName} } from '${packageName}';`;
    const importBlockRegex = /^(import[^\n]*\n)+/;
    const match = content.match(importBlockRegex);
    if (match) {
      const block = match[0];
      content = content.slice(0, block.length) + importLine + '\n' + content.slice(block.length);
    } else {
      content = importLine + '\n' + content;
    }
    changed = true;
  }

  const arrayRegex = /imports:\s*\[([\s\S]*?)\]/;
  const arrayMatch = content.match(arrayRegex);
  if (!arrayMatch) {
    throw new Error(`Não encontrei "imports: [...]" no @Module de ${APP_MODULE_PATH}.`);
  }
  const arrayBody = arrayMatch[1];
  const alreadyRegistered = new RegExp(`\\b${moduleClassName}\\b`).test(arrayBody);
  if (!alreadyRegistered) {
    const trimmedBody = arrayBody.replace(/\s+$/, '');
    const hasEntries = trimmedBody.trim().length > 0;
    const separator = hasEntries ? (trimmedBody.endsWith(',') ? '\n    ' : ',\n    ') : '\n    ';
    const newBody = `${trimmedBody}${separator}${moduleClassName},\n  `;
    content = content.replace(arrayRegex, `imports: [${newBody}]`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(APP_MODULE_PATH, content);
    log(`    "${moduleClassName}" registrado em apps/backend/src/app.module.ts.`);
  } else {
    log(`    "${moduleClassName}" já estava registrado em apps/backend/src/app.module.ts.`);
  }
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

function clearBackendIncrementalCache() {
  // Ver "Por que o cache incremental do backend é limpo antes do build" no
  // SKILL.md: o nest-cli.json do backend usa "deleteOutDir": true junto com
  // cache incremental do tsc, o que pode deixar dist/main.js ausente após um
  // rebuild se o cache achar (incorretamente) que nada mudou. Como esta skill
  // de fato altera apps/backend/src/app.module.ts, sempre limpamos o cache
  // antes de buildar o backend para forçar uma reemissão completa e correta.
  for (const file of ['tsconfig.tsbuildinfo', 'tsconfig.build.tsbuildinfo']) {
    const full = path.join(BACKEND_DIR, file);
    if (fs.existsSync(full)) fs.rmSync(full, { force: true });
  }
}

function buildBackend() {
  clearBackendIncrementalCache();
  run('npm run build --workspace=backend', ROOT);
}

function testBackend() {
  run('npm run test --workspace=backend', ROOT);
}

// ---------------------------------------------------------------------------
// Verificação final
// ---------------------------------------------------------------------------

function finalVerification(moduleDir, names, packageName) {
  const srcDir = path.join(moduleDir, 'src');
  const checks = [
    [
      fs.existsSync(path.join(srcDir, `${names.moduleName}.module.ts`)),
      'module.ts do módulo ausente',
    ],
    [
      fs.existsSync(path.join(srcDir, `${names.moduleName}.controller.ts`)),
      'controller.ts do módulo ausente',
    ],
    [
      fs.existsSync(path.join(srcDir, `${names.moduleName}.service.ts`)),
      'service.ts do módulo ausente',
    ],
    [
      fs.existsSync(path.join(moduleDir, 'dist', 'index.js')),
      'dist/index.js do módulo ausente (build não gerou saída)',
    ],
  ];

  const appModuleContent = fs.readFileSync(APP_MODULE_PATH, 'utf8');
  checks.push([
    appModuleContent.includes(`${names.className}Module`),
    `${names.className}Module não está registrado em apps/backend/src/app.module.ts`,
  ]);

  const backendPkg = readJson(BACKEND_PKG);
  checks.push([
    !!(backendPkg.dependencies && backendPkg.dependencies[packageName]),
    'dependência do módulo ausente em apps/backend/package.json',
  ]);

  checks.push([
    fs.existsSync(path.join(BACKEND_DIR, 'dist', 'main.js')),
    'dist/main.js do backend ausente após o build',
  ]);

  const failures = checks.filter(([ok]) => !ok).map(([, msg]) => msg);
  if (failures.length) {
    throw new Error(`Verificação final falhou: ${failures.join('; ')}`);
  }

  log(`    Arquitetura Nest.js de "${packageName}" criada e ligada ao backend com sucesso.`);
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

function main() {
  const moduleName = step('Validando argumentos e pré-condições', () => {
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
    camelName: kebabToCamelCase(moduleName),
  };

  step('Gerando module.ts, controller.ts, service.ts e specs', () =>
    generateNestArchitecture(moduleDir, names)
  );

  step('Removendo stub genérico (test/index.test.ts) da config-new-module', () =>
    removeGenericStub(moduleDir)
  );

  step('Atualizando jest.config.ts do módulo (testMatch inclui src/**/*.spec.ts)', () =>
    updateJestConfig(moduleDir)
  );

  step('Habilitando decorators no tsconfig.json do módulo', () => updateModuleTsconfig(moduleDir));

  step(
    'Atualizando package.json do módulo (dependências Nest.js e main/types apontando para dist)',
    () => updateModulePackageJson(moduleDir)
  );

  step('Garantindo dependência do módulo em apps/backend/package.json', () =>
    ensureBackendDependency(packageName)
  );

  step('Registrando o módulo em apps/backend/src/app.module.ts', () =>
    registerInAppModule(packageName, names.className)
  );

  step('Instalando dependências do projeto (npm install)', installDependencies);

  step(`Buildando o módulo "${packageName}"`, () => buildModule(packageName));

  step(`Testando o módulo "${packageName}" (controller + service)`, () =>
    testModule(packageName)
  );

  step('Buildando o backend com o módulo registrado', buildBackend);

  step('Testando o backend', testBackend);

  step('Verificação final', () => finalVerification(moduleDir, names, packageName));

  log(
    `\n✔ Arquitetura Nest.js do módulo "${packageName}" criada e registrada em apps/backend/src/app.module.ts.`
  );
}

main();
