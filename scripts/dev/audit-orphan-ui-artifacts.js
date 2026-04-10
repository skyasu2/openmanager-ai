#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SUPPORTED_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
const STORY_PATTERN = /\.stories\.(tsx|ts|jsx|js)$/u;
const TEST_PATTERN = /\.(test|spec)\.(tsx|ts|jsx|js)$/u;
const IMPORT_PATTERN =
  /(?:import|export)\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gu;

function toPosix(filePath) {
  return String(filePath).replace(/\\/g, '/');
}

function walkFiles(rootDir) {
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  return files.sort();
}

function isStoryFile(filePath) {
  return STORY_PATTERN.test(filePath);
}

function isTestFile(filePath) {
  return TEST_PATTERN.test(filePath);
}

function isTargetFile(filePath) {
  return isStoryFile(filePath) || isTestFile(filePath);
}

function extractRelativeImports(sourceText) {
  const imports = [];
  for (const match of sourceText.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] || match[2];
    if (!specifier || !specifier.startsWith('.')) continue;
    imports.push(specifier);
  }
  return [...new Set(imports)];
}

function resolveModuleSpecifier(fromFile, specifier) {
  const basePath = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    basePath,
    ...SUPPORTED_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...SUPPORTED_EXTENSIONS.map((extension) =>
      path.join(basePath, `index${extension}`)
    ),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function resolveStorySiblingCandidates(storyFile) {
  const basePath = storyFile.replace(STORY_PATTERN, '');
  return SUPPORTED_EXTENSIONS.map((extension) => `${basePath}${extension}`);
}

function auditUiArtifacts({ cwd = process.cwd(), rootDir = 'src' } = {}) {
  const absoluteRootDir = path.resolve(cwd, rootDir);
  const targetFiles = walkFiles(absoluteRootDir).filter(isTargetFile);

  const brokenRelativeImports = [];
  const manualReviewStories = [];
  const checkedFiles = [];

  for (const filePath of targetFiles) {
    const sourceText = fs.readFileSync(filePath, 'utf8');
    const relativeImports = extractRelativeImports(sourceText);
    checkedFiles.push(toPosix(path.relative(cwd, filePath)));

    for (const specifier of relativeImports) {
      const resolved = resolveModuleSpecifier(filePath, specifier);
      if (!resolved) {
        brokenRelativeImports.push({
          file: toPosix(path.relative(cwd, filePath)),
          import: specifier,
        });
      }
    }

    if (!isStoryFile(filePath)) continue;

    const hasDirectSibling = resolveStorySiblingCandidates(filePath).some(
      (candidate) => fs.existsSync(candidate)
    );
    if (!hasDirectSibling) {
      manualReviewStories.push(toPosix(path.relative(cwd, filePath)));
    }
  }

  return {
    ok: brokenRelativeImports.length === 0,
    checkedFileCount: checkedFiles.length,
    brokenRelativeImports,
    manualReviewStories,
  };
}

function printAudit(result) {
  console.log('UI Artifact Audit');
  console.log(`- checked files: ${result.checkedFileCount}`);
  console.log(`- broken relative imports: ${result.brokenRelativeImports.length}`);
  console.log(`- manual-review stories: ${result.manualReviewStories.length}`);

  if (result.brokenRelativeImports.length > 0) {
    console.log('\nBroken relative imports');
    for (const item of result.brokenRelativeImports) {
      console.log(`- ${item.file} -> ${item.import}`);
    }
  }

  if (result.manualReviewStories.length > 0) {
    console.log('\nManual-review composed stories');
    for (const file of result.manualReviewStories) {
      console.log(`- ${file}`);
    }
  }
}

if (require.main === module) {
  const result = auditUiArtifacts();
  printAudit(result);
  process.exitCode = result.ok ? 0 : 1;
}

module.exports = {
  SUPPORTED_EXTENSIONS,
  extractRelativeImports,
  resolveModuleSpecifier,
  resolveStorySiblingCandidates,
  auditUiArtifacts,
};
