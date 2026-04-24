import type { Page } from '@playwright/test';

export interface DashboardStatusSnapshot {
  total: number;
  online: number;
  warning: number;
  critical: number;
  offline: number;
  dataSource?: string;
  dataSlot?: string;
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function readCount(text: string, pattern: RegExp): number | null {
  const match = pattern.exec(text);
  if (!match) return null;

  const rawValue = match.slice(1).find(Boolean);
  if (!rawValue) return null;

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDashboardStatusSnapshot(
  text: string
): DashboardStatusSnapshot | null {
  const normalized = compactWhitespace(text);
  const total = readCount(normalized, /(?:전체\s*(\d+)|([0-9]+)\s*개\s*서버)/);
  const online = readCount(normalized, /온라인\s*(\d+)/);
  const warning = readCount(normalized, /경고\s*(\d+)/);
  const critical = readCount(normalized, /위험\s*(\d+)/);
  const offline = readCount(normalized, /오프라인\s*(\d+)/);

  const counts = [total, online, warning, critical, offline];
  if (counts.some((count) => count === null)) {
    return null;
  }

  return {
    total: total as number,
    online: online as number,
    warning: warning as number,
    critical: critical as number,
    offline: offline as number,
    ...parseDashboardSnapshotMetadata(normalized),
  };
}

function parseDashboardSnapshotMetadata(
  normalizedText: string
): Pick<DashboardStatusSnapshot, 'dataSource' | 'dataSlot'> {
  const metadataMatch =
    /(?:전체\s*\d+|[0-9]+\s*개\s*서버)\s+(.+?)\s+온라인\s*\d+/.exec(
      normalizedText
    );
  const rawMetadata = metadataMatch?.[1]?.trim();
  if (!rawMetadata) return {};

  const [source, slot] = rawMetadata.split('·').map((part) => part.trim());
  return {
    ...(source ? { dataSource: source } : {}),
    ...(slot ? { dataSlot: slot } : {}),
  };
}

function includesCount(text: string, labels: string[], count: number): boolean {
  return labels.some((label) => {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(
      `(?<![가-힣A-Za-z0-9])${escapedLabel}\\s*${count}\\s*(?:대|개)?(?!\\d)`
    ).test(text);
  });
}

export function doesAiTextMatchDashboardStatus(
  aiText: string,
  snapshot: DashboardStatusSnapshot
): boolean {
  const normalized = compactWhitespace(aiText);

  return (
    includesCount(normalized, ['전체'], snapshot.total) &&
    includesCount(normalized, ['정상', '온라인'], snapshot.online) &&
    includesCount(normalized, ['경고'], snapshot.warning) &&
    includesCount(normalized, ['위험'], snapshot.critical) &&
    includesCount(normalized, ['오프라인'], snapshot.offline)
  );
}

export function formatDashboardStatusSnapshot(
  snapshot: DashboardStatusSnapshot
): string {
  const parts = [
    `total=${snapshot.total}`,
    `online=${snapshot.online}`,
    `warning=${snapshot.warning}`,
    `critical=${snapshot.critical}`,
    `offline=${snapshot.offline}`,
  ];
  if (snapshot.dataSource) {
    parts.push(`source=${snapshot.dataSource}`);
  }
  if (snapshot.dataSlot) {
    parts.push(`slot=${snapshot.dataSlot}`);
  }
  return parts.join(', ');
}

export function getNewConversationText(
  previousText: string,
  currentText: string
): string {
  const previous = previousText.trim();
  const current = currentText.trim();

  if (!previous) return current;

  if (current.startsWith(previous)) {
    return current.slice(previous.length).trim();
  }

  return current;
}

export async function readDashboardStatusSnapshot(
  page: Page
): Promise<DashboardStatusSnapshot> {
  const dashboardText =
    (await page
      .locator('main[aria-label="대시보드"], main')
      .first()
      .textContent({ timeout: 5000 })
      .catch(() => '')) ?? '';

  const snapshot = parseDashboardStatusSnapshot(dashboardText);
  if (!snapshot) {
    throw new Error(
      `Dashboard status counts not found. text=${compactWhitespace(
        dashboardText
      ).slice(0, 500)}`
    );
  }

  return snapshot;
}
