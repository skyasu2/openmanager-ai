#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const DOCS_ROOT = path.resolve(process.cwd(), 'docs');
const REPORT_PATH = path.resolve(
  process.cwd(),
  'logs/docs-reports/doc-budget-report.txt'
);
const STALE_DAYS = 90;

const BUDGET = {
  total: 60,
  referenceArchitecture: 25,
  development: 20,
  guides: 12,
  troubleshooting: 5,
  root: 5,
};

const METADATA_REQUIRED_FIELDS = ['Owner', 'Status', 'Doc type', 'Last reviewed'];
const METADATA_RECOMMENDED_FIELDS = ['Canonical', 'Tags'];
const DUPLICATE_PREFIX_EXCLUDE = new Set(['readme']);

const ARGS = new Set(process.argv.slice(2));
const SHOULD_WRITE = ARGS.has('--write');
const STRICT_MODE = ARGS.has('--strict');
const DOCS_DIFF_RANGE = process.env.DOCS_DIFF_RANGE || '';

function walkMarkdownFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'archived') {
        continue;
      }
      results.push(...walkMarkdownFiles(fullPath));
      continue;
    }

    if (entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

function toDocsRelative(filePath) {
  return path
    .relative(DOCS_ROOT, filePath)
    .split(path.sep)
    .join('/');
}

function extractField(content, label) {
  const pattern = new RegExp(`^>\\s*${label}:\\s*(.+)$`, 'im');
  const match = content.match(pattern);
  return match ? match[1].trim() : '';
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function parseMetadata(content) {
  const owner = extractField(content, 'Owner');
  const status = extractField(content, 'Status');
  const docType = extractField(content, 'Doc type');
  const lastReviewed = extractField(content, 'Last reviewed');
  const lastVerified = extractField(content, 'Last verified');
  const canonical = extractField(content, 'Canonical');
  const tags = extractField(content, 'Tags');

  const effectiveLastReviewed = lastReviewed || lastVerified;
  const missingRequired = [];
  if (!owner) {
    missingRequired.push('Owner');
  }
  if (!status) {
    missingRequired.push('Status');
  }
  if (!docType) {
    missingRequired.push('Doc type');
  }
  if (!effectiveLastReviewed) {
    missingRequired.push('Last reviewed');
  }

  const missingRecommended = [];
  const normalizedStatus = status.toLowerCase();
  if (!canonical && normalizedStatus && normalizedStatus !== 'active canonical') {
    missingRecommended.push('Canonical');
  }
  if (!tags) {
    missingRecommended.push('Tags');
  }

  const invalidDate =
    Boolean(effectiveLastReviewed) && !isIsoDate(effectiveLastReviewed);

  return {
    missingRequired,
    missingRecommended,
    invalidDate,
  };
}

function countByBudgetScope(activeFiles) {
  const rel = activeFiles.map(toDocsRelative);
  const counts = {
    total: rel.length,
    referenceArchitecture: rel.filter((p) =>
      p.startsWith('reference/architecture/')
    ).length,
    development: rel.filter((p) => p.startsWith('development/')).length,
    guides: rel.filter((p) => p.startsWith('guides/')).length,
    troubleshooting: rel.filter((p) => p.startsWith('troubleshooting/')).length,
    root: rel.filter((p) => !p.includes('/')).length,
  };

  const overBudget = [];
  if (counts.total > BUDGET.total) {
    overBudget.push(`total ${counts.total}/${BUDGET.total}`);
  }
  if (counts.referenceArchitecture > BUDGET.referenceArchitecture) {
    overBudget.push(
      `reference/architecture ${counts.referenceArchitecture}/${BUDGET.referenceArchitecture}`
    );
  }
  if (counts.development > BUDGET.development) {
    overBudget.push(`development ${counts.development}/${BUDGET.development}`);
  }
  if (counts.guides > BUDGET.guides) {
    overBudget.push(`guides ${counts.guides}/${BUDGET.guides}`);
  }
  if (counts.troubleshooting > BUDGET.troubleshooting) {
    overBudget.push(
      `troubleshooting ${counts.troubleshooting}/${BUDGET.troubleshooting}`
    );
  }
  if (counts.root > BUDGET.root) {
    overBudget.push(`root ${counts.root}/${BUDGET.root}`);
  }

  return { counts, overBudget };
}

function staleFiles(activeFiles) {
  const now = Date.now();
  const thresholdMs = STALE_DAYS * 24 * 60 * 60 * 1000;
  return activeFiles
    .filter((file) => now - fs.statSync(file).mtimeMs > thresholdMs)
    .map(toDocsRelative)
    .sort();
}

function duplicateCandidates(activeFiles) {
  const basenameGroups = new Map();
  for (const file of activeFiles) {
    const rel = toDocsRelative(file);
    const stem = path.basename(rel, '.md').toLowerCase();
    const prefix = stem.includes('-')
      ? stem.split('-').slice(0, -1).join('-') || stem
      : stem;
    const group = basenameGroups.get(prefix) || [];
    group.push(rel);
    basenameGroups.set(prefix, group);
  }

  const prefixCandidates = [...basenameGroups.entries()]
    .filter(([prefix]) => !DUPLICATE_PREFIX_EXCLUDE.has(prefix))
    .filter(([, files]) => files.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .map(([prefix, files]) => `${prefix} (${files.length})`);

  return {
    summary:
      prefixCandidates.length === 0 ? ['none'] : prefixCandidates.slice(0, 5),
    prefixCandidates,
  };
}

function safeGitCommand(command) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

function getChangedDocs() {
  const changed = new Set();

  if (DOCS_DIFF_RANGE) {
    const ranged = safeGitCommand(`git diff --name-only ${DOCS_DIFF_RANGE} -- docs`);
    for (const line of ranged.split('\n')) {
      const file = line.trim();
      if (!file || !file.endsWith('.md')) {
        continue;
      }
      changed.add(file.replace(/^docs\//, ''));
    }
    return [...changed].sort();
  }

  const tracked = safeGitCommand('git diff --name-only -- docs');
  const untracked = safeGitCommand('git ls-files --others --exclude-standard -- docs');
  for (const line of `${tracked}\n${untracked}`.split('\n')) {
    const file = line.trim();
    if (!file || !file.endsWith('.md')) {
      continue;
    }
    changed.add(file.replace(/^docs\//, ''));
  }

  return [...changed].sort();
}

function collectMetadataStatus(activeFiles) {
  const relToFile = new Map(activeFiles.map((file) => [toDocsRelative(file), file]));
  const changedDocs = getChangedDocs().filter((doc) => relToFile.has(doc));

  const changedMissing = [];
  const changedInvalidDate = [];
  const changedRecommended = [];
  const legacyMissing = [];

  for (const [rel, file] of relToFile.entries()) {
    const content = fs.readFileSync(file, 'utf8');
    const parsed = parseMetadata(content);

    if (changedDocs.includes(rel)) {
      if (parsed.missingRequired.length > 0) {
        changedMissing.push({ file: rel, fields: parsed.missingRequired });
      }
      if (parsed.invalidDate) {
        changedInvalidDate.push(rel);
      }
      if (parsed.missingRecommended.length > 0) {
        changedRecommended.push({ file: rel, fields: parsed.missingRecommended });
      }
      continue;
    }

    if (parsed.missingRequired.length > 0) {
      legacyMissing.push({ file: rel, fields: parsed.missingRequired });
    }
  }

  return {
    changedDocs,
    changedMissing,
    changedInvalidDate,
    changedRecommended,
    legacyMissing,
  };
}

function makeRuleLine(severity, ruleId, file, actionHint) {
  return `${severity} ${ruleId} file=${file} action_hint="${actionHint}"`;
}

function buildReport() {
  const activeFiles = walkMarkdownFiles(DOCS_ROOT);
  const { counts, overBudget } = countByBudgetScope(activeFiles);
  const stale = staleFiles(activeFiles);
  const duplicates = duplicateCandidates(activeFiles);
  const metadata = collectMetadataStatus(activeFiles);
  const readyForNewDoc =
    counts.total < BUDGET.total && overBudget.length === 0 ? 'yes' : 'no';

  const lines = [];
  lines.push('Doc Budget Report');
  lines.push(`- Total active: ${counts.total} / ${BUDGET.total}`);
  lines.push(
    `- Over-budget dirs: ${overBudget.length === 0 ? 'none' : overBudget.join(', ')}`
  );
  lines.push(`- Duplicate candidates: ${duplicates.summary.join(', ')}`);
  lines.push(`- Stale (90d+): ${stale.length} files`);
  lines.push(
    `- Missing metadata (changed docs): ${metadata.changedMissing.length} files`
  );
  lines.push(
    `- Missing metadata (legacy backlog): ${metadata.legacyMissing.length} files`
  );
  lines.push(`- Ready for new doc: ${readyForNewDoc}`);
  lines.push('');

  lines.push('[Detail] Metadata schema');
  lines.push(`- Required: ${METADATA_REQUIRED_FIELDS.join(', ')}`);
  lines.push(
    `- Recommended: ${METADATA_RECOMMENDED_FIELDS.join(', ')} (Last verified is legacy alias of Last reviewed)`
  );
  lines.push('');

  lines.push('[Detail] Budget by scope');
  lines.push(
    `- reference/architecture: ${counts.referenceArchitecture} / ${BUDGET.referenceArchitecture}`
  );
  lines.push(`- development: ${counts.development} / ${BUDGET.development}`);
  lines.push(`- guides: ${counts.guides} / ${BUDGET.guides}`);
  lines.push(
    `- troubleshooting: ${counts.troubleshooting} / ${BUDGET.troubleshooting}`
  );
  lines.push(`- root: ${counts.root} / ${BUDGET.root}`);
  lines.push('');

  lines.push('[Detail] Changed docs (active only, this task)');
  lines.push(
    metadata.changedDocs.length === 0 ? '- none' : `- ${metadata.changedDocs.join(', ')}`
  );
  lines.push('');

  lines.push('[Detail] Missing required metadata (changed docs)');
  lines.push(
    metadata.changedMissing.length === 0
      ? '- none'
      : `- ${metadata.changedMissing
          .map((item) => `${item.file} [${item.fields.join(', ')}]`)
          .join(', ')}`
  );
  lines.push('');

  lines.push('[Detail] Invalid date format (changed docs)');
  lines.push(
    metadata.changedInvalidDate.length === 0
      ? '- none'
      : `- ${metadata.changedInvalidDate.join(', ')}`
  );
  lines.push('');

  lines.push('[Detail] Missing recommended metadata (changed docs)');
  lines.push(
    metadata.changedRecommended.length === 0
      ? '- none'
      : `- ${metadata.changedRecommended
          .slice(0, 20)
          .map((item) => `${item.file} [${item.fields.join(', ')}]`)
          .join(', ')}`
  );
  lines.push('');

  lines.push('[Detail] Missing required metadata (legacy backlog, top 20)');
  lines.push(
    metadata.legacyMissing.length === 0
      ? '- none'
      : `- ${metadata.legacyMissing
          .slice(0, 20)
          .map((item) => `${item.file} [${item.fields.join(', ')}]`)
          .join(', ')}`
  );
  lines.push('');

  lines.push('[Detail] Stale docs (90d+, top 20)');
  lines.push(stale.length === 0 ? '- none' : `- ${stale.slice(0, 20).join(', ')}`);
  lines.push('');

  lines.push('[Detail] Duplicate candidates by filename prefix (top 10)');
  lines.push(
    duplicates.prefixCandidates.length === 0
      ? '- none'
      : `- ${duplicates.prefixCandidates.join(', ')}`
  );
  lines.push('');

  lines.push('[Rule Results]');
  lines.push(
    makeRuleLine(
      overBudget.length === 0 ? 'PASS' : 'FAIL',
      'DOC-BUDGET-001',
      'docs',
      overBudget.length === 0 ? 'none' : 'Merge or archive docs before adding new ones'
    )
  );
  lines.push(
    makeRuleLine(
      stale.length === 0 ? 'PASS' : 'WARN',
      'DOC-STALE-001',
      'docs',
      stale.length === 0 ? 'none' : 'Archive or refresh stale active docs'
    )
  );

  for (const item of metadata.changedMissing) {
    lines.push(
      makeRuleLine(
        'FAIL',
        'DOC-META-001',
        `docs/${item.file}`,
        `Add required fields: ${item.fields.join(', ')}`
      )
    );
  }

  for (const item of metadata.changedInvalidDate) {
    lines.push(
      makeRuleLine(
        'FAIL',
        'DOC-META-002',
        `docs/${item}`,
        'Use ISO date format YYYY-MM-DD in Last reviewed'
      )
    );
  }

  for (const item of metadata.changedRecommended.slice(0, 20)) {
    lines.push(
      makeRuleLine(
        'WARN',
        'DOC-META-RECO-001',
        `docs/${item.file}`,
        `Consider adding: ${item.fields.join(', ')}`
      )
    );
  }

  for (const item of metadata.legacyMissing.slice(0, 20)) {
    lines.push(
      makeRuleLine(
        'WARN',
        'DOC-META-LEGACY-001',
        `docs/${item.file}`,
        `Backlog metadata migration: ${item.fields.join(', ')}`
      )
    );
  }

  if (duplicates.prefixCandidates.length > 0) {
    lines.push(
      makeRuleLine(
        'WARN',
        'DOC-DUP-001',
        'docs',
        'Review duplicate filename prefixes and merge if overlap is real'
      )
    );
  } else {
    lines.push(
      makeRuleLine('PASS', 'DOC-DUP-001', 'docs', 'none')
    );
  }

  return {
    text: lines.join('\n'),
    strictViolation:
      counts.total > BUDGET.total ||
      overBudget.length > 0 ||
      metadata.changedMissing.length > 0 ||
      metadata.changedInvalidDate.length > 0,
  };
}

function main() {
  if (!fs.existsSync(DOCS_ROOT)) {
    console.error(`docs directory not found: ${DOCS_ROOT}`);
    process.exit(1);
  }

  const report = buildReport();
  console.log(report.text);

  if (SHOULD_WRITE) {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, `${report.text}\n`, 'utf8');
  }

  if (STRICT_MODE && report.strictViolation) {
    process.exit(1);
  }
}

main();
