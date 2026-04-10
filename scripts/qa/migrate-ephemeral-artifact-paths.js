#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { repairTrackerDerivedFields } = require('./qa-tracker-utils');

const PROJECT_ROOT = process.cwd();
const RUNS_ROOT = path.join(PROJECT_ROOT, 'reports/qa/runs');
const TRACKER_PATH = path.join(PROJECT_ROOT, 'reports/qa/qa-tracker.json');
const EVIDENCE_LEGACY_ROOT = path.join(PROJECT_ROOT, 'reports/qa/evidence/legacy');
const SEARCH_ROOTS = [
  path.join(PROJECT_ROOT, 'reports/qa/runs'),
  path.join(PROJECT_ROOT, 'tmp/root-artifacts'),
  path.join(PROJECT_ROOT, 'reports/qa/repro'),
];

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    pruneSource: argv.includes('--prune-source'),
  };
}

function toPosix(relativePath) {
  return relativePath.replace(/\\/g, '/');
}

function walkFiles(rootDir, predicate = () => true) {
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
      if (entry.isFile() && predicate(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  return files.sort();
}

function walkRunFiles(rootDir) {
  return walkFiles(rootDir, (fullPath) => /^qa-run-QA-.*\.json$/i.test(path.basename(fullPath)));
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

function addUniqueNote(run, note) {
  const notes = Array.isArray(run.notes) ? [...run.notes] : [];
  if (!notes.includes(note)) {
    notes.push(note);
  }
  run.notes = notes;
}

function artifactDebtPayload() {
  return {
    status: 'acknowledged',
    kind: 'historical-no-durable-evidence',
    reason:
      'Historical non-durable QA artifacts could not be fully recovered during evidence migration, so the run keeps acknowledged historical debt.',
    recordedAt: new Date().toISOString(),
    recordedBy: 'codex:migrate-ephemeral-artifact-paths',
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

function buildSearchIndex() {
  const byBaseName = new Map();
  let indexedFiles = 0;

  for (const searchRoot of SEARCH_ROOTS) {
    for (const filePath of walkFiles(searchRoot)) {
      const normalizedPath = toPosix(filePath);
      const basename = path.basename(normalizedPath);
      const current = byBaseName.get(basename) || [];
      current.push(normalizedPath);
      byBaseName.set(basename, current);
      indexedFiles += 1;
    }
  }

  return {
    byBaseName,
    indexedFiles,
  };
}

function shouldNormalizeArtifactPath(artifactPath) {
  if (typeof artifactPath !== 'string') return false;
  if (artifactPath.trim() === '') return false;
  return !toPosix(artifactPath).startsWith('reports/qa/evidence/');
}

function resolveArtifactSource(normalizedArtifactPath, searchIndex) {
  const directPath = path.resolve(PROJECT_ROOT, normalizedArtifactPath);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return toPosix(directPath);
  }

  const basename = path.basename(normalizedArtifactPath);
  const candidates = searchIndex.byBaseName.get(basename) || [];
  if (candidates.length === 1) {
    return candidates[0];
  }

  const suffixMatches = candidates.filter((candidate) =>
    toPosix(candidate).endsWith(`/${normalizedArtifactPath}`)
  );
  if (suffixMatches.length === 1) {
    return suffixMatches[0];
  }

  return null;
}

function cloneArtifactList(artifacts) {
  return JSON.parse(JSON.stringify(artifacts || []));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const searchIndex = buildSearchIndex();
  const runFiles = walkRunFiles(RUNS_ROOT);
  const sourceToTargetPath = new Map();
  const pruneCandidates = new Set();
  const runStateById = new Map();

  let touchedRuns = 0;
  let migratedArtifacts = 0;
  let removedUnresolvedArtifacts = 0;
  let trackerRunsSynced = 0;
  let sourceFilesPruned = 0;

  for (const runFile of runFiles) {
    const run = readJson(runFile);
    const artifacts = Array.isArray(run.artifacts) ? run.artifacts : [];
    let changed = false;
    let unresolvedCount = 0;

    const year = inferRunYear(run);
    const runId = String(run.runId || path.basename(runFile, '.json')).trim();
    const runSlug = toSlug(runId, 'qa-run');

    const normalizedArtifacts = artifacts
      .map((artifact, index) => ({ artifact, index }))
      .filter(({ artifact }) => artifact && typeof artifact === 'object')
      .map(({ artifact, index }) => {
        const artifactPath =
          artifact.path && typeof artifact.path === 'string'
            ? toPosix(artifact.path.trim())
            : '';

        if (!shouldNormalizeArtifactPath(artifactPath)) {
          return artifact;
        }

        const sourceAbsPath = resolveArtifactSource(artifactPath, searchIndex);
        if (!sourceAbsPath) {
          changed = true;
          unresolvedCount += 1;
          removedUnresolvedArtifacts += 1;
          return null;
        }

        let targetRelPath = sourceToTargetPath.get(sourceAbsPath);
        if (!targetRelPath) {
          const ext = path.extname(sourceAbsPath).toLowerCase();
          const sourceBase = path.basename(sourceAbsPath, ext || undefined);
          const sourceSlug = toSlug(sourceBase, `artifact-${index + 1}`);
          const baseName = `${runSlug}-${String(index + 1).padStart(2, '0')}-${sourceSlug}${ext || '.bin'}`;
          const targetAbsBasePath = path.join(EVIDENCE_LEGACY_ROOT, year, baseName);
          const targetAbsPath = ensureUniqueDestination(targetAbsBasePath);
          targetRelPath = toPosix(path.relative(PROJECT_ROOT, targetAbsPath));

          if (args.apply) {
            ensureDir(path.dirname(targetAbsPath));
            fs.copyFileSync(sourceAbsPath, targetAbsPath);
          }

          sourceToTargetPath.set(sourceAbsPath, targetRelPath);
          pruneCandidates.add(sourceAbsPath);
        }

        changed = true;
        migratedArtifacts += 1;
        return {
          ...artifact,
          path: targetRelPath,
        };
      })
      .filter(Boolean);

    if (unresolvedCount > 0) {
      addUniqueNote(
        run,
        `[ephemeral-artifact-migration] ${unresolvedCount} historical non-durable artifact path(s) could not be recovered and were removed from artifacts list.`
      );

      const qualifiesForDebt =
        normalizedArtifacts.length === 0 &&
        (run.countsTowardSummary !== false || run.releaseFacing === true);
      if (qualifiesForDebt) {
        if (!run.artifactDebt || run.artifactDebt.status !== 'acknowledged') {
          run.artifactDebt = artifactDebtPayload();
        }
        addUniqueNote(
          run,
          '[ephemeral-artifact-migration] all historical non-durable artifact refs were removed without recoverable durable evidence; artifactDebt acknowledged.'
        );
      }
    }

    if (changed) {
      touchedRuns += 1;
      run.artifacts = normalizedArtifacts;
      if (args.apply) {
        writeJson(runFile, run);
      }
    }

    runStateById.set(runId, run);
  }

  if (fs.existsSync(TRACKER_PATH)) {
    const tracker = readJson(TRACKER_PATH);
    if (Array.isArray(tracker.runs)) {
      for (const trackerRun of tracker.runs) {
        const runId = String(trackerRun?.runId || '').trim();
        if (!runStateById.has(runId)) continue;

        const run = runStateById.get(runId);
        const nextArtifacts = cloneArtifactList(run.artifacts);
        const nextArtifactDebt = run.artifactDebt || null;

        const artifactsChanged = !sameJson(trackerRun.artifacts || [], nextArtifacts);
        const debtChanged = !sameJson(trackerRun.artifactDebt || null, nextArtifactDebt);
        if (!artifactsChanged && !debtChanged) {
          continue;
        }

        trackerRun.artifacts = nextArtifacts;
        if (nextArtifactDebt) {
          trackerRun.artifactDebt = nextArtifactDebt;
        } else {
          delete trackerRun.artifactDebt;
        }
        trackerRunsSynced += 1;
      }
    }

    repairTrackerDerivedFields(tracker);
    if (args.apply) {
      writeJson(TRACKER_PATH, tracker);
    }
  }

  if (args.apply && args.pruneSource) {
    for (const sourcePath of Array.from(pruneCandidates).sort()) {
      if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
        continue;
      }

      const normalizedPath = toPosix(sourcePath);
      if (normalizedPath.startsWith(toPosix(EVIDENCE_LEGACY_ROOT))) {
        continue;
      }

      fs.rmSync(sourcePath);
      sourceFilesPruned += 1;
    }

    cleanEmptyDirs(path.join(PROJECT_ROOT, 'tmp/root-artifacts'));
    cleanEmptyDirs(path.join(PROJECT_ROOT, 'reports/qa/runs'));
  }

  console.log('Ephemeral QA Artifact Migration');
  console.log(`- mode: ${args.apply ? 'apply' : 'dry-run'}`);
  console.log(`- prune source: ${args.pruneSource ? 'yes' : 'no'}`);
  console.log(`- indexed recovery files: ${searchIndex.indexedFiles}`);
  console.log(`- run files scanned: ${runFiles.length}`);
  console.log(`- runs touched: ${touchedRuns}`);
  console.log(`- migrated artifacts: ${migratedArtifacts}`);
  console.log(`- removed unresolved artifacts: ${removedUnresolvedArtifacts}`);
  console.log(`- tracker runs synced: ${trackerRunsSynced}`);
  console.log(`- source files pruned: ${sourceFilesPruned}`);
}

main();
