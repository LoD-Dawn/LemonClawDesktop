import { app } from 'electron';
import { resolve } from 'path';

export function getDevProjectRoot(): string {
  const appPath = app.getAppPath();
  const normalized = appPath.replace(/\\/g, '/').replace(/\/+$/, '');

  if (normalized.endsWith('/dist-electron/main')) {
    return resolve(appPath, '..', '..');
  }

  if (normalized.endsWith('/dist-electron')) {
    return resolve(appPath, '..');
  }

  return appPath;
}
