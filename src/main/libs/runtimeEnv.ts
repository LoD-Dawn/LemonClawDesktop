import fs from 'fs';
import path from 'path';

const loadedFiles = new Set<string>();
let didLoadRuntimeEnv = false;

const parseEnvValue = (rawValue: string): string => {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const loadEnvFile = (filePath: string): void => {
  if (loadedFiles.has(filePath) || !fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const exportPrefix = trimmed.startsWith('export ') ? 'export ' : '';
    const normalizedLine = exportPrefix ? trimmed.slice(exportPrefix.length) : trimmed;
    const separatorIndex = normalizedLine.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const value = parseEnvValue(normalizedLine.slice(separatorIndex + 1));
    process.env[key] = value;
  }

  loadedFiles.add(filePath);
};

export const loadRuntimeEnvFiles = (): void => {
  if (didLoadRuntimeEnv) {
    return;
  }
  didLoadRuntimeEnv = true;

  const cwd = process.cwd();
  const appRoot = path.resolve(__dirname, '..', '..', '..');
  const exeDir = path.dirname(process.execPath);
  const envName = process.env.NODE_ENV === 'development' ? 'development' : '';
  const fileNames = [
    '.env',
    '.env.local',
    envName ? `.env.${envName}` : '',
    envName ? `.env.${envName}.local` : '',
  ].filter(Boolean);

  const roots = Array.from(new Set([
    cwd,
    appRoot,
    exeDir,
    path.join(exeDir, 'resources'),
  ]));

  for (const root of roots) {
    for (const fileName of fileNames) {
      loadEnvFile(path.join(root, fileName));
    }
  }
};

loadRuntimeEnvFiles();
