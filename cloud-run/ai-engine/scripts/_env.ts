import { existsSync } from 'node:fs';
import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';

let loaded = false;

export function loadLocalEnv(): void {
  if (loaded) return;
  loaded = true;

  const scriptDir = __dirname;

  const candidates = new Set(
    [
      process.env.ENV_FILE,
      path.resolve(scriptDir, '../.env.local'),
      path.resolve(scriptDir, '../../.env.local'),
      path.resolve(process.cwd(), '.env.local'),
      path.resolve(process.cwd(), '../.env.local'),
      path.resolve(process.cwd(), '../../.env.local'),
      path.resolve(scriptDir, '../.env'),
      path.resolve(scriptDir, '../../.env'),
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), '../.env'),
      path.resolve(process.cwd(), '../../.env'),
    ].filter((value): value is string => typeof value === 'string' && value.length > 0)
  );

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    dotenvConfig({ path: filePath, override: false });
  }
}

loadLocalEnv();
