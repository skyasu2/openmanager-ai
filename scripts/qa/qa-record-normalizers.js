const KNOWN_VERIFICATIONS = [
  { pattern: /^랜딩-페이지-v[\d.]+-로드/, baseId: 'landing-page-load-guest-login' },
  { pattern: /^대시보드-15서버-렌더링/, baseId: 'dashboard-15server-render' },
  { pattern: /^서버-모달-종합-상황-탭/, baseId: 'server-modal-overview-tab' },
  { pattern: /^서버-모달-성능-분석-탭/, baseId: 'server-modal-perf-tab' },
  { pattern: /^서버-모달-로그-네트워크-탭/, baseId: 'server-modal-log-network-tab' },
  { pattern: /^리소스-경고-top-5/, baseId: 'resource-warning-top5' },
  { pattern: /^상태-필터-온라인/, baseId: 'dashboard-status-filter-counts' },
  { pattern: /^세션-타이머-정상-카운트다운/, baseId: 'session-timer-countdown' },
  { pattern: /^시스템-리소스-요약/, baseId: 'system-resource-summary' },
  { pattern: /^시스템-시작.*리다이렉트/, baseId: 'system-start-dashboard-redirect' },
  { pattern: /^(esc-모달-닫기|모달-esc-닫기|ui-esc-close)/, baseId: 'modal-esc-close' },
  { pattern: /^(ai-사이드바|ai-sidebar-open|ai-chat-sidebar-open)/, baseId: 'ai-sidebar-toggle' },
  { pattern: /^(프로필-메뉴|profile-menu)/, baseId: 'profile-menu' },
  { pattern: /^서버-모달-3탭-전환/, baseId: 'server-modal-3tab-switch' },
  { pattern: /^프로덕션-대시보드-렌더링/, baseId: 'production-dashboard-render' },
];

const EXPERT_DOMAIN_CATALOG = [
  { id: 'ai-quality-assurance', name: 'AI Quality Assurance Specialist' },
  { id: 'observability-monitoring', name: 'IT Monitoring & Observability SME' },
  { id: 'ai-security-reliability', name: 'AI Security & Reliability Architect' },
  { id: 'sre-devops', name: 'DevOps / SRE Engineer' },
  { id: 'test-automation', name: 'Test Automation Architect' },
  { id: 'data-metrics-quality', name: 'Data Quality & Metrics Analyst' },
];

const USAGE_RESULT_VALUES = new Set(['normal', 'concern', 'unknown']);

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s._-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
}

function resolveStableId(slugifiedId, originalTitle) {
  for (const entry of KNOWN_VERIFICATIONS) {
    if (entry.pattern.test(slugifiedId)) {
      const parenMatch = originalTitle?.match(/\((.+)\)$/);
      const extractedEvidence = parenMatch ? parenMatch[1] : '';
      return { id: entry.baseId, extractedEvidence };
    }
  }
  return { id: slugifiedId, extractedEvidence: '' };
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

function normalizePriority(rawValue) {
  const normalized = String(rawValue || 'P2')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  return /^P[0-5]$/.test(normalized) ? normalized : 'P2';
}

function hasOwnField(obj, field) {
  return Object.prototype.hasOwnProperty.call(obj, field);
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

  const rawId = slugify(String(item.id || slugify(title)).trim());
  if (!rawId) {
    throw new Error(`${fallbackPrefix}[${index}] id 생성에 실패했습니다.`);
  }
  const { id: resolvedId, extractedEvidence } = resolveStableId(rawId, title);
  const id = resolvedId;

  const priority = normalizePriority(item.priority);
  const hasBlocking = hasOwnField(item, 'isBlocking');
  const blockingDefault = priority === 'P0' || priority === 'P1';
  const isBlocking = hasBlocking
    ? toBoolean(item.isBlocking, blockingDefault)
    : blockingDefault;

  const baseEvidence = item.evidence ? String(item.evidence) : '';
  const mergedEvidence = [baseEvidence, extractedEvidence].filter(Boolean).join('; ');

  return {
    id,
    title,
    priority,
    isBlocking,
    isBlockingExplicit: hasBlocking,
    overengineeringScope: item.overengineeringScope
      ? String(item.overengineeringScope)
      : '',
    evidence: mergedEvidence,
    note: item.note ? String(item.note) : '',
    owner: item.owner ? String(item.owner) : '',
    originalId: rawId !== id ? rawId : undefined,
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

  const rawId = slugify(String(item.id || slugify(title)).trim());
  if (!rawId) {
    throw new Error(`${fallbackPrefix}[${index}] id 생성에 실패했습니다.`);
  }
  const { id: resolvedId, extractedEvidence } = resolveStableId(rawId, title);
  const id = resolvedId;

  const statusRaw = String(item.status || 'pending').trim().toLowerCase();
  const status = statusRaw === 'completed' ? 'completed' : 'pending';

  const priority = normalizePriority(item.priority);
  const hasBlocking = hasOwnField(item, 'isBlocking');
  const blockingDefault = priority === 'P0' || priority === 'P1';
  const isBlocking = hasBlocking
    ? toBoolean(item.isBlocking, blockingDefault)
    : blockingDefault;

  const baseEvidence = item.evidence || item.evidencePath ? String(item.evidence || item.evidencePath) : '';
  const mergedEvidence = [baseEvidence, extractedEvidence].filter(Boolean).join('; ');

  return {
    id,
    title,
    priority,
    evidence: mergedEvidence,
    note: item.note ? String(item.note) : '',
    isBlocking,
    isBlockingExplicit: hasBlocking,
    overengineeringScope: item.overengineeringScope
      ? String(item.overengineeringScope)
      : '',
    owner: item.owner ? String(item.owner) : '',
    originalId: rawId !== id ? rawId : undefined,
    status,
  };
}

function normalizePendingPolicy(item, sourceStatus) {
  if (sourceStatus !== 'pending') {
    return {
      status: sourceStatus,
      policyNote: '',
    };
  }

  if (item.isBlocking) {
    return {
      status: 'pending',
      policyNote: '',
    };
  }

  return {
    status: 'pending',
    policyNote:
      '명시적인 reviewer 결정 전에는 pending 상태를 유지해 릴리즈 리스크를 숨기지 않습니다.',
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

function normalizeUsageCheck(rawItem, index) {
  if (!rawItem || typeof rawItem !== 'object') {
    throw new Error(`usageChecks[${index}] 항목이 비어있거나 객체가 아닙니다.`);
  }

  const platform = String(rawItem.platform || '').trim().toLowerCase();
  if (!platform) {
    throw new Error(`usageChecks[${index}] platform이 필요합니다.`);
  }

  const method = String(rawItem.method || 'manual-dashboard').trim().toLowerCase();
  const statusRaw = String(rawItem.status || 'checked').trim().toLowerCase();
  const status = ['checked', 'skipped', 'failed'].includes(statusRaw)
    ? statusRaw
    : 'checked';
  const resultRaw = String(
    rawItem.result || (status === 'checked' ? 'unknown' : 'unknown')
  )
    .trim()
    .toLowerCase();
  const result = USAGE_RESULT_VALUES.has(resultRaw) ? resultRaw : 'unknown';

  return {
    platform,
    method,
    status,
    result,
    checkedAt: rawItem.checkedAt ? String(rawItem.checkedAt) : '',
    summary: rawItem.summary ? String(rawItem.summary) : '',
    evidence: rawItem.evidence ? String(rawItem.evidence) : '',
    url: rawItem.url ? String(rawItem.url) : '',
  };
}

module.exports = {
  normalizeDodChecks,
  normalizeExpertAssessment,
  normalizeItem,
  normalizePendingPolicy,
  normalizeUsageCheck,
  toBoolean,
};
