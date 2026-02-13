import { existsSync } from 'node:fs';
import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';

let loaded = false;

export function loadRuntimeEnv(): void {
  if (loaded) return;
  loaded = true;

  const libDir = __dirname;

  const candidates = new Set(
    [
      process.env.ENV_FILE,
      path.resolve(libDir, '../../.env.local'),
      path.resolve(libDir, '../../../.env.local'),
      path.resolve(process.cwd(), '.env.local'),
      path.resolve(process.cwd(), '../.env.local'),
      path.resolve(process.cwd(), '../../.env.local'),
      path.resolve(libDir, '../../.env'),
      path.resolve(libDir, '../../../.env'),
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

loadRuntimeEnv();
