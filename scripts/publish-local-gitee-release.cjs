const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
}

function getPackageVersion() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

function requireArtifacts(rootDir) {
  if (!fs.existsSync(rootDir)) {
    throw new Error(`Artifacts directory not found: ${rootDir}`);
  }

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  if (!entries.some((entry) => entry.isDirectory() || entry.isFile())) {
    throw new Error(`Artifacts directory is empty: ${rootDir}`);
  }
}

function buildTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

function runNodeScript(scriptPath, args, env) {
  execFileSync(process.execPath, [scriptPath, ...args], {
    stdio: 'inherit',
    env,
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const prerelease = (args.prerelease || process.env.RELEASE_PRERELEASE || 'true') === 'true';
  const version = args.version || process.env.RELEASE_VERSION || getPackageVersion();
  const artifactsDir = path.resolve(args['artifacts-dir'] || process.env.RELEASE_ARTIFACTS_DIR || 'artifacts');
  const changelogPath = path.resolve(args['changelog-output'] || process.env.CHANGELOG_OUTPUT || 'CHANGELOG.auto.md');
  const timestamp = buildTimestamp();
  const tag = args.tag || process.env.RELEASE_TAG || `main-${version}-local-${timestamp}`;
  const name =
    args.name ||
    process.env.RELEASE_NAME ||
    (prerelease ? `LemonClaw ${version} local build ${timestamp}` : `LemonClaw ${tag}`);
  const target = args.target || process.env.RELEASE_TARGET || 'main';
  const env = {
    ...process.env,
    RELEASE_TAG: tag,
    RELEASE_NAME: name,
    RELEASE_TARGET: target,
    RELEASE_PRERELEASE: prerelease ? 'true' : 'false',
  };

  requireArtifacts(artifactsDir);

  runNodeScript(path.join('scripts', 'generate-gitee-changelog.cjs'), ['--output', changelogPath], env);
  runNodeScript(
    path.join('scripts', 'create-gitee-release.cjs'),
    ['--body-file', changelogPath, '--release-dir', artifactsDir],
    env,
  );
}

main();
