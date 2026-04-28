/**
 * @vitest-environment node
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT_PATH = fileURLToPath(
  new URL(
    '../../../scripts/qa/check-vercel-deployment-drift.mjs',
    import.meta.url
  )
);

const tempDirs: string[] = [];
const servers: ReturnType<typeof createServer>[] = [];
let isLoopbackBindAvailable = true;

function createTempWorkspace() {
  const tempDir = mkdtempSync(join(tmpdir(), 'vercel-deployment-drift-'));
  tempDirs.push(tempDir);
  return tempDir;
}

function runScript(cwd: string, args: string[] = []) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(process.execPath, [SCRIPT_PATH, ...args], {
        cwd,
        env: {
          ...process.env,
          NODE_OPTIONS: '',
          NODE_V8_COVERAGE: '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
      });

      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });

      child.on('error', reject);
      child.on('close', (status) => {
        resolve({ status, stdout, stderr });
      });
    }
  );
}

async function startServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void
) {
  const server = createServer(handler);

  await new Promise<void>((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      server.off('error', onError);
      reject(error);
    };

    server.once('error', onError);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError);
      resolve();
    });
  });

  servers.push(server);

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind local drift test server');
  }

  return `http://127.0.0.1:${address.port}`;
}

async function detectLoopbackBindAvailability() {
  const probeServer = createServer((_req, res) => {
    res.statusCode = 200;
    res.end('ok');
  });
  let probeListening = false;

  await new Promise<void>((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      probeServer.off('error', onError);
      if (error.code === 'EPERM') {
        isLoopbackBindAvailable = false;
        resolve();
        return;
      }
      reject(error);
    };

    probeServer.once('error', onError);
    probeServer.listen(0, '127.0.0.1', () => {
      probeServer.off('error', onError);
      probeListening = true;
      resolve();
    });
  });

  if (!probeListening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    probeServer.close((error) => {
      if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

beforeAll(async () => {
  await detectLoopbackBindAvailability();
});

function writeJson(res: ServerResponse, payload: unknown, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('check-vercel-deployment-drift', () => {
  it('returns drift exit code when deployed commit differs from expected commit', async () => {
    if (!isLoopbackBindAvailable) return;

    const baseUrl = await startServer((req, res) => {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;

      if (pathname === '/api/version') {
        writeJson(res, {
          version: '8.12.0',
          buildVersion: '8.12.0',
          environment: 'production',
          commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          releaseTag: 'v8.12.0',
        });
        return;
      }

      res.statusCode = 404;
      res.end('not found');
    });

    const result = await runScript(createTempWorkspace(), [
      `--url=${baseUrl}`,
      '--expected-version=8.12.0',
      '--expected-commit-sha=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ]);

    expect(result.status).toBe(2);
    expect(`${result.stdout}${result.stderr}`).toContain('deployment drift');
    expect(`${result.stdout}${result.stderr}`).toContain('commitSha');
  });
});
