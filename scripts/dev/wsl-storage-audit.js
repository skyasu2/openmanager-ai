#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROJECT_ROOT = process.cwd();
const HOME = os.homedir();
const MIB = 1024 * 1024;

const STORAGE_TARGETS = [
  {
    label: 'npm cache',
    path: path.join(HOME, '.npm'),
    note: 'Large but normally safe cache; prefer npm cache verify before removal.',
  },
  {
    label: 'npm npx cache',
    path: path.join(HOME, '.npm', '_npx'),
    note: 'Usually disposable after checking no one-off npx process is running.',
  },
  {
    label: 'uv cache',
    path: path.join(HOME, '.cache', 'uv'),
    note: 'Python package cache; disposable if no active install is running.',
  },
  {
    label: 'Playwright browser cache',
    path: path.join(HOME, '.cache', 'ms-playwright'),
    note: 'Redownloadable; keep when Playwright QA is active.',
  },
  {
    label: 'Puppeteer browser cache',
    path: path.join(HOME, '.cache', 'puppeteer'),
    note: 'Redownloadable; keep when browser automation is active.',
  },
  {
    label: 'Next SWC cache',
    path: path.join(HOME, '.cache', 'next-swc'),
    note: 'Redownloadable Next.js compiler cache.',
  },
  {
    label: 'Gemini backups',
    path: path.join(HOME, '.gemini', 'backups'),
    note: 'Review periodically; old tool backups are common cleanup candidates.',
  },
  {
    label: 'Codex sessions',
    path: path.join(HOME, '.codex', 'sessions'),
    note: 'Operational history; clean only after deciding retention is unnecessary.',
  },
  {
    label: 'Codex logs',
    path: path.join(HOME, '.codex', 'log'),
    note: 'Operational logs; keep recent diagnostics, prune old bulk logs if needed.',
  },
  {
    label: 'Claude projects',
    path: path.join(HOME, '.claude', 'projects'),
    note: 'Agent history; clean only after retention review.',
  },
  {
    label: 'Minikube cache',
    path: path.join(HOME, '.minikube', 'cache'),
    note: 'Large kic/image cache; disposable if Minikube is not in use.',
  },
  {
    label: 'Project root artifacts',
    path: path.join(PROJECT_ROOT, 'tmp', 'root-artifacts'),
    note: 'Generated root artifact archive; old dated folders are cleanup candidates.',
  },
  {
    label: 'Project Playwright tmp',
    path: path.join(PROJECT_ROOT, 'tmp', 'playwright'),
    note: 'Generated test reports/traces; remove after QA evidence is recorded.',
  },
  {
    label: 'QA evidence',
    path: path.join(PROJECT_ROOT, 'reports', 'qa', 'evidence'),
    note: 'Durable evidence; run npm run qa:evidence:audit before deleting.',
  },
];

const ARCHIVE_SCAN_ROOTS = [
  path.join(HOME, '.cache'),
  path.join(HOME, '.codex'),
  path.join(HOME, '.claude'),
  path.join(HOME, '.gemini'),
  path.join(HOME, '.minikube'),
  '/tmp',
  path.join(PROJECT_ROOT, 'tmp'),
  path.join(PROJECT_ROOT, 'reports'),
];

const ARCHIVE_PATTERNS = [
  '*.7z',
  '*.bak',
  '*.backup',
  '*.gz',
  '*.old',
  '*.orig',
  '*.rar',
  '*.tar',
  '*.tar.gz',
  '*.tgz',
  '*.zip',
];

const PRUNE_PATTERNS = [
  '/tmp/snap-private-tmp',
  '/tmp/systemd-private-*',
  '*/.git',
  '*/.next',
  '*/build',
  '*/coverage',
  '*/dist',
  '*/node_modules',
  '*/storybook-static',
];

function parseArgs(argv) {
  const options = {
    archiveThresholdMib: 20,
    dockerVerbose: false,
    skipDocker: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--archive-threshold-mib') {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('--archive-threshold-mib requires a positive number');
      }
      options.archiveThresholdMib = value;
      i += 1;
      continue;
    }
    if (arg === '--docker-verbose') {
      options.dockerVerbose = true;
      continue;
    }
    if (arg === '--no-docker') {
      options.skipDocker = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function exists(targetPath) {
  return fs.existsSync(targetPath);
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * MIB,
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'unknown';
  const gib = 1024 * MIB;
  if (bytes >= gib) return `${(bytes / gib).toFixed(1)} GiB`;
  if (bytes >= MIB) return `${(bytes / MIB).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

function duBytes(targetPath) {
  if (!exists(targetPath)) return null;
  const result = run('du', ['-sk', targetPath]);
  if (result.status !== 0) return null;
  const sizeKiB = Number(String(result.stdout).trim().split(/\s+/)[0]);
  if (!Number.isFinite(sizeKiB)) return null;
  return sizeKiB * 1024;
}

function printSection(title) {
  console.log('');
  console.log(title);
  console.log('-'.repeat(title.length));
}

function printDiskUsage() {
  printSection('Disk usage');
  const mounts = Array.from(
    new Set([PROJECT_ROOT, '/', '/mnt/c', '/mnt/d'].filter(exists))
  );
  const result = run('df', ['-h', ...mounts]);
  if (result.status !== 0) {
    console.log('df unavailable');
    return;
  }
  console.log(String(result.stdout).trim());
}

function printDockerUsage(options) {
  printSection('Docker usage');
  if (options.skipDocker) {
    console.log('Skipped (--no-docker).');
    return;
  }

  const args = options.dockerVerbose ? ['system', 'df', '-v'] : ['system', 'df'];
  const result = run('docker', args);
  if (result.status !== 0) {
    console.log('docker system df unavailable');
    if (result.stderr) console.log(String(result.stderr).trim());
    return;
  }
  console.log(String(result.stdout).trim());
}

function printTargetSizes() {
  printSection('WSL storage targets');
  const rows = STORAGE_TARGETS.map((target) => ({
    ...target,
    size: duBytes(target.path),
  }))
    .filter((target) => target.size !== null)
    .sort((a, b) => b.size - a.size);

  if (rows.length === 0) {
    console.log('No configured targets found.');
    return;
  }

  for (const row of rows) {
    console.log(`${formatBytes(row.size).padStart(9)}  ${row.path}`);
    console.log(`           ${row.label}: ${row.note}`);
  }
}

function buildFindArgs(options) {
  const roots = ARCHIVE_SCAN_ROOTS.filter(exists);
  if (roots.length === 0) return [];

  const args = [...roots, '-xdev'];

  args.push('(');
  PRUNE_PATTERNS.forEach((pattern, index) => {
    if (index > 0) args.push('-o');
    args.push('-path', pattern);
  });
  args.push(')', '-prune', '-o', '-type', 'f', '(');

  ARCHIVE_PATTERNS.forEach((pattern, index) => {
    if (index > 0) args.push('-o');
    args.push('-iname', pattern);
  });

  args.push(
    ')',
    '-size',
    `+${options.archiveThresholdMib}M`,
    '-printf',
    '%s %p\n'
  );

  return args;
}

function printArchiveCandidates(options) {
  printSection(`Large archive/backup files > ${options.archiveThresholdMib} MiB`);
  const args = buildFindArgs(options);
  if (args.length === 0) {
    console.log('No scan roots found.');
    return;
  }

  const result = run('find', args);
  const rows = String(result.stdout)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [size, ...rest] = line.split(' ');
      return {
        size: Number(size),
        path: rest.join(' '),
      };
    })
    .filter((row) => Number.isFinite(row.size))
    .sort((a, b) => b.size - a.size)
    .slice(0, 30);

  if (rows.length === 0) {
    console.log('No large archive/backup candidates found.');
  } else {
    for (const row of rows) {
      console.log(`${formatBytes(row.size).padStart(9)}  ${row.path}`);
    }
  }

  const warnings = String(result.stderr || '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .slice(0, 8);
  if (result.status !== 0 && warnings.length > 0) {
    console.log('');
    console.log('Scan warnings (skipped unreadable paths):');
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log('OpenManager WSL/Docker Storage Audit');
  console.log(`Project: ${PROJECT_ROOT}`);
  console.log(`Home: ${HOME}`);
  console.log('Mode: read-only');

  printDiskUsage();
  printDockerUsage(options);
  printTargetSizes();
  printArchiveCandidates(options);

  console.log('');
  console.log('No files, containers, images, volumes, or caches were deleted.');
}

main();
