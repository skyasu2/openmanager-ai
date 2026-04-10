#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SCRIPT_MODULE_EXTENSIONS = [
  '',
  '.js',
  '.cjs',
  '.mjs',
  '.ts',
  '.tsx',
  '.json',
];
const RELATIVE_IMPORT_PATTERN =
  /(?:import|export)\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/gu;

const DEFAULT_SCAN_ROOTS = [
  'package.json',
  '.gitlab-ci.yml',
  '.github',
  '.husky',
  '.codex',
  '.mcp.json',
  '.claude',
  'cloud-run',
  'docs',
  'reports/docs',
  'reports/planning',
  'reports/history',
  'tests',
  'scripts',
  'README.md',
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
];
const IGNORED_SCAN_FILE_PATTERNS = [
  /(^|\/)script-reference-audit-\d{4}-\d{2}-\d{2}\.md$/u,
];
const IGNORED_SCAN_DIR_NAMES = new Set([
  '.git',
  '.next',
  '.turbo',
  '.vercel',
  'coverage',
  'dist',
  'build',
  'node_modules',
  'playwright-report',
  'test-results',
  'tmp',
]);
const MAX_SCAN_FILE_BYTES = 1024 * 1024;

function toPosix(filePath) {
  return String(filePath).replace(/\\/g, '/');
}

function walkFiles(rootPath) {
  const files = [];
  if (!fs.existsSync(rootPath)) {
    return files;
  }

  const stats = fs.statSync(rootPath);
  if (stats.isFile()) {
    return [rootPath];
  }

  const stack = [rootPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_SCAN_DIR_NAMES.has(entry.name)) {
          continue;
        }
        stack.push(absolutePath);
        continue;
      }
      if (entry.isFile()) {
        if (/\.(?:bak|tmp|orig)(?:\..+)?$/u.test(entry.name)) {
          continue;
        }
        files.push(absolutePath);
      }
    }
  }

  return files.sort();
}

function collectScanFiles(cwd, scanRoots = DEFAULT_SCAN_ROOTS) {
  const files = [];
  for (const root of scanRoots) {
    const absoluteRoot = path.resolve(cwd, root);
    files.push(...walkFiles(absoluteRoot));
  }
  return [
    ...new Set(
      files
        .map((filePath) => path.resolve(filePath))
        .filter((filePath) => {
          const relativePath = toPosix(path.relative(cwd, filePath));
          return !IGNORED_SCAN_FILE_PATTERNS.some((pattern) =>
            pattern.test(relativePath)
          );
        })
    ),
  ];
}

function isIgnoredScanFile(relativePath) {
  const normalized = toPosix(relativePath);
  return IGNORED_SCAN_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function collectTargetScripts(cwd, rootDir = 'scripts') {
  const absoluteRoot = path.resolve(cwd, rootDir);
  return walkFiles(absoluteRoot).filter((absolutePath) => {
    const relativePath = toPosix(path.relative(cwd, absolutePath));
    return !relativePath.endsWith('.md');
  });
}

function classifyReference(relativePath) {
  const normalized = toPosix(relativePath);

  if (
    normalized === 'package.json' ||
    normalized === '.gitlab-ci.yml' ||
    normalized.startsWith('.github/') ||
    normalized.startsWith('.husky/') ||
    normalized.startsWith('.codex/') ||
    normalized === '.mcp.json' ||
    normalized.startsWith('.claude/') ||
    normalized === 'AGENTS.md' ||
    normalized === 'CLAUDE.md' ||
    normalized === 'GEMINI.md' ||
    normalized.startsWith('cloud-run/') ||
    normalized.startsWith('scripts/')
  ) {
    return 'runtime';
  }

  if (normalized.startsWith('tests/')) {
    return 'test';
  }

  return 'docs';
}

function extractRelativeImports(sourceText) {
  const imports = [];
  for (const match of sourceText.matchAll(RELATIVE_IMPORT_PATTERN)) {
    const specifier = match[1] || match[2] || match[3];
    if (!specifier || !specifier.startsWith('.')) continue;
    imports.push(specifier);
  }
  return [...new Set(imports)];
}

function resolveRelativeModule(fromFile, specifier) {
  const basePath = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    ...SCRIPT_MODULE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...SCRIPT_MODULE_EXTENSIONS.map((extension) =>
      path.join(basePath, `index${extension}`)
    ),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function readTextFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_SCAN_FILE_BYTES) {
      return null;
    }
    const contents = fs.readFileSync(filePath, 'utf8');
    return contents.includes('\0') ? null : contents;
  } catch (error) {
    return null;
  }
}

function auditScriptReferences({
  cwd = process.cwd(),
  scriptRoot = 'scripts',
  scanRoots = DEFAULT_SCAN_ROOTS,
} = {}) {
  const targets = collectTargetScripts(cwd, scriptRoot);
  const scanFiles = collectScanFiles(cwd, scanRoots);
  const targetRelativePaths = targets.map((absolutePath) =>
    toPosix(path.relative(cwd, absolutePath))
  );

  const refsByTarget = new Map(
    targetRelativePaths.map((relativePath) => [
      relativePath,
      { runtime: new Set(), test: new Set(), docs: new Set() },
    ])
  );

  for (const filePath of scanFiles) {
    const sourcePath = toPosix(path.relative(cwd, filePath));
    if (isIgnoredScanFile(sourcePath)) continue;
    const sourceText = readTextFile(filePath);
    if (!sourceText) continue;
    const category = classifyReference(sourcePath);

    for (const matchedTarget of targetRelativePaths) {
      if (sourcePath === matchedTarget) continue;
      if (!sourceText.includes(matchedTarget)) continue;

      const bucket = refsByTarget.get(matchedTarget);
      if (!bucket) continue;
      bucket[category].add(sourcePath);
    }
  }

  const results = targets.map((absolutePath) => {
    const relativePath = toPosix(path.relative(cwd, absolutePath));
    const refs = refsByTarget.get(relativePath) || {
      runtime: new Set(),
      test: new Set(),
      docs: new Set(),
    };
    const uniqueRefs = {
      runtime: [...refs.runtime].sort(),
      test: [...refs.test].sort(),
      docs: [...refs.docs].sort(),
    };

    let status = 'runtime-referenced';
    if (uniqueRefs.runtime.length === 0) {
      if (uniqueRefs.test.length > 0) {
        status = 'test-only';
      } else if (uniqueRefs.docs.length > 0) {
        status = 'docs-only';
      } else {
        status = 'unreferenced';
      }
    }

    return {
      file: relativePath,
      status,
      refs: uniqueRefs,
    };
  });

  for (const sourcePath of targets) {
    let sourceText = '';
    try {
      sourceText = fs.readFileSync(sourcePath, 'utf8');
    } catch (error) {
      continue;
    }

    const sourceRelativePath = toPosix(path.relative(cwd, sourcePath));
    for (const specifier of extractRelativeImports(sourceText)) {
      const resolved = resolveRelativeModule(sourcePath, specifier);
      if (!resolved) continue;
      const targetRelativePath = toPosix(path.relative(cwd, resolved));
      const targetResult = results.find((result) => result.file === targetRelativePath);
      if (!targetResult) continue;
      if (!targetResult.refs.runtime.includes(sourceRelativePath)) {
        targetResult.refs.runtime.push(sourceRelativePath);
        targetResult.refs.runtime.sort();
      }
    }
  }

  for (const result of results) {
    if (result.refs.runtime.length > 0) {
      result.status = 'runtime-referenced';
      continue;
    }
    if (result.refs.test.length > 0) {
      result.status = 'test-only';
      continue;
    }
    if (result.refs.docs.length > 0) {
      result.status = 'docs-only';
      continue;
    }
    result.status = 'unreferenced';
  }

  return {
    checkedFileCount: results.length,
    runtimeReferenced: results.filter((result) => result.status === 'runtime-referenced'),
    docsOnly: results.filter((result) => result.status === 'docs-only'),
    testOnly: results.filter((result) => result.status === 'test-only'),
    unreferenced: results.filter((result) => result.status === 'unreferenced'),
    results,
  };
}

function printAudit(summary) {
  console.log('Script Reference Audit');
  console.log(`- checked files: ${summary.checkedFileCount}`);
  console.log(`- runtime referenced: ${summary.runtimeReferenced.length}`);
  console.log(`- docs-only: ${summary.docsOnly.length}`);
  console.log(`- test-only: ${summary.testOnly.length}`);
  console.log(`- unreferenced: ${summary.unreferenced.length}`);

  const sections = [
    ['Docs-only candidates', summary.docsOnly],
    ['Test-only candidates', summary.testOnly],
    ['Unreferenced candidates', summary.unreferenced],
  ];

  for (const [title, items] of sections) {
    if (items.length === 0) continue;
    console.log(`\n${title}`);
    for (const item of items.slice(0, 40)) {
      const refs =
        item.status === 'docs-only'
          ? item.refs.docs
          : item.status === 'test-only'
            ? item.refs.test
            : [];
      const hint = refs.length > 0 ? ` (${refs[0]})` : '';
      console.log(`- ${item.file}${hint}`);
    }
  }
}

if (require.main === module) {
  const summary = auditScriptReferences();
  printAudit(summary);
}

module.exports = {
  DEFAULT_SCAN_ROOTS,
  collectScanFiles,
  collectTargetScripts,
  classifyReference,
  auditScriptReferences,
  isIgnoredScanFile,
};
