/**
 * @vitest-environment node
 */

import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const SCRIPT_PATH = `${REPO_ROOT}/scripts/ci/ai-engine-post-deploy-smoke.sh`;

async function startAiEngineFixture(version: string) {
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');

    if (request.url === '/health') {
      response.statusCode = 200;
      response.end(
        JSON.stringify({
          status: 'ok',
          service: 'ai-engine',
          version,
        })
      );
      return;
    }

    if (request.url === '/warmup') {
      response.statusCode = 200;
      response.end(JSON.stringify({ status: 'warmed_up' }));
      return;
    }

    if (request.url === '/monitoring') {
      response.statusCode = 403;
      response.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'Not found' }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address() as AddressInfo;
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function runSmoke(url: string, expectedVersion: string) {
  return new Promise<{
    status: number | null;
    stdout: string;
    stderr: string;
  }>((resolve) => {
    const child = spawn('bash', [SCRIPT_PATH, `--url=${url}`], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        AI_ENGINE_EXPECTED_VERSION: expectedVersion,
        AI_ENGINE_SMOKE_RETRIES: '0',
        AI_ENGINE_SMOKE_RETRY_DELAY_S: '0',
        AI_ENGINE_SMOKE_TIMEOUT_S: '3',
      },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

describe('ai-engine-post-deploy-smoke.sh', () => {
  it('passes when /health.version matches the expected AI Engine component version', async () => {
    const { server, url } = await startAiEngineFixture('1.2.3');

    try {
      const result = await runSmoke(url, '1.2.3');

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('- expected version: 1.2.3');
      expect(result.stdout).toContain('- smoke: pass');
    } finally {
      await closeServer(server);
    }
  });

  it('fails when /health.version differs from the expected AI Engine component version', async () => {
    const { server, url } = await startAiEngineFixture('1.2.2');

    try {
      const result = await runSmoke(url, '1.2.3');

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'expected /health.version 1.2.3, got 1.2.2'
      );
    } finally {
      await closeServer(server);
    }
  });
});
