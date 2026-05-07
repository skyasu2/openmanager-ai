import { existsSync } from 'node:fs';
import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';

let loaded = false;

export function getLocalEnvFileCandidates(options?: {
  envFile?: string;
  cwd?: string;
  scriptDir?: string;
}): string[] {
  const scriptDir = options?.scriptDir ?? __dirname;
  const cwd = options?.cwd ?? process.cwd();
  const engineRoot = path.resolve(scriptDir, '..');
  const cloudRunRoot = path.resolve(engineRoot, '..');
  const repoRoot = path.resolve(cloudRunRoot, '..');

  return Array.from(
    new Set(
      [
        options?.envFile ?? process.env.ENV_FILE,
        path.resolve(engineRoot, '.env.local'),
        path.resolve(engineRoot, '.env'),
        path.resolve(cloudRunRoot, '.env.local'),
        path.resolve(cloudRunRoot, '.env'),
        path.resolve(cwd, '.env.local'),
        path.resolve(cwd, '.env'),
        path.resolve(cwd, '../.env.local'),
        path.resolve(cwd, '../.env'),
        path.resolve(cwd, '../../.env.local'),
        path.resolve(cwd, '../../.env'),
        path.resolve(repoRoot, '.env.local'),
        path.resolve(repoRoot, '.env'),
      ].filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0
      )
    )
  );
}

export function loadLocalEnv(): void {
  if (loaded) return;
  loaded = true;

  const candidates = getLocalEnvFileCandidates();

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    dotenvConfig({ path: filePath, override: false });
  }
}

loadLocalEnv();
