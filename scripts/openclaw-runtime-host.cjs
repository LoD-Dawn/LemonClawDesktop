'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

function resolveHostTargetId() {
  const platformMap = {
    darwin: 'mac',
    win32: 'win',
    linux: 'linux',
  };
  const archMap = {
    x64: 'x64',
    arm64: 'arm64',
    ia32: 'ia32',
  };

  const platform = platformMap[process.platform];
  const arch = archMap[process.arch];
  if (!platform || !arch) {
    throw new Error(`Unsupported host platform/arch: ${process.platform}/${process.arch}`);
  }

  return `${platform}-${arch}`;
}

const targetId = resolveHostTargetId();
const rootDir = path.resolve(__dirname, '..');

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

const packageManager = resolvePackageManagerInvocation();

const result = spawnSync(packageManager.command, [
  ...packageManager.args,
  'run',
  `openclaw:runtime:${targetId}`,
], {
  cwd: rootDir,
  env: process.env,
  stdio: 'inherit',
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
