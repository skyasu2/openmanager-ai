#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const QA_ROOT = path.resolve(process.cwd(), 'reports/qa');
const RUNS_ROOT = path.join(QA_ROOT, 'runs');
const TRACKER_PATH = path.join(QA_ROOT, 'qa-tracker.json');
const STATUS_PATH = path.join(QA_ROOT, 'QA_STATUS.md');

const EXPERT_DOMAIN_CATALOG = [
  { id: 'ai-quality-assurance', name: 'AI Quality Assurance Specialist' },
  { id: 'observability-monitoring', name: 'IT Monitoring & Observability SME' },
  { id: 'ai-security-reliability', name: 'AI Security & Reliability Architect' },
  { id: 'sre-devops', name: 'DevOps / SRE Engineer' },
  { id: 'test-automation', name: 'Test Automation Architect' },
  { id: 'data-metrics-quality', name: 'Data Quality & Metrics Analyst' },
];

function parseArgs(argv) {
  const args = {
    input: '',
  };

  for (let index = 2; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--input') {
      args.input = argv[index + 1] || '';
      index += 1;
      continue;
    }
  }

  return args;
}

function usage() {
  console.log(
    [
      'Usage:',
      '  node scripts/qa/record-qa-run.js --input <qa-run-input.json>',
      '',
      'Example:',
      '  node scripts/qa/record-qa-run.js --input reports/qa/templates/qa-run-input.example.json',
    ].join('\n')
  );
}

function readJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`JSON 읽기 실패: ${filePath}\n${error.message}`);
  }
}

function writeJsonFile(filePath, data) {
  const output = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(filePath, output, 'utf8');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toSeoulParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const parsed = {};
  for (const part of parts) {
    if (part.type === 'literal') continue;
    parsed[part.type] = part.value;
  }

  return {
    year: parsed.year,
    month: parsed.month,
    day: parsed.day,
    hour: parsed.hour,
    minute: parsed.minute,
    second: parsed.second,
  };
}

function nowInSeoulText(date) {
  const p = toSeoulParts(date);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} KST`;
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s._-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
}

function toNonNegativeInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${fieldName}는 0 이상의 정수여야 합니다.`);
  }
  return number;
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeItem(rawItem, fallbackPrefix, index) {
  if (!rawItem) {
    throw new Error(`${fallbackPrefix}[${index}] 항목이 비어있습니다.`);
  }

  const item = typeof rawItem === 'string' ? { title: rawItem } : rawItem;
  const title = String(item.title || '').trim();
  if (!title) {
    throw new Error(`${fallbackPrefix}[${index}] title이 필요합니다.`);
  }

  const idCandidate = String(item.id || slugify(title)).trim();
  const id = slugify(idCandidate);
  if (!id) {
    throw new Error(`${fallbackPrefix}[${index}] id 생성에 실패했습니다.`);
  }

  return {
    id,
    title,
    priority: item.priority ? String(item.priority).toUpperCase() : 'P2',
    evidence: item.evidence ? String(item.evidence) : '',
    note: item.note ? String(item.note) : '',
    owner: item.owner ? String(item.owner) : '',
  };
}

function normalizeDodCheck(rawItem, fallbackPrefix, index) {
  const item =
    typeof rawItem === 'string'
      ? { title: rawItem }
      : rawItem && typeof rawItem === 'object'
        ? rawItem
        : null;

  if (!item) {
    throw new Error(`${fallbackPrefix}[${index}] 항목이 비어있거나 객체가 아닙니다.`);
  }
  const title = String(item.title || '').trim();
  if (!title) {
    throw new Error(`${fallbackPrefix}[${index}] title이 필요합니다.`);
  }

  const idCandidate = String(item.id || slugify(title)).trim();
  const id = slugify(idCandidate);
  if (!id) {
    throw new Error(`${fallbackPrefix}[${index}] id 생성에 실패했습니다.`);
  }

  const statusRaw = String(item.status || 'pending').trim().toLowerCase();
  const status = statusRaw === 'completed' ? 'completed' : 'pending';

  return {
    id,
    title,
    priority: item.priority ? String(item.priority).toUpperCase() : 'P2',
    evidence: item.evidence || item.evidencePath ? String(item.evidence || item.evidencePath) : '',
    note: item.note ? String(item.note) : '',
    owner: item.owner ? String(item.owner) : '',
    status,
  };
}

function normalizeDodChecks(rawDodChecks) {
  const source = Array.isArray(rawDodChecks) ? rawDodChecks : [];
  const flatten = [];

  source.forEach((groupItem, index) => {
    if (!groupItem || typeof groupItem !== 'object') return;

    const isGrouped = Array.isArray(groupItem.items);
    if (isGrouped) {
      const items = groupItem.items;
      for (const [itemIndex, item] of items.entries()) {
        flatten.push(normalizeDodCheck(item, `dodChecks[${index}].items`, itemIndex));
      }
      return;
    }

    flatten.push(normalizeDodCheck(groupItem, 'dodChecks', index));
  });

  return flatten;
}

function normalizeExpertAssessment(rawItem, index) {
  if (!rawItem || typeof rawItem !== 'object') {
    throw new Error(`expertAssessments[${index}] 항목이 비어있거나 객체가 아닙니다.`);
  }

  const domainId = slugify(rawItem.domainId || rawItem.id || '');
  if (!domainId) {
    throw new Error(`expertAssessments[${index}] domainId가 필요합니다.`);
  }

  const catalogMatch = EXPERT_DOMAIN_CATALOG.find((entry) => entry.id === domainId);
  const domainName = String(rawItem.domainName || rawItem.name || catalogMatch?.name || '').trim();
  if (!domainName) {
    throw new Error(`expertAssessments[${index}] domainName이 필요합니다.`);
  }

  const fitRaw = String(rawItem.fit || 'appropriate').trim().toLowerCase();
  const fit =
    fitRaw === 'appropriate' ||
    fitRaw === 'partially-appropriate' ||
    fitRaw === 'inappropriate'
      ? fitRaw
      : 'partially-appropriate';

  const improvementNeeded = toBoolean(
    rawItem.improvementNeeded,
    fit !== 'appropriate'
  );

  return {
    domainId,
    domainName,
    fit,
    improvementNeeded,
    rationale: rawItem.rationale ? String(rawItem.rationale) : '',
    nextAction: rawItem.nextAction ? String(rawItem.nextAction) : '',
  };
}

function initializeTracker(nowIso) {
  return {
    version: '1.0.0',
    meta: {
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    sequence: {
      nextRunNumber: 1,
    },
    summary: {
      totalRuns: 0,
      totalChecks: 0,
      totalPassed: 0,
      totalFailed: 0,
      completionRate: 0,
      completedItems: 0,
      pendingItems: 0,
      expertDomainsTracked: 0,
      expertDomainsOpenGaps: 0,
      lastRunId: null,
      lastRecordedAt: null,
    },
    items: {},
    experts: {},
    runs: [],
  };
}

function loadTracker(nowIso) {
  if (!fs.existsSync(TRACKER_PATH)) {
    return initializeTracker(nowIso);
  }

  const tracker = readJsonFile(TRACKER_PATH);
  if (!tracker || typeof tracker !== 'object') {
    throw new Error('qa-tracker.json 형식이 올바르지 않습니다.');
  }
  tracker.items = tracker.items || {};
  tracker.runs = tracker.runs || [];
  tracker.sequence = tracker.sequence || { nextRunNumber: tracker.runs.length + 1 };
  tracker.meta = tracker.meta || { createdAt: nowIso, updatedAt: nowIso };
  tracker.summary = tracker.summary || initializeTracker(nowIso).summary;
  tracker.experts = tracker.experts || {};
  return tracker;
}

function upsertTrackerItem({
  tracker,
  runId,
  recordedAt,
  normalizedItem,
  status,
}) {
  const existing = tracker.items[normalizedItem.id];
  const next = existing
    ? { ...existing }
    : {
        id: normalizedItem.id,
        title: normalizedItem.title,
        priority: normalizedItem.priority,
        status,
        firstSeenRunId: runId,
        firstSeenAt: recordedAt,
        lastSeenRunId: runId,
        lastSeenAt: recordedAt,
        seenCount: 0,
        completedCount: 0,
        pendingCount: 0,
        owner: normalizedItem.owner || '',
        lastEvidence: '',
        lastNote: '',
      };

  next.title = normalizedItem.title;
  next.priority = normalizedItem.priority || next.priority || 'P2';
  if (normalizedItem.owner) next.owner = normalizedItem.owner;
  next.lastSeenRunId = runId;
  next.lastSeenAt = recordedAt;
  next.seenCount += 1;
  next.status = status;
  if (status === 'completed') next.completedCount += 1;
  if (status === 'pending') next.pendingCount += 1;
  if (normalizedItem.evidence) next.lastEvidence = normalizedItem.evidence;
  if (normalizedItem.note) next.lastNote = normalizedItem.note;
  next.lastStatusChangeAt = recordedAt;

  tracker.items[normalizedItem.id] = next;
}

function upsertTrackerExpert({
  tracker,
  runId,
  recordedAt,
  assessment,
}) {
  const existing = tracker.experts[assessment.domainId];
  const next = existing
    ? { ...existing }
    : {
        domainId: assessment.domainId,
        domainName: assessment.domainName,
        firstSeenRunId: runId,
        firstSeenAt: recordedAt,
        seenCount: 0,
        appropriateCount: 0,
        partialCount: 0,
        inappropriateCount: 0,
        improvementNeededCount: 0,
      };

  next.domainName = assessment.domainName;
  next.seenCount += 1;
  next.lastRunId = runId;
  next.lastSeenAt = recordedAt;
  next.lastFit = assessment.fit;
  next.lastImprovementNeeded = assessment.improvementNeeded;
  next.lastRationale = assessment.rationale;
  next.lastNextAction = assessment.nextAction;

  if (assessment.fit === 'appropriate') next.appropriateCount += 1;
  if (assessment.fit === 'partially-appropriate') next.partialCount += 1;
  if (assessment.fit === 'inappropriate') next.inappropriateCount += 1;
  if (assessment.improvementNeeded) next.improvementNeededCount += 1;

  tracker.experts[assessment.domainId] = next;
}

function recalculateSummary(tracker) {
  const totalRuns = tracker.runs.length;
  const totalChecks = tracker.runs.reduce(
    (sum, run) => sum + (run.checks?.total || 0),
    0
  );
  const totalPassed = tracker.runs.reduce(
    (sum, run) => sum + (run.checks?.passed || 0),
    0
  );
  const totalFailed = tracker.runs.reduce(
    (sum, run) => sum + (run.checks?.failed || 0),
    0
  );

  const itemList = Object.values(tracker.items);
  const completedItems = itemList.filter((item) => item.status === 'completed').length;
  const pendingItems = itemList.filter((item) => item.status === 'pending').length;
  const completionRateBase = completedItems + pendingItems;
  const completionRate =
    completionRateBase === 0
      ? 0
      : Number(((completedItems / completionRateBase) * 100).toFixed(2));

  const expertList = Object.values(tracker.experts || {});
  const expertDomainsTracked = expertList.length;
  const expertDomainsOpenGaps = expertList.filter(
    (expert) => expert.lastImprovementNeeded
  ).length;

  const lastRun = tracker.runs[tracker.runs.length - 1] || null;
  tracker.summary = {
    totalRuns,
    totalChecks,
    totalPassed,
    totalFailed,
    completionRate,
    completedItems,
    pendingItems,
    expertDomainsTracked,
    expertDomainsOpenGaps,
    lastRunId: lastRun ? lastRun.runId : null,
    lastRecordedAt: lastRun ? lastRun.recordedAt : null,
  };
}

function statusMarkdown(tracker) {
  const lines = [];
  const generatedAt = nowInSeoulText(new Date());
  const itemList = Object.values(tracker.items);
  const completed = itemList
    .filter((item) => item.status === 'completed')
    .sort((a, b) => a.id.localeCompare(b.id));
  const pending = itemList
    .filter((item) => item.status === 'pending')
    .sort((a, b) => {
      if (a.priority === b.priority) return a.id.localeCompare(b.id);
      return a.priority.localeCompare(b.priority);
    });
  const recentRuns = tracker.runs.slice(-20).reverse();
  const expertList = Object.values(tracker.experts || {}).sort((a, b) =>
    a.domainId.localeCompare(b.domainId)
  );
  const latestRun = tracker.runs[tracker.runs.length - 1] || null;
  const latestRunExperts = latestRun?.expertAssessments || [];

  lines.push('# QA Status Dashboard');
  lines.push('');
  lines.push('> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.');
  lines.push(`> Generated at: ${generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---:|');
  lines.push(`| Total Runs | ${tracker.summary.totalRuns} |`);
  lines.push(`| Total Checks | ${tracker.summary.totalChecks} |`);
  lines.push(`| Passed | ${tracker.summary.totalPassed} |`);
  lines.push(`| Failed | ${tracker.summary.totalFailed} |`);
  lines.push(`| Completed Items | ${tracker.summary.completedItems} |`);
  lines.push(`| Pending Items | ${tracker.summary.pendingItems} |`);
  lines.push(`| Expert Domains Tracked | ${tracker.summary.expertDomainsTracked || 0} |`);
  lines.push(`| Expert Open Gaps | ${tracker.summary.expertDomainsOpenGaps || 0} |`);
  lines.push(`| Completion Rate | ${tracker.summary.completionRate}% |`);
  lines.push(
    `| Last Run | ${tracker.summary.lastRunId || '-'} (${tracker.summary.lastRecordedAt || '-'}) |`
  );
  lines.push('');
  lines.push('## Expert Domain Assessment (Latest Run)');
  lines.push('');
  lines.push(
    `Latest run: ${latestRun ? `${latestRun.runId} (${latestRun.recordedAt})` : '-'}`
  );
  lines.push('');
  lines.push('| Domain | Fit | Improvement Needed | Next Action |');
  lines.push('|---|---|---|---|');
  if (latestRunExperts.length === 0) {
    lines.push('| - | - | - | - |');
  } else {
    for (const expert of latestRunExperts) {
      lines.push(
        `| ${expert.domainName} | ${expert.fit} | ${expert.improvementNeeded ? 'yes' : 'no'} | ${expert.nextAction || '-'} |`
      );
    }
  }
  lines.push('');
  lines.push('## Expert Domain Open Gaps');
  lines.push('');
  const openExpertGaps = expertList.filter((expert) => expert.lastImprovementNeeded);
  if (openExpertGaps.length === 0) {
    lines.push('- None');
  } else {
    for (const expert of openExpertGaps) {
      lines.push(
        `- ${expert.domainId}: ${expert.domainName} (last ${expert.lastRunId})`
      );
      if (expert.lastNextAction) {
        lines.push(`  next: ${expert.lastNextAction}`);
      }
    }
  }
  lines.push('');
  lines.push('## Pending Improvements');
  lines.push('');
  if (pending.length === 0) {
    lines.push('- None');
  } else {
    for (const item of pending) {
      lines.push(
        `- [${item.priority}] ${item.id}: ${item.title} (seen ${item.seenCount}회, last ${item.lastSeenRunId})`
      );
    }
  }
  lines.push('');
  lines.push('## Completed Improvements');
  lines.push('');
  if (completed.length === 0) {
    lines.push('- None');
  } else {
    for (const item of completed) {
      lines.push(
        `- ${item.id}: ${item.title} (completed ${item.completedCount}회, last ${item.lastSeenRunId})`
      );
    }
  }
  lines.push('');
  lines.push('## Recent Runs');
  lines.push('');
  lines.push('| Run ID | Time (UTC) | Title | Checks | Completed | Pending | Expert Gaps |');
  lines.push('|---|---|---|---:|---:|---:|---:|');
  if (recentRuns.length === 0) {
    lines.push('| - | - | - | 0 | 0 | 0 | 0 |');
  } else {
    for (const run of recentRuns) {
      lines.push(
        `| ${run.runId} | ${run.recordedAt} | ${run.title} | ${run.checks.total} | ${run.completedCount} | ${run.pendingCount} | ${run.expertNeedsImprovementCount || 0} |`
      );
    }
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function run() {
  const args = parseArgs(process.argv);
  if (!args.input) {
    usage();
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), args.input);
  const payload = readJsonFile(inputPath);
  const now = new Date();
  const nowIso = now.toISOString();

  const runTitle = String(payload.runTitle || '').trim();
  const owner = String(payload.owner || '').trim();
  if (!runTitle) throw new Error('runTitle은 필수입니다.');
  if (!owner) throw new Error('owner는 필수입니다.');

  const checks = payload.checks || {};
  const passed = toNonNegativeInteger(checks.passed || 0, 'checks.passed');
  const failed = toNonNegativeInteger(checks.failed || 0, 'checks.failed');
  const total = toNonNegativeInteger(
    checks.total != null ? checks.total : passed + failed,
    'checks.total'
  );
  if (passed + failed > total) {
    throw new Error('checks.passed + checks.failed 는 checks.total 보다 클 수 없습니다.');
  }

  const completedRaw = Array.isArray(payload.completedImprovements)
    ? payload.completedImprovements
    : [];
  const pendingRaw = Array.isArray(payload.pendingImprovements)
    ? payload.pendingImprovements
    : [];
  const dodChecksRaw = Array.isArray(payload.dodChecks)
    ? payload.dodChecks
    : [];

  const completedImprovements = completedRaw.map((item, index) =>
    normalizeItem(item, 'completedImprovements', index)
  );
  const pendingImprovements = pendingRaw.map((item, index) =>
    normalizeItem(item, 'pendingImprovements', index)
  );
  const dodChecks = normalizeDodChecks(dodChecksRaw);
  const expertAssessmentsRaw = Array.isArray(payload.expertAssessments)
    ? payload.expertAssessments
    : [];
  const expertAssessments = expertAssessmentsRaw.map((item, index) =>
    normalizeExpertAssessment(item, index)
  );

  const finalItemMap = new Map();
  const addItem = (item, status) => {
    const existing = finalItemMap.get(item.id);
    if (existing && existing.status === 'completed') {
      return;
    }
    finalItemMap.set(item.id, { ...item, status });
  };

  for (const item of completedImprovements) {
    addItem(item, 'completed');
  }
  for (const item of pendingImprovements) {
    addItem(item, 'pending');
  }
  for (const item of dodChecks) {
    addItem(item, item.status);
  }

  const finalCompletedImprovements = [];
  const finalPendingImprovements = [];
  for (const item of finalItemMap.values()) {
    if (item.status === 'completed') {
      finalCompletedImprovements.push(item);
    } else {
      finalPendingImprovements.push(item);
    }
  }

  ensureDir(QA_ROOT);
  ensureDir(RUNS_ROOT);

  const tracker = loadTracker(nowIso);
  const runNumber = Number(tracker.sequence.nextRunNumber || tracker.runs.length + 1);
  const p = toSeoulParts(now);
  const dateStamp = `${p.year}${p.month}${p.day}`;
  const runId = `QA-${dateStamp}-${String(runNumber).padStart(4, '0')}`;
  const runYearDir = path.join(RUNS_ROOT, p.year);
  ensureDir(runYearDir);

  const runFileName = `qa-run-${runId}.json`;
  const runFilePath = path.join(runYearDir, runFileName);
  const runFileRelative = path
    .relative(process.cwd(), runFilePath)
    .split(path.sep)
    .join('/');

  const runRecord = {
    runId,
    recordedAt: nowIso,
    recordedAtKst: nowInSeoulText(now),
    runTitle,
    owner,
    source: payload.source ? String(payload.source) : '',
    environment: payload.environment || {},
    checks: {
      total,
      passed,
      failed,
    },
    expertAssessments,
    completedImprovements: finalCompletedImprovements,
    pendingImprovements: finalPendingImprovements,
    notes: Array.isArray(payload.notes) ? payload.notes.map(String) : [],
    links: Array.isArray(payload.links) ? payload.links : [],
  };

  writeJsonFile(runFilePath, runRecord);

  for (const completedItem of finalCompletedImprovements) {
    upsertTrackerItem({
      tracker,
      runId,
      recordedAt: nowIso,
      normalizedItem: completedItem,
      status: 'completed',
    });
  }
  for (const pendingItem of finalPendingImprovements) {
    upsertTrackerItem({
      tracker,
      runId,
      recordedAt: nowIso,
      normalizedItem: pendingItem,
      status: 'pending',
    });
  }
  for (const expertAssessment of expertAssessments) {
    upsertTrackerExpert({
      tracker,
      runId,
      recordedAt: nowIso,
      assessment: expertAssessment,
    });
  }

  const expertNeedsImprovementCount = expertAssessments.filter(
    (entry) => entry.improvementNeeded
  ).length;

  tracker.runs.push({
    runId,
    recordedAt: nowIso,
    recordedAtKst: nowInSeoulText(now),
    title: runTitle,
    owner,
    source: runRecord.source,
    file: runFileRelative,
    checks: runRecord.checks,
    expertAssessments,
    expertCount: expertAssessments.length,
    expertNeedsImprovementCount,
    completedCount: finalCompletedImprovements.length,
    pendingCount: finalPendingImprovements.length,
  });
  tracker.sequence.nextRunNumber = runNumber + 1;
  tracker.meta.updatedAt = nowIso;
  if (!tracker.meta.createdAt) tracker.meta.createdAt = nowIso;
  recalculateSummary(tracker);

  writeJsonFile(TRACKER_PATH, tracker);
  fs.writeFileSync(STATUS_PATH, statusMarkdown(tracker), 'utf8');

  console.log(`✅ QA run recorded: ${runId}`);
  console.log(`- run file: ${runFileRelative}`);
  console.log(
    `- summary: runs=${tracker.summary.totalRuns}, completed=${tracker.summary.completedItems}, pending=${tracker.summary.pendingItems}`
  );
  console.log(
    `- expert domains: tracked=${tracker.summary.expertDomainsTracked || 0}, open-gaps=${tracker.summary.expertDomainsOpenGaps || 0}`
  );
}

try {
  run();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
