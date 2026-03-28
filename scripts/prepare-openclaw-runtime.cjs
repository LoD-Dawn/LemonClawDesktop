'use strict';

const fs = require('fs');
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

function isRuntimeRoot(candidate) {
  if (!candidate || !fs.existsSync(candidate)) {
    return false;
  }

  const entryCandidates = [
    path.join(candidate, 'dist', 'entry.js'),
    path.join(candidate, 'dist', 'entry.mjs'),
    path.join(candidate, 'gateway.asar'),
    path.join(candidate, 'openclaw.mjs'),
  ];

  return entryCandidates.some((entry) => fs.existsSync(entry))
    && fs.existsSync(path.join(candidate, 'extensions'))
    && fs.existsSync(path.join(candidate, 'node_modules'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function replaceDir(srcDir, destDir) {
  const tmpDir = `${destDir}.tmp-${Date.now()}`;
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.cpSync(srcDir, tmpDir, { recursive: true, force: true });
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.renameSync(tmpDir, destDir);
}

function normalizeCandidate(inputPath) {
  if (!inputPath) {
    return [];
  }

  const resolved = path.resolve(inputPath);
  return [resolved, path.join(resolved, 'current')];
}

function dedupePaths(candidates) {
  const seen = new Set();
  const unique = [];
  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(candidate);
  }
  return unique;
}

function readBuildInfo(runtimeRoot) {
  const buildInfoPath = path.join(runtimeRoot, 'runtime-build-info.json');
  try {
    return JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeBuildInfo(runtimeRoot, metadata) {
  const buildInfoPath = path.join(runtimeRoot, 'runtime-build-info.json');
  const current = readBuildInfo(runtimeRoot);
  const next = {
    ...(current && typeof current === 'object' ? current : {}),
    ...metadata,
  };
  fs.writeFileSync(buildInfoPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

function main() {
  const rootDir = path.resolve(__dirname, '..');
  const targetId = (process.argv[2] || '').trim() || resolveHostTargetId();
  const runtimeBase = path.join(rootDir, 'vendor', 'openclaw-runtime');
  const currentRoot = path.join(runtimeBase, 'current');
  const siblingLobsterRuntimeBase = path.resolve(rootDir, '..', 'LobsterAI', 'vendor', 'openclaw-runtime');

  const candidatePaths = dedupePaths([
    currentRoot,
    ...normalizeCandidate(process.env.OPENCLAW_RUNTIME_DIR),
    path.join(runtimeBase, targetId),
    path.join(siblingLobsterRuntimeBase, targetId),
    path.join(siblingLobsterRuntimeBase, 'current'),
  ]);

  const runtimeSource = candidatePaths.find((candidate) => isRuntimeRoot(candidate));
  if (!runtimeSource) {
    console.error('[prepare-openclaw-runtime] No usable OpenClaw runtime found.');
    console.error(`[prepare-openclaw-runtime] Looked for target: ${targetId}`);
    console.error('[prepare-openclaw-runtime] Checked:');
    for (const candidate of candidatePaths) {
      console.error(`  - ${candidate}`);
    }
    console.error('[prepare-openclaw-runtime] Provide a built runtime via OPENCLAW_RUNTIME_DIR or populate vendor/openclaw-runtime/<target>.');
    process.exit(1);
  }

  if (path.normalize(runtimeSource) === path.normalize(currentRoot)) {
    console.log(`[prepare-openclaw-runtime] Runtime already ready at ${currentRoot}`);
    writeBuildInfo(currentRoot, {
      target: targetId,
      preparedAt: new Date().toISOString(),
      source: 'current',
    });
    return;
  }

  ensureDir(runtimeBase);
  replaceDir(runtimeSource, currentRoot);
  writeBuildInfo(currentRoot, {
    target: targetId,
    preparedAt: new Date().toISOString(),
    source: runtimeSource,
  });
  console.log(`[prepare-openclaw-runtime] Synced runtime from ${runtimeSource} -> ${currentRoot}`);
}

try {
  main();
} catch (error) {
  console.error(`[prepare-openclaw-runtime] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
