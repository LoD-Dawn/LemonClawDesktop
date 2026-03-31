'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

function fail(message) {
  console.error(`[dist-mac] ${message}`);
  process.exit(1);
}

function resolvePackageManagerInvocation() {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath],
    };
  }

  try {
    const npmPackageJsonPath = require.resolve('npm/package.json');
    return {
      command: process.execPath,
      args: [path.join(path.dirname(npmPackageJsonPath), 'bin', 'npm-cli.js')],
    };
  } catch {}

  if (process.platform === 'win32') {
    return {
      command: process.env.ComSpec || process.env.COMSPEC || 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd'],
    };
  }

  return {
    command: 'npm',
    args: [],
  };
}

function resolveHostArch() {
  if (process.arch === 'x64' || process.arch === 'arm64') {
    return process.arch;
  }
  fail(`Unsupported macOS host architecture: ${process.arch}`);
}

function parseArgs(argv) {
  let arch = '';
  const passthrough = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg.startsWith('--arch=')) {
      arch = arg.slice('--arch='.length).trim();
      continue;
    }

    if (arg === '--arch') {
      arch = (argv[index + 1] || '').trim();
      index += 1;
      continue;
    }

    passthrough.push(arg);
  }

  return { arch: arch || resolveHostArch(), passthrough };
}

function runNpmScript(scriptName, packageManager, rootDir) {
  console.log(`[dist-mac] Running npm script: ${scriptName}`);
  const result = spawnSync(packageManager.command, [
    ...packageManager.args,
    'run',
    scriptName,
  ], {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
  });

  if (typeof result.status === 'number' && result.status === 0) {
    return;
  }

  fail(`npm script failed: ${scriptName}`);
}

function runElectronBuilder(arch, passthroughArgs, packageManager, rootDir) {
  const archFlag = arch === 'x64' ? '--x64' : '--arm64';
  const args = [
    ...packageManager.args,
    'exec',
    'electron-builder',
    '--',
    '--config',
    'electron-builder.json',
    '--mac',
    archFlag,
    ...passthroughArgs,
  ];

  console.log(`[dist-mac] Running electron-builder for ${arch}`);
  const result = spawnSync(packageManager.command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
  });

  if (typeof result.status === 'number' && result.status === 0) {
    return;
  }

  fail(`electron-builder failed for arch=${arch}`);
}

function main() {
  if (process.platform !== 'darwin') {
    fail(`macOS packaging must run on a macOS host (current: ${process.platform}).`);
  }

  const { arch, passthrough } = parseArgs(process.argv.slice(2));
  if (arch === 'universal') {
    fail(
      'Universal macOS packaging is currently unsupported because the bundled '
      + 'OpenClaw runtime is architecture-specific. Build x64 and arm64 separately instead.'
    );
  }

  if (arch !== 'x64' && arch !== 'arm64') {
    fail(`Unsupported macOS target architecture: ${arch}`);
  }

  const rootDir = path.resolve(__dirname, '..');
  const packageManager = resolvePackageManagerInvocation();

  runNpmScript('build', packageManager, rootDir);
  runNpmScript('compile:electron', packageManager, rootDir);
  runNpmScript('build:skills', packageManager, rootDir);
  runNpmScript(`openclaw:runtime:mac-${arch}`, packageManager, rootDir);
  runElectronBuilder(arch, passthrough, packageManager, rootDir);
}

main();
