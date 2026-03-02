// Cache /manifests/*.json responses for Storybook MCP addon.
// Uses file-based cache to survive any module re-evaluation.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const CACHE_TTL = 600_000; // 10 minutes (dev server; manifests regenerate on code change)
const CACHE_DIR = path.join(os.tmpdir(), 'storybook-manifest-cache');

// Ensure cache directory exists
try {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
} catch {}

function getCachePath(key) {
  return path.join(CACHE_DIR, key.replace(/[^a-z0-9.-]/gi, '_') + '.cache');
}

function readCache(key) {
  const filePath = getCachePath(key);
  try {
    const stat = fs.statSync(filePath);
    if (Date.now() - stat.mtimeMs > CACHE_TTL) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function writeCache(key, body) {
  const filePath = getCachePath(key);
  try {
    fs.writeFileSync(filePath, body, 'utf-8');
  } catch (err) {
    console.error(`[manifest-cache] write error: ${err.message}`);
  }
}

/** @param {import('express').Router} app */
module.exports = function manifestCacheMiddleware(app) {
  app.use('/manifests', (req, res, next) => {
    if (req.method !== 'GET' || !req.url.endsWith('.json')) {
      return next();
    }

    // Bypass header: let the real handler respond
    if (req.headers['x-manifest-cache-bypass']) {
      return next();
    }

    const key = req.url; // e.g. "/components.json"
    const cached = readCache(key);

    if (cached) {
      // Handle negative cache entries (404 responses)
      const negMatch = cached.match(/^__NEGATIVE_CACHE__(\d+)__(.*)$/s);
      if (negMatch) {
        const [, status, body] = negMatch;
        console.log(`[manifest-cache] HIT ${key} (negative, status ${status})`);
        res.statusCode = Number(status);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Manifest-Cache', 'HIT');
        res.end(body);
        return;
      }
      console.log(`[manifest-cache] HIT ${key} (${cached.length} bytes)`);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Manifest-Cache', 'HIT');
      res.removeHeader('Content-Length');
      res.end(cached);
      return;
    }

    console.log(`[manifest-cache] MISS ${key} — proxying`);

    const port =
      req.socket.localPort ||
      (req.headers.host && req.headers.host.split(':')[1]) ||
      6006;

    const proxyReq = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: `/manifests${req.url}`,
        method: 'GET',
        headers: {
          'x-manifest-cache-bypass': '1',
          'accept-encoding': 'identity',
        },
      },
      (proxyRes) => {
        const chunks = [];
        proxyRes.on('data', (chunk) => chunks.push(chunk));
        proxyRes.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          // Cache both successful responses and 404s (negative cache)
          // to avoid re-generating manifests that don't exist.
          const status = proxyRes.statusCode || 200;
          const cacheValue =
            status === 200 ? body : `__NEGATIVE_CACHE__${status}__${body}`;
          if (body.length > 0 || status === 404) {
            writeCache(key, cacheValue);
            console.log(
              `[manifest-cache] STORED ${key} (${cacheValue.length} bytes, status ${status})`
            );
          }
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.removeHeader('Content-Length');
          res.end(body);
        });
      }
    );

    proxyReq.on('error', (err) => {
      console.error(`[manifest-cache] proxy error: ${err.message}`);
      next();
    });

    proxyReq.end();
  });
};
