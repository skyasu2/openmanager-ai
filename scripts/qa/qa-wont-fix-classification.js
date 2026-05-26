const CATEGORY_DEFINITIONS = [
  {
    id: 'policy-missing',
    label: 'Policy Missing',
    description:
      'Accepted wont-fix item has no explicit policy note and should be rechecked before relying on the acceptance.',
    matches: ({ text, hasPolicyNote }) => !hasPolicyNote,
  },
  {
    id: 'platform-constraint',
    label: 'Platform Constraint',
    description:
      'Accepted because the hosting platform or provider boundary constrains the behavior.',
    matches: ({ text }) =>
      text.includes('platform constraint') ||
      text.includes('플랫폼 제약') ||
      text.includes('server-timing') ||
      text.includes('vercel production'),
  },
  {
    id: 'free-tier-tradeoff',
    label: 'Free Tier Tradeoff',
    description:
      'Accepted to preserve the free-tier production shape instead of increasing deployed resources.',
    matches: ({ text }) =>
      text.includes('free tier') ||
      text.includes('무료 티어') ||
      text.includes('cold start') ||
      text.includes('cold-start') ||
      text.includes('cloud run cold') ||
      text.includes('streaming-ai-fallback-cold-start'),
  },
  {
    id: 'historical-obsolete',
    label: 'Historical Obsolete',
    description:
      'Accepted because the item is historical, legacy, or superseded by current QA/CI gates.',
    matches: ({ text, item }) =>
      String(item.id || '').startsWith('feature-dod-') ||
      text.includes('historical') ||
      text.includes('obsolete') ||
      text.includes('superseded') ||
      text.includes('stale') ||
      text.includes('legacy'),
  },
  {
    id: 'portfolio-deferral',
    label: 'Portfolio Deferral',
    description:
      'Accepted as non-blocking portfolio debt to avoid over-engineering.',
    matches: ({ text }) =>
      text.includes('portfolio') ||
      text.includes('포트폴리오') ||
      text.includes('over-engineering') ||
      text.includes('overengineering') ||
      text.includes('과도') ||
      text.includes('non-blocking') ||
      text.includes('비차단'),
  },
  {
    id: 'accepted-debt',
    label: 'Accepted Debt',
    description:
      'Accepted wont-fix item with an explicit note that does not match a more specific category.',
    matches: () => true,
  },
];

const REVIEW_CLASS_DEFINITIONS = [
  {
    id: 'verify-before-promotion',
    label: 'Verify Before Promotion',
    description:
      'Potentially stale accepted debt. Re-run a targeted QA check before promoting it back to implementation work.',
    matches: ({ text, item }) =>
      text.includes('deterministic path') ||
      text.includes('deterministic') ||
      String(item.id || '').includes('routing') ||
      text.includes('잘못 라우팅') ||
      text.includes('오발동') ||
      text.includes('response content') ||
      text.includes('내용 부실') ||
      text.includes('evidence label') ||
      text.includes('metadata') ||
      text.includes('메타데이터') ||
      text.includes('response mismatch') ||
      text.includes('응답 구조 불일치') ||
      text.includes('console error') ||
      text.includes('콘솔 에러') ||
      text.includes('transient') ||
      text.includes('drift') ||
      text.includes('드리프트'),
  },
  {
    id: 'future-product-expansion',
    label: 'Future Product Expansion',
    description:
      'Valid enhancement only if the portfolio scope expands into a fuller product surface or longer-lived conversational memory.',
    matches: ({ text }) =>
      text.includes('pronoun') ||
      text.includes('대명사') ||
      text.includes('image-upload') ||
      text.includes('upload') ||
      text.includes('e2e path') ||
      text.includes('qa pack') ||
      text.includes('adversarial') ||
      text.includes('domain context') ||
      text.includes('도메인 특성') ||
      text.includes('dashboard threshold') ||
      text.includes('네트워크 i/o') ||
      text.includes('location') ||
      text.includes('az1') ||
      text.includes('az2') ||
      text.includes('vision') ||
      text.includes('gemini'),
  },
  {
    id: 'low-priority-polish',
    label: 'Low-Priority Polish',
    description:
      'Non-blocking answer, copy, layout, or evidence-label polish. Keep accepted unless it appears in a release-facing regression.',
    matches: ({ text }) =>
      text.includes('polish') ||
      text.includes('copy') ||
      text.includes('density') ||
      text.includes('style') ||
      text.includes('formatting') ||
      text.includes('rewrite') ||
      text.includes('response quality') ||
      text.includes('응답 내용') ||
      text.includes('응답 품질') ||
      text.includes('충실도') ||
      text.includes('톤 조정') ||
      text.includes('accordion') ||
      text.includes('아코디언') ||
      text.includes('ranking') ||
      text.includes('랭킹') ||
      text.includes('advisor'),
  },
  {
    id: 'accepted-no-action',
    label: 'Accepted No-Action',
    description:
      'Accepted no-fix item with no current trigger for implementation work.',
    matches: () => true,
  },
];

const PRIORITY_RANK = new Map([
  ['P0', 0],
  ['P1', 1],
  ['P2', 2],
  ['P3', 3],
]);

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function itemSearchText(item) {
  return [
    item.id,
    item.title,
    item.lastPolicyNote,
    item.lastNote,
    item.overengineeringScope,
  ]
    .map(normalizeText)
    .join(' ');
}

function classifyWontFixItem(item) {
  const lastPolicyNote = String(item.lastPolicyNote || '').trim();
  const context = {
    item,
    text: itemSearchText(item),
    hasPolicyNote: lastPolicyNote.length > 0,
  };

  return CATEGORY_DEFINITIONS.find((category) => category.matches(context));
}

function classifyWontFixReviewClass(item) {
  const context = {
    item,
    text: itemSearchText(item),
  };

  return REVIEW_CLASS_DEFINITIONS.find((reviewClass) =>
    reviewClass.matches(context)
  );
}

function compareWontFixItems(left, right) {
  const leftRank = PRIORITY_RANK.get(left.priority || 'P2') ?? 2;
  const rightRank = PRIORITY_RANK.get(right.priority || 'P2') ?? 2;
  if (leftRank !== rightRank) return leftRank - rightRank;
  return String(left.id || '').localeCompare(String(right.id || ''));
}

function groupItemsByDefinitions(items, definitions, classifier) {
  const groupsById = new Map(
    definitions.map((definition) => [
      definition.id,
      {
        id: definition.id,
        label: definition.label,
        description: definition.description,
        items: [],
      },
    ])
  );

  for (const item of items) {
    const definition = classifier(item);
    groupsById.get(definition.id).items.push(item);
  }

  return definitions.map((definition) => groupsById.get(definition.id))
    .filter((group) => group.items.length > 0)
    .map((group) => ({
      ...group,
      items: [...group.items].sort(compareWontFixItems),
    }));
}

function groupWontFixItemsByCategory(items) {
  return groupItemsByDefinitions(
    items,
    CATEGORY_DEFINITIONS,
    classifyWontFixItem
  );
}

function groupWontFixItemsByReviewClass(items) {
  return groupItemsByDefinitions(
    items,
    REVIEW_CLASS_DEFINITIONS,
    classifyWontFixReviewClass
  );
}

function formatWontFixCategorySummary(groups) {
  return groups
    .map((group) => `${group.label} ${group.items.length}`)
    .join(', ');
}

module.exports = {
  CATEGORY_DEFINITIONS,
  REVIEW_CLASS_DEFINITIONS,
  classifyWontFixItem,
  classifyWontFixReviewClass,
  groupWontFixItemsByCategory,
  groupWontFixItemsByReviewClass,
  formatWontFixCategorySummary,
};
