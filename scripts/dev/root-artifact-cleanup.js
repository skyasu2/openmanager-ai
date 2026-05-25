#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROJECT_ROOT = process.cwd();
const ROOT_EPHEMERAL_DIRS = [
  '.next',
  '.vercel',
  'coverage',
  '.playwright-mcp',
  'playwright-report',
  'test-results',
  'unit-test-results',
  'test-output',
  'screenshots',
  'storybook-static',
  '.lighthouseci',
  '.npm-global',
  '.npm-fix-trash',
  'out',
  'build',
  'artifacts',
];
const TOLERATED_ROOT_DIRS = new Set(['.next', '.vercel']);

const ARTIFACT_FILE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.tiff',
  '.log',
  '.txt',
  '.zip',
  '.trace',
  '.har',
]);

function seoulDateStamp(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

function toRelative(absolutePath) {
  return path.relative(PROJECT_ROOT, absolutePath).replace(/\\/g, '/');
}

function formatBytes(bytes) {
  const mib = 1024 * 1024;
  if (bytes >= mib) return `${(bytes / mib).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KiB`;
  return `${bytes} B`;
}

function parseArgs(argv) {
  let destination = path.join('tmp', 'root-artifacts', seoulDateStamp());
  let apply = false;
  let applyDirs = false;
  let strict = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      apply = true;
      continue;
    }
    if (arg === '--apply-dirs') {
      applyDirs = true;
      continue;
    }
    if (arg === '--strict') {
      strict = true;
      continue;
    }
    if (arg === '--dest') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('--dest requires a path value');
      }
      destination = next;
      i += 1;
      continue;
    }
  }

  return {
    apply,
    applyDirs,
    strict,
    skipToleratedDirSize: strict && !apply && !applyDirs,
    destination: path.resolve(PROJECT_ROOT, destination),
  };
}

function listRootFiles() {
  return fs
    .readdirSync(PROJECT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const absolutePath = path.join(PROJECT_ROOT, entry.name);
      const stat = fs.statSync(absolutePath);
      return {
        name: entry.name,
        absolutePath,
        relativePath: toRelative(absolutePath),
        size: stat.size,
      };
    })
    .sort((a, b) => b.size - a.size);
}

function hasTrackedEntriesUnder(relativePath) {
  const result = spawnSync('git', ['ls-files', '--', relativePath], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) return false;
  return Boolean(String(result.stdout || '').trim());
}

function listRootDirs({ skipToleratedDirSize = false } = {}) {
  return ROOT_EPHEMERAL_DIRS.map((name) => {
    const absolutePath = path.join(PROJECT_ROOT, name);
    if (!fs.existsSync(absolutePath)) {
      return null;
    }
    const stat = fs.statSync(absolutePath);
    if (!stat.isDirectory()) return null;
    const sizeSkipped = skipToleratedDirSize && TOLERATED_ROOT_DIRS.has(name);
    return {
      name,
      absolutePath,
      relativePath: toRelative(absolutePath),
      size: sizeSkipped ? 0 : directorySizeBytes(absolutePath),
      sizeSkipped,
    };
  }).filter(Boolean);
}

function directorySizeBytes(dirPath) {
  let total = 0;
  const queue = [dirPath];
  while (queue.length > 0) {
    const current = queue.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(full);
      } else if (entry.isFile()) {
        total += fs.statSync(full).size;
      }
    }
  }
  return total;
}

function detectArtifactFiles(rootFiles) {
  return rootFiles.filter((file) =>
    ARTIFACT_FILE_EXTENSIONS.has(path.extname(file.name).toLowerCase())
  );
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function moveWithCollision(sourcePath, destinationPath) {
  const destinationDir = path.dirname(destinationPath);
  ensureDir(destinationDir);

  const { dir, name, ext } = path.parse(destinationPath);
  let candidate = destinationPath;
  let index = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${name}-${index}${ext}`);
    index += 1;
  }

  fs.renameSync(sourcePath, candidate);
  return candidate;
}

function printList(title, items, formatter) {
  if (items.length === 0) {
    console.log(`${title}: none`);
    return;
  }
  console.log(title);
  for (const item of items) {
    console.log(`- ${formatter(item)}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootFiles = listRootFiles();
  const artifactFiles = detectArtifactFiles(rootFiles);
  const ephemeralDirs = listRootDirs({
    skipToleratedDirSize: args.skipToleratedDirSize,
  }).map((dir) => ({
    ...dir,
    tracked: hasTrackedEntriesUnder(dir.relativePath),
  }));
  const toleratedDirs = ephemeralDirs.filter((dir) =>
    TOLERATED_ROOT_DIRS.has(dir.name)
  );
  const blockingDirs = ephemeralDirs.filter(
    (dir) => !TOLERATED_ROOT_DIRS.has(dir.name)
  );

  const artifactBytes = artifactFiles.reduce((sum, file) => sum + file.size, 0);
  const dirsBytes = ephemeralDirs.reduce((sum, dir) => sum + dir.size, 0);
  const blockingDirsBytes = blockingDirs.reduce((sum, dir) => sum + dir.size, 0);

  console.log('Root Artifact Audit');
  console.log(`- artifact files in root: ${artifactFiles.length} (${formatBytes(artifactBytes)})`);
  const skippedDirCount = ephemeralDirs.filter((dir) => dir.sizeSkipped).length;
  console.log(
    `- ephemeral dirs in root: ${ephemeralDirs.length} (${formatBytes(dirsBytes)} scanned${
      skippedDirCount > 0 ? `, ${skippedDirCount} tolerated dir size(s) skipped` : ''
    })`
  );
  console.log(
    `- blocking dirs in root: ${blockingDirs.length} (${formatBytes(blockingDirsBytes)})`
  );
  console.log(`- destination: ${toRelative(args.destination)}`);
  console.log(`- mode: ${args.apply ? 'apply' : 'dry-run'}`);
  console.log(`- move dirs: ${args.applyDirs ? 'yes' : 'no'}`);
  console.log('');

  printList(
    'Root artifact files',
    artifactFiles,
    (file) => `${formatBytes(file.size)} - ${file.relativePath}`
  );
  console.log('');
  printList(
    'Root ephemeral dirs',
    ephemeralDirs,
    (dir) => `${dir.sizeSkipped ? 'size skipped' : formatBytes(dir.size)} - ${dir.relativePath}`
  );
  console.log('');
  printList(
    'Root tolerated dirs',
    toleratedDirs,
    (dir) => `${dir.sizeSkipped ? 'size skipped' : formatBytes(dir.size)} - ${dir.relativePath}`
  );
  console.log('');
  printList(
    'Root blocking dirs',
    blockingDirs,
    (dir) => `${formatBytes(dir.size)} - ${dir.relativePath}`
  );

  if (!args.apply) {
    if (args.strict && (artifactFiles.length > 0 || blockingDirs.length > 0)) {
      process.exitCode = 1;
    }
    return;
  }

  const movedFiles = [];
  const movedDirs = [];
  const skippedTrackedDirs = [];
  const filesDestination = path.join(args.destination, 'files');
  const dirsDestination = path.join(args.destination, 'dirs');

  for (const artifact of artifactFiles) {
    const destinationPath = path.join(filesDestination, artifact.name);
    const movedPath = moveWithCollision(artifact.absolutePath, destinationPath);
    movedFiles.push({
      from: artifact.relativePath,
      to: toRelative(movedPath),
      size: artifact.size,
    });
  }

  if (args.applyDirs) {
    for (const dir of blockingDirs) {
      if (dir.tracked) {
        skippedTrackedDirs.push(dir);
        continue;
      }
      const destinationPath = path.join(dirsDestination, dir.name);
      const movedPath = moveWithCollision(dir.absolutePath, destinationPath);
      movedDirs.push({
        from: dir.relativePath,
        to: toRelative(movedPath),
        size: dir.size,
      });
    }
  }

  console.log('');
  printList(
    'Moved root artifact files',
    movedFiles,
    (entry) => `${formatBytes(entry.size)} - ${entry.from} -> ${entry.to}`
  );
  console.log('');
  if (args.applyDirs) {
    printList(
      'Moved root blocking dirs',
      movedDirs,
      (entry) => `${formatBytes(entry.size)} - ${entry.from} -> ${entry.to}`
    );
    if (toleratedDirs.length > 0) {
      console.log('');
      printList(
        'Skipped tolerated dirs',
        toleratedDirs,
        (dir) => `${formatBytes(dir.size)} - ${dir.relativePath}`
      );
    }
    if (skippedTrackedDirs.length > 0) {
      console.log('');
      printList(
        'Skipped tracked dirs (safety)',
        skippedTrackedDirs,
        (dir) => `${formatBytes(dir.size)} - ${dir.relativePath}`
      );
    }
  } else {
    console.log('Moved root blocking dirs: skipped (use --apply-dirs)');
  }
}

main();
