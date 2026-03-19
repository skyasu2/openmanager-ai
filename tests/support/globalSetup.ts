import * as path from 'node:path';
import * as dotenv from 'dotenv';

/**
 * Playwright Global Setup
 *
 * This runs once before any tests start, ensuring environment variables
 * are loaded into process.env and available to all worker processes.
 *
 * Unlike dotenv.config() in individual files, this guarantees:
 * - Environment variables are set before workers spawn
 * - Variables persist across test retries
 * - Consistent behavior in all test contexts
 */
export default function globalSetup() {
  // Load .env.e2e file from project root - quiet mode
  const projectRoot = path.resolve(__dirname, '../../');
  const result = dotenv.config({ path: path.join(projectRoot, '.env.e2e') });

  if (result.error) {
    const fallbackResult = dotenv.config({
      path: path.join(projectRoot, '.env.local'),
    });

    if (fallbackResult.error) {
      console.error('❌ [Global Setup] Failed to load .env or .env.e2e file');
    }
  }

  // Validate critical environment variables.
  // Vercel bypass is optional because some production deployments are public.
  const requiredVars = ['TEST_SECRET_KEY'];
  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  console.log('✅ [E2E] Environment loaded, starting tests...');
}
