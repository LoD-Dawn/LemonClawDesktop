'use strict';

/**
 * Bundle the OpenClaw gateway entry point into a single file using esbuild.
 *
 * This keeps Electron startup time reasonable on Windows by avoiding the
 * cold-load cost of the runtime's large ESM graph.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const runtimeDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(rootDir, 'vendor', 'openclaw-runtime', 'current');

const bundleOutPath = path.join(runtimeDir, 'gateway-bundle.mjs');
const gatewayEntryPath = path.join(runtimeDir, 'dist', 'gateway-entry.js');
const fullEntryPath = path.join(runtimeDir, 'dist', 'entry.js');
const entryPath = fs.existsSync(gatewayEntryPath) ? gatewayEntryPath : fullEntryPath;

if (!fs.existsSync(entryPath)) {
  console.error(`[bundle-openclaw-gateway] Entry point not found: ${entryPath}`);
  console.error('[bundle-openclaw-gateway] Make sure the OpenClaw runtime is prepared first.');
  process.exit(1);
}

if (fs.existsSync(bundleOutPath)) {
  const bundleStat = fs.statSync(bundleOutPath);
  const entryStat = fs.statSync(entryPath);
  if (bundleStat.mtimeMs > entryStat.mtimeMs) {
    console.log('[bundle-openclaw-gateway] Bundle is up-to-date, skipping.');
    process.exit(0);
  }
}

console.log(`[bundle-openclaw-gateway] Bundling: ${path.relative(runtimeDir, entryPath)}`);
console.log(`[bundle-openclaw-gateway] Output:   ${path.relative(runtimeDir, bundleOutPath)}`);

const EXTERNAL_PACKAGES = [
  'sharp', '@img/*',
  '@lydell/*',
  '@mariozechner/*',
  '@napi-rs/*',
  '@snazzah/*',
  'koffi',
  'electron',
  'node-llama-cpp',
  'ffmpeg-static',
  'chromium-bidi', 'playwright-core', 'playwright',
  'better-sqlite3',
  'jiti',
];

let esbuild;
try {
  esbuild = require('esbuild');
} catch {
  console.error('[bundle-openclaw-gateway] esbuild not found.');
  process.exit(1);
}

const t0 = Date.now();

esbuild
  .build({
    entryPoints: [entryPath],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundleOutPath,
    external: EXTERNAL_PACKAGES,
    banner: {
      js: `import { createRequire as __bundleCreateRequire } from 'node:module';\n`
        + `import { fileURLToPath as __bundleFileURLToPath } from 'node:url';\n`
        + `const require = __bundleCreateRequire(import.meta.url);\n`
        + `const __filename = __bundleFileURLToPath(import.meta.url);\n`
        + `const __dirname = __bundleFileURLToPath(new URL('.', import.meta.url));\n`,
    },
    logLevel: 'warning',
  })
  .then((result) => {
    const elapsed = Date.now() - t0;
    const sizeKB = Math.round(fs.statSync(bundleOutPath).size / 1024);
    console.log(
      `[bundle-openclaw-gateway] Done in ${elapsed}ms (${sizeKB} KB)`
      + (result.warnings.length ? `, ${result.warnings.length} warnings` : ''),
    );
  })
  .catch((err) => {
    console.error('[bundle-openclaw-gateway] esbuild failed:', err.message || err);
    process.exit(1);
  });
