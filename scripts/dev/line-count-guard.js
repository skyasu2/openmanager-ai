#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = {
    warn: 500,
    fail: 800,
    root: process.cwd(),
    include: ['src', 'cloud-run/ai-engine/src'],
    includeTests: false,
    includeData: false,
    exts: ['.ts', '.tsx', '.js', '.jsx'],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--warn' && argv[i + 1]) args.warn = Number(argv[++i]);
    else if (token === '--fail' && argv[i + 1]) args.fail = Number(argv[++i]);
    else if (token === '--root' && argv[i + 1]) args.root = path.resolve(argv[++i]);
    else if (token === '--include' && argv[i + 1]) args.include = argv[++i].split(',').map((v) => v.trim()).filter(Boolean);
    else if (token === '--exts' && argv[i + 1]) args.exts = argv[++i].split(',').map((v) => v.trim()).filter(Boolean);
    else if (token === '--include-tests') args.includeTests = true;
    else if (token === '--include-data') args.includeData = true;
  }

  if (!Number.isFinite(args.warn) || !Number.isFinite(args.fail)) {
    throw new Error('--warn/--fail must be numbers');
  }
  if (args.warn <= 0 || args.fail <= 0) {
    throw new Error('--warn/--fail must be positive');
  }
  if (args.warn > args.fail) {
    throw new Error('--warn must be <= --fail');
  }

  return args;
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function shouldSkipFile(relPath, opts) {
  const normalized = toPosix(relPath);

  if (!opts.includeTests) {
    if (/\.(test|spec)\.[jt]sx?$/.test(normalized)) return true;
    if (/(^|\/)__tests__\//.test(normalized)) return true;
  }

  if (!opts.includeData) {
    if (/(^|\/)src\/data\//.test(normalized)) return true;
    if (normalized.endsWith('.data.ts') || normalized.endsWith('.data.tsx')) return true;
  }

  if (/(^|\/)__mocks__\//.test(normalized)) return true;
  if (/(^|\/)generated\//.test(normalized)) return true;

  return false;
}

function walk(dirPath, relBase, opts, out) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const abs = path.join(dirPath, entry.name);
    const rel = path.join(relBase, entry.name);
    const relPosix = toPosix(rel);

    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === '.next' ||
        entry.name === 'dist' ||
        entry.name === 'build' ||
        entry.name === 'coverage' ||
        entry.name === 'logs'
      ) {
        continue;
      }
      walk(abs, rel, opts, out);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!opts.exts.some((ext) => relPosix.endsWith(ext))) continue;
    if (shouldSkipFile(relPosix, opts)) continue;

    let content = '';
    try {
      content = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const lines = content.length === 0 ? 0 : content.split('\n').length;
    if (lines >= opts.warn) {
      out.push({ path: relPosix, lines });
    }
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const results = [];

  for (const includeDir of opts.include) {
    const absInclude = path.resolve(opts.root, includeDir);
    const relInclude = path.relative(opts.root, absInclude) || '.';
    walk(absInclude, relInclude, opts, results);
  }

  results.sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));

  const failures = results.filter((r) => r.lines >= opts.fail);
  const warnings = results.filter((r) => r.lines >= opts.warn && r.lines < opts.fail);

  console.log('📏 Line Count Guard');
  console.log(`   - warn: ${opts.warn}+ lines`);
  console.log(`   - fail: ${opts.fail}+ lines`);
  console.log(`   - scanned roots: ${opts.include.join(', ')}`);
  console.log(`   - include tests: ${opts.includeTests ? 'yes' : 'no'}`);
  console.log(`   - include data: ${opts.includeData ? 'yes' : 'no'}`);

  if (results.length === 0) {
    console.log('✅ No files over warning threshold.');
    return;
  }

  console.log('');
  console.log(`⚠️  ${results.length} file(s) over warning threshold`);
  for (const item of results) {
    const tag = item.lines >= opts.fail ? 'FAIL' : 'WARN';
    console.log(`   [${tag}] ${item.lines} lines - ${item.path}`);
  }

  console.log('');
  if (failures.length > 0) {
    console.error(`❌ ${failures.length} file(s) reached fail threshold (${opts.fail}+).`);
    process.exit(1);
  }

  console.log(`✅ ${warnings.length} warning file(s), no fail-threshold violations.`);
}

main();
