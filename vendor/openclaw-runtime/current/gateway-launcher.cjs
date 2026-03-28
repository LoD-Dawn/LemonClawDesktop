// Auto-generated CJS launcher for Windows — bundle-only mode.
// Loads gateway-bundle.mjs directly without dist/ fallback.
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const _log = (msg) => process.stderr.write('[openclaw-launcher] ' + msg + '\n');
const _t0 = Date.now();
const _elapsed = () => (Date.now() - _t0) + 'ms';
// ─── Compile cache setup ───
try {
  const { enableCompileCache, getCompileCacheDir } = require('node:module');
  const _ccDir = path.join(process.env.OPENCLAW_STATE_DIR || __dirname, '.compile-cache');
  enableCompileCache(_ccDir);
  _log('compile-cache dir=' + getCompileCacheDir());
} catch (_) {}
// ─── Load bundle ───
const bundlePath = path.join(__dirname, 'gateway-bundle.mjs');
const _realpath = (p) => { try { return fs.realpathSync(path.resolve(p)); } catch { return path.resolve(p); } };
const _launcherInArgv = process.argv[1] &&
  _realpath(process.argv[1]).toLowerCase() === _realpath(__filename).toLowerCase();
if (_launcherInArgv) {
  process.argv[1] = bundlePath;
} else {
  process.argv.splice(1, 0, bundlePath);
}
const _keepAlive = setInterval(() => {}, 30000);
const bundleUrl = pathToFileURL(bundlePath).href;
_log('loading bundle (' + _elapsed() + ')');
import(bundleUrl).then(() => {
  _log('import ok (' + _elapsed() + ')');
  try { require('node:module').flushCompileCache(); } catch (_) {}
}).catch((err) => {
  _log('import failed (' + _elapsed() + '): ' + (err.stack || err));
  process.exit(1);
});
