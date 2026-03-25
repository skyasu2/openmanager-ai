#!/usr/bin/env node

const fs = require('fs');
const path = require('node:path');

function normalizeFilePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function isVitestTestFile(filePath) {
  return /\.(test|spec)\.(ts|tsx)$/u.test(normalizeFilePath(filePath));
}

function isStoryFile(filePath) {
  return /\.stories\.(ts|tsx)$/u.test(normalizeFilePath(filePath));
}

function isTypeCheckInfraFile(filePath) {
  const normalized = normalizeFilePath(filePath);

  return (
    normalized === 'package.json' ||
    normalized === 'next-env.d.ts' ||
    path.matchesGlob(normalized, 'tsconfig*.json') ||
    path.matchesGlob(normalized, 'scripts/dev/typecheck-*') ||
    path.matchesGlob(normalized, 'scripts/dev/tsc-*')
  );
}

function isTypeCheckRelevantFile(filePath) {
  const normalized = normalizeFilePath(filePath);

  if (isTypeCheckInfraFile(normalized)) return true;
  if (!/\.(ts|tsx)$/u.test(normalized)) return false;
  if (isVitestTestFile(normalized)) return false;
  if (isStoryFile(normalized)) return false;
  if (normalized.startsWith('src/test/')) return false;
  if (normalized.startsWith('src/stories/')) return false;
  if (normalized.startsWith('src/archive/')) return false;
  if (normalized.startsWith('src/services/ai-agent/')) return false;
  if (normalized === 'src/services/ai/orchestrator/adapters/RAGAdapter.ts') return false;
  if (normalized === 'src/services/websocket/WebSocketManager.ts') return false;

  return normalized.startsWith('src/');
}

function filterTypeCheckRelevantFiles(files) {
  return Array.from(
    new Set(
      files
        .map(normalizeFilePath)
        .filter(Boolean)
        .filter((filePath) => isTypeCheckRelevantFile(filePath))
    )
  );
}

function readFilesFromStdin() {
  try {
    return fs.readFileSync(0, 'utf8').split('\n');
  } catch {
    return [];
  }
}

if (require.main === module) {
  const rawFiles = process.argv.length > 2 ? process.argv.slice(2) : readFilesFromStdin();
  const relevantFiles = filterTypeCheckRelevantFiles(rawFiles);
  if (relevantFiles.length > 0) {
    process.stdout.write(`${relevantFiles.join('\n')}\n`);
  }
}

module.exports = {
  filterTypeCheckRelevantFiles,
  isTypeCheckInfraFile,
  isTypeCheckRelevantFile,
  normalizeFilePath,
};
