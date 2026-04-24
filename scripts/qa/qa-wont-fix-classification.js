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

function compareWontFixItems(left, right) {
  const leftRank = PRIORITY_RANK.get(left.priority || 'P2') ?? 2;
  const rightRank = PRIORITY_RANK.get(right.priority || 'P2') ?? 2;
  if (leftRank !== rightRank) return leftRank - rightRank;
  return String(left.id || '').localeCompare(String(right.id || ''));
}

function groupWontFixItemsByCategory(items) {
  const groupsById = new Map(
    CATEGORY_DEFINITIONS.map((category) => [
      category.id,
      {
        id: category.id,
        label: category.label,
        description: category.description,
        items: [],
      },
    ])
  );

  for (const item of items) {
    const category = classifyWontFixItem(item);
    groupsById.get(category.id).items.push(item);
  }

  return CATEGORY_DEFINITIONS.map((category) => groupsById.get(category.id))
    .filter((group) => group.items.length > 0)
    .map((group) => ({
      ...group,
      items: [...group.items].sort(compareWontFixItems),
    }));
}

function formatWontFixCategorySummary(groups) {
  return groups
    .map((group) => `${group.label} ${group.items.length}`)
    .join(', ');
}

module.exports = {
  CATEGORY_DEFINITIONS,
  classifyWontFixItem,
  groupWontFixItemsByCategory,
  formatWontFixCategorySummary,
};
