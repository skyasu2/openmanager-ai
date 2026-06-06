#!/usr/bin/env node
// Langfuse 트레이스를 REST API로 직접 조회 — 브라우저 로그인 없이 사용 가능
// Usage:
//   npm run langfuse:check              # 최근 20건 요약
//   npm run langfuse:check -- --limit 50
//   npm run langfuse:check -- --q supervisor   # 이름 필터
//   npm run langfuse:check -- --json           # 원시 JSON 출력

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

// ── .env.local 파서 ───────────────────────────────────────────────────────────

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return {};

  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

// ── Langfuse REST API ─────────────────────────────────────────────────────────

function fetchJson(url, authToken, timeoutMs = 12_000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        Authorization: `Basic ${authToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'openmanager-langfuse-check/1.0',
      },
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        clearTimeout(timer);
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          reject(new Error(`JSON parse error (status ${res.statusCode}): ${body.slice(0, 200)}`));
        }
      });
    });

    const timer = setTimeout(() => {
      req.destroy(new Error('Request timed out'));
    }, timeoutMs);

    req.on('error', (err) => { clearTimeout(timer); reject(err); });
    req.end();
  });
}

// ── 출력 포맷 헬퍼 ────────────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED   = '\x1b[31m';
const CYAN  = '\x1b[36m';
const BLUE  = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const IS_TTY = Boolean(process.stdout.isTTY);

function colorize(str, code) {
  if (!IS_TTY) return str;
  return `${code}${str}${RESET}`;
}

function truncate(str, len) {
  if (typeof str !== 'string') return '';
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function fmtMs(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTimestamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function resolveTraceLatencyMs(trace) {
  const info = extractRoutingInfo(trace);
  if (info.durationMs != null) {
    const metadataLatencyMs = Number(info.durationMs);
    if (Number.isFinite(metadataLatencyMs)) return metadataLatencyMs;
  }

  const traceLatencySeconds = Number(trace.latency);
  if (Number.isFinite(traceLatencySeconds)) return traceLatencySeconds * 1000;

  return null;
}

function latencyColor(ms) {
  if (ms == null) return DIM;
  if (ms < 2000) return GREEN;
  if (ms < 6000) return YELLOW;
  return RED;
}

function providerColor(p) {
  if (!p) return DIM;
  const lower = p.toLowerCase();
  if (lower.includes('mistral')) return MAGENTA;
  if (lower.includes('groq'))    return CYAN;
  if (lower.includes('cerebras')) return BLUE;
  if (lower.includes('deterministic')) return GREEN;
  return DIM;
}

// ── 트레이스 처리 ─────────────────────────────────────────────────────────────

function isAuxiliary(trace) {
  return trace.name?.startsWith('timeout_monitor_');
}

function extractRoutingInfo(trace) {
  const meta = trace.metadata || {};
  return {
    provider:   meta.provider    || meta.modelId    || null,
    modelId:    meta.modelId     || null,
    durationMs: meta.durationMs  || meta.ttfbMs     || null,
    finalAgent: meta.finalAgent  || null,
    toolsCalled: meta.toolsCalled || [],
    success:    meta.success != null ? meta.success : null,
    sampled:    meta.sampled != null ? meta.sampled : null,
    usedFallback: meta.usedFallback || false,
    routingVersion: meta.routingDecisionTrace?.version || null,
  };
}

function printTraceRow(trace, idx) {
  if (isAuxiliary(trace)) return;

  const info = extractRoutingInfo(trace);
  const num = colorize(String(idx + 1).padStart(2), DIM);
  const ts  = colorize(fmtTimestamp(trace.timestamp), DIM);
  const name = colorize(truncate(trace.name || '—', 32), BOLD);

  const provStr = truncate(info.provider || 'det', 12);
  const prov = colorize(provStr.padEnd(12), providerColor(info.provider || 'deterministic'));

  const latMs = resolveTraceLatencyMs(trace);
  const lat = colorize(fmtMs(latMs).padStart(7), latencyColor(latMs));

  const agentStr = info.finalAgent ? truncate(info.finalAgent, 14) : '—';
  const agent = colorize(agentStr.padEnd(14), DIM);

  const successStr = info.success === false
    ? colorize('FAIL', RED)
    : info.success === true
      ? colorize('ok  ', GREEN)
      : colorize('—   ', DIM);

  const inputPreview = typeof trace.input === 'string'
    ? colorize(truncate(trace.input, 36), DIM)
    : typeof trace.input === 'object' && trace.input
      ? colorize(truncate(JSON.stringify(trace.input), 36), DIM)
      : colorize('—', DIM);

  console.log(`${num} ${ts} ${name.padEnd(32)} ${prov} ${lat} ${agent} ${successStr} ${inputPreview}`);
}

function printSummary(traces) {
  const main = traces.filter(t => !isAuxiliary(t));
  if (main.length === 0) {
    console.log(colorize('  트레이스 없음', DIM));
    return;
  }

  const latencies = main
    .map(resolveTraceLatencyMs)
    .filter((latencyMs) => Number.isFinite(latencyMs));

  const avgLat = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;
  const p95Lat = latencies.length
    ? [...latencies].sort((a, b) => a - b)[Math.ceil(latencies.length * 0.95) - 1]
    : null;

  const providers = {};
  const agents = {};
  let failCount = 0;
  let fallbackCount = 0;

  for (const t of main) {
    const info = extractRoutingInfo(t);
    const pKey = info.provider || 'deterministic';
    providers[pKey] = (providers[pKey] || 0) + 1;
    if (info.finalAgent) agents[info.finalAgent] = (agents[info.finalAgent] || 0) + 1;
    if (info.success === false) failCount++;
    if (info.usedFallback) fallbackCount++;
  }

  console.log('');
  console.log(colorize('── 집계 통계 ────────────────────────────────', BOLD));
  console.log(`  총 트레이스(보조 제외): ${colorize(String(main.length), BOLD)}`);
  console.log(`  평균 지연: ${colorize(fmtMs(avgLat), latencyColor(avgLat))}  P95: ${colorize(fmtMs(p95Lat), latencyColor(p95Lat))}`);
  console.log(`  실패: ${failCount > 0 ? colorize(String(failCount), RED) : colorize('0', GREEN)}  폴백: ${fallbackCount > 0 ? colorize(String(fallbackCount), YELLOW) : colorize('0', DIM)}`);

  const provLines = Object.entries(providers)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${colorize(k, providerColor(k))} ×${v}`);
  console.log(`  Provider: ${provLines.join('  ')}`);

  if (Object.keys(agents).length > 0) {
    const agentLines = Object.entries(agents)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${truncate(k, 16)} ×${v}`);
    console.log(`  Agent:    ${agentLines.join('  ')}`);
  }
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const queryIdx = args.indexOf('--q');
  const wantJson  = args.includes('--json');
  const wantHelp  = args.includes('--help') || args.includes('-h');

  if (wantHelp) {
    console.log('Usage: npm run langfuse:check [-- options]');
    console.log('  --limit N   조회 건수 (기본 20, 최대 100)');
    console.log('  --q TERM    트레이스 이름 포함 필터');
    console.log('  --json      원시 JSON 출력');
    process.exit(0);
  }

  const limit = limitIdx >= 0 ? Math.min(parseInt(args[limitIdx + 1], 10) || 20, 100) : 20;
  const query = queryIdx >= 0 ? (args[queryIdx + 1] || '') : null;

  // 키 로드 (.env.local 우선, 환경변수 폴백)
  const envLocal = loadEnvLocal();
  const publicKey  = envLocal.LANGFUSE_PUBLIC_KEY  || process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey  = envLocal.LANGFUSE_SECRET_KEY  || process.env.LANGFUSE_SECRET_KEY;
  const baseUrl    = envLocal.LANGFUSE_BASE_URL     || process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com';

  if (!publicKey || !secretKey) {
    console.error(colorize('오류: LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY 미설정 (.env.local 확인)', RED));
    process.exit(1);
  }

  const authToken = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
  const fetchLimit = query ? Math.max(limit, 100) : limit;
  const url = `${baseUrl}/api/public/traces?limit=${fetchLimit}`;

  if (!wantJson && IS_TTY) process.stdout.write(colorize(`Langfuse 조회 중 (limit=${fetchLimit})…`, DIM) + '\r');

  let result;
  try {
    result = await fetchJson(url, authToken);
  } catch (err) {
    console.error(colorize(`\n네트워크 오류: ${err.message}`, RED));
    process.exit(1);
  }

  if (result.status !== 200) {
    console.error(colorize(`\nAPI 오류 (${result.status}): ${JSON.stringify(result.data)}`, RED));
    process.exit(1);
  }

  if (!wantJson && IS_TTY) process.stdout.write('\x1b[2K\r');

  let traces = result.data.data || [];

  // 이름 필터
  if (query) {
    const q = query.toLowerCase();
    traces = traces.filter(t => (t.name || '').toLowerCase().includes(q));
    traces = traces.slice(0, limit);
  }

  if (wantJson) {
    console.log(JSON.stringify(traces, null, 2));
    return;
  }

  // 헤더
  const headerFields = [
    '##'.padStart(2), '날짜·시각'.padEnd(14), '트레이스 이름'.padEnd(32),
    'Provider'.padEnd(12), 'Latency'.padStart(7),
    'Agent'.padEnd(14), 'St  ', '입력 요약',
  ];
  console.log(colorize('── Langfuse 최근 트레이스 ────────────────────────────────────────────────', BOLD));
  console.log(colorize(headerFields.join(' '), DIM));
  console.log(colorize('─'.repeat(110), DIM));

  const mainTraces = traces.filter(t => !isAuxiliary(t));
  if (mainTraces.length === 0) {
    console.log(colorize('  (결과 없음)', DIM));
  } else {
    mainTraces.forEach((t, i) => printTraceRow(t, i));
  }

  printSummary(traces);

  console.log('');
  console.log(colorize(`  Langfuse 대시보드: ${baseUrl}/project`, DIM));
}

main().catch((err) => {
  console.error(colorize(`치명적 오류: ${err.message}`, RED));
  process.exit(1);
});
