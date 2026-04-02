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
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = fileURLToPath(
  new URL('../../../scripts/test/vercel-post-deploy-smoke.mjs', import.meta.url)
);

const tempDirs: string[] = [];
const servers: ReturnType<typeof createServer>[] = [];

function buildChildProcessEnv(
  overrides: NodeJS.ProcessEnv = {}
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...overrides,
  };

  for (const key of Object.keys(env)) {
    if (
      key === 'NODE_OPTIONS' ||
      key === 'NODE_V8_COVERAGE' ||
      key.startsWith('VITEST') ||
      key.startsWith('npm_')
    ) {
      delete env[key];
    }
  }

  return env;
}

function createTempWorkspace() {
  const tempDir = mkdtempSync(join(tmpdir(), 'vercel-post-deploy-smoke-'));
  tempDirs.push(tempDir);
  return tempDir;
}

function runScript(
  cwd: string,
  args: string[] = [],
  env: NodeJS.ProcessEnv = {}
) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(process.execPath, [SCRIPT_PATH, ...args], {
        cwd,
        env: buildChildProcessEnv(env),
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
  servers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind local smoke test server');
  }

  return `http://127.0.0.1:${address.port}`;
}

function writeHtml(res: ServerResponse, html: string, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

function writeJson(res: ServerResponse, payload: unknown, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
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

  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('vercel-post-deploy-smoke', () => {
  it('passes when landing, validation, and version routes are healthy', async () => {
    const baseUrl = await startServer((req, res) => {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;

      if (pathname === '/') {
        writeHtml(res, '<html><body><h1>OpenManager AI</h1></body></html>');
        return;
      }

      if (pathname === '/validation') {
        writeHtml(
          res,
          '<html><body><main>Validation Evidence</main></body></html>'
        );
        return;
      }

      if (pathname === '/api/version') {
        writeJson(res, {
          version: '9.0.0',
          environment: 'production',
        });
        return;
      }

      res.statusCode = 404;
      res.end('not found');
    });

    const result = await runScript(createTempWorkspace(), [
      `--url=${baseUrl}`,
      '--retries=0',
    ]);

    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      'Smoke passed on attempt 1/1'
    );
  });

  it('retries transient failures before passing', async () => {
    let rootRequests = 0;

    const baseUrl = await startServer((req, res) => {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;

      if (pathname === '/') {
        rootRequests += 1;
        if (rootRequests === 1) {
          writeHtml(res, '<html><body>warming up</body></html>', 503);
          return;
        }

        writeHtml(res, '<html><body><h1>OpenManager AI</h1></body></html>');
        return;
      }

      if (pathname === '/validation') {
        writeHtml(
          res,
          '<html><body><main>Validation Evidence</main></body></html>'
        );
        return;
      }

      if (pathname === '/api/version') {
        writeJson(res, {
          version: '9.0.0',
          environment: 'production',
        });
        return;
      }

      res.statusCode = 404;
      res.end('not found');
    });

    const result = await runScript(createTempWorkspace(), [
      `--url=${baseUrl}`,
      '--retries=1',
      '--retry-delay-ms=10',
    ]);

    expect(result.status).toBe(0);
    expect(rootRequests).toBeGreaterThanOrEqual(2);
    expect(`${result.stdout}${result.stderr}`).toContain('Attempt 2/2');
  });

  it('fails when validation route does not expose expected marker', async () => {
    const baseUrl = await startServer((req, res) => {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;

      if (pathname === '/') {
        writeHtml(res, '<html><body><h1>OpenManager AI</h1></body></html>');
        return;
      }

      if (pathname === '/validation') {
        writeHtml(res, '<html><body><main>Release Notes</main></body></html>');
        return;
      }

      if (pathname === '/api/version') {
        writeJson(res, {
          version: '9.0.0',
          environment: 'production',
        });
        return;
      }

      res.statusCode = 404;
      res.end('not found');
    });

    const result = await runScript(createTempWorkspace(), [
      `--url=${baseUrl}`,
      '--retries=0',
    ]);

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain('GET /validation');
    expect(`${result.stdout}${result.stderr}`).toContain('Validation Evidence');
  });
});
