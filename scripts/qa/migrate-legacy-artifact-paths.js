#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = process.cwd();
const RUNS_ROOT = path.join(PROJECT_ROOT, 'reports/qa/runs');
const EVIDENCE_LEGACY_ROOT = path.join(PROJECT_ROOT, 'reports/qa/evidence/legacy');
const LEGACY_SOURCE_PREFIX = 'artifacts/';

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    pruneSource: argv.includes('--prune-source'),
  };
}

function toPosix(relativePath) {
  return relativePath.replace(/\\/g, '/');
}

function walkRunFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  const queue = [rootDir];
  while (queue.length > 0) {
    const current = queue.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (entry.isFile() && /^qa-run-QA-.*\.json$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }
  return files.sort();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function inferRunYear(run) {
  const recordedAt = String(run.recordedAt || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(recordedAt)) {
    return recordedAt.slice(0, 4);
  }

  const runId = String(run.runId || '').trim();
  const idMatch = runId.match(/^QA-(\d{4})/i);
  if (idMatch) {
    return idMatch[1];
  }

  return 'unknown';
}

function toSlug(value, fallback = 'artifact') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function ensureUniqueDestination(absPath) {
  if (!fs.existsSync(absPath)) return absPath;

  const parsed = path.parse(absPath);
  let counter = 1;
  while (counter < 10_000) {
    const candidate = path.join(parsed.dir, `${parsed.name}-${counter}${parsed.ext}`);
    if (!fs.existsSync(candidate)) return candidate;
    counter += 1;
  }

  throw new Error(`destination collision limit exceeded: ${absPath}`);
}

function artifactDebtPayload() {
  return {
    status: 'acknowledged',
    kind: 'historical-no-durable-evidence',
    reason:
      'Legacy artifacts/* evidence was missing during root-artifact migration, so the run keeps acknowledged historical debt.',
    recordedAt: new Date().toISOString(),
    recordedBy: 'codex:migrate-legacy-artifact-paths',
  };
}

function cleanEmptyDirs(rootDir) {
  if (!fs.existsSync(rootDir)) return;
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    cleanEmptyDirs(path.join(rootDir, entry.name));
  }

  const remaining = fs.readdirSync(rootDir);
  if (remaining.length === 0) {
    fs.rmdirSync(rootDir);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const runFiles = walkRunFiles(RUNS_ROOT);
  const migratedSources = new Set();
  let touchedRuns = 0;
  let migratedArtifacts = 0;
  let droppedMissingArtifacts = 0;

  for (const runFile of runFiles) {
    const run = readJson(runFile);
    const artifacts = Array.isArray(run.artifacts) ? run.artifacts : [];
    if (artifacts.length === 0) continue;

    const year = inferRunYear(run);
    const runId = String(run.runId || path.basename(runFile, '.json')).trim();
    let changed = false;
    let runMissingCount = 0;

    const normalizedArtifacts = artifacts
      .map((artifact, index) => ({ artifact, index }))
      .filter(({ artifact }) => artifact && typeof artifact === 'object')
      .map(({ artifact, index }) => {
        const sourcePath = artifact.path ? toPosix(String(artifact.path).trim()) : '';
        if (!sourcePath.startsWith(LEGACY_SOURCE_PREFIX)) {
          return artifact;
        }

        const sourceAbsPath = path.resolve(PROJECT_ROOT, sourcePath);
        if (!fs.existsSync(sourceAbsPath) || !fs.statSync(sourceAbsPath).isFile()) {
          changed = true;
          runMissingCount += 1;
          droppedMissingArtifacts += 1;
          return null;
        }

        const ext = path.extname(sourcePath).toLowerCase();
        const sourceBase = path.basename(sourcePath, ext || undefined);
        const runSlug = toSlug(runId, 'qa-run');
        const sourceSlug = toSlug(sourceBase, `artifact-${index + 1}`);
        const baseName = `${runSlug}-${String(index + 1).padStart(2, '0')}-${sourceSlug}${ext || '.bin'}`;
        const targetAbsBasePath = path.join(EVIDENCE_LEGACY_ROOT, year, baseName);
        const targetAbsPath = ensureUniqueDestination(targetAbsBasePath);
        const targetRelPath = toPosix(path.relative(PROJECT_ROOT, targetAbsPath));

        if (args.apply) {
          ensureDir(path.dirname(targetAbsPath));
          fs.copyFileSync(sourceAbsPath, targetAbsPath);
        }

        migratedSources.add(sourceAbsPath);
        migratedArtifacts += 1;
        changed = true;

        return {
          ...artifact,
          path: targetRelPath,
        };
      })
      .filter(Boolean);

    if (!changed) {
      continue;
    }

    touchedRuns += 1;
    run.artifacts = normalizedArtifacts;

    if (runMissingCount > 0) {
      if (!run.artifactDebt || run.artifactDebt.status !== 'acknowledged') {
        run.artifactDebt = artifactDebtPayload();
      }
      const notes = Array.isArray(run.notes) ? [...run.notes] : [];
      const debtNote =
        `[artifact-migration] ${runMissingCount} legacy artifacts/* evidence path(s) were missing and removed from artifacts list; artifactDebt acknowledged.`;
      if (!notes.includes(debtNote)) {
        notes.push(debtNote);
      }
      run.notes = notes;
    }

    if (args.apply) {
      writeJson(runFile, run);
    }
  }

  if (args.apply && args.pruneSource) {
    const sortedSources = Array.from(migratedSources).sort();
    for (const sourcePath of sortedSources) {
      if (fs.existsSync(sourcePath) && fs.statSync(sourcePath).isFile()) {
        fs.rmSync(sourcePath);
      }
    }
    const artifactsRoot = path.join(PROJECT_ROOT, 'artifacts');
    cleanEmptyDirs(artifactsRoot);
  }

  console.log('Legacy QA Artifact Migration');
  console.log(`- mode: ${args.apply ? 'apply' : 'dry-run'}`);
  console.log(`- prune source: ${args.pruneSource ? 'yes' : 'no'}`);
  console.log(`- run files scanned: ${runFiles.length}`);
  console.log(`- runs touched: ${touchedRuns}`);
  console.log(`- migrated artifacts: ${migratedArtifacts}`);
  console.log(`- dropped missing artifacts: ${droppedMissingArtifacts}`);
  console.log(`- migrated source files tracked: ${migratedSources.size}`);
}

main();
