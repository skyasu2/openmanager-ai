export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function parseFiniteDate(timestamp: string | undefined): Date | undefined {
  if (!timestamp) return undefined;

  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function pad3(value: number): string {
  return String(value).padStart(3, '0');
}

export function toKSTShiftedDate(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET_MS);
}

export function formatKSTLabelFromShiftedDate(kstDate: Date): string {
  const dateLabel = [
    kstDate.getUTCFullYear(),
    pad2(kstDate.getUTCMonth() + 1),
    pad2(kstDate.getUTCDate()),
  ].join('-');
  const timeLabel = `${pad2(kstDate.getUTCHours())}:${pad2(kstDate.getUTCMinutes())}`;

  return `${dateLabel} ${timeLabel} KST`;
}

export function formatKSTOffsetTimestampFromShiftedDate(kstDate: Date): string {
  const dateLabel = [
    kstDate.getUTCFullYear(),
    pad2(kstDate.getUTCMonth() + 1),
    pad2(kstDate.getUTCDate()),
  ].join('-');
  const timeLabel = [
    pad2(kstDate.getUTCHours()),
    pad2(kstDate.getUTCMinutes()),
    pad2(kstDate.getUTCSeconds()),
  ].join(':');

  return `${dateLabel}T${timeLabel}.${pad3(kstDate.getUTCMilliseconds())}+09:00`;
}

export function formatKSTTimestampLabel(
  timestamp: string | undefined
): string | undefined {
  const date = parseFiniteDate(timestamp);
  if (!date) return undefined;

  return formatKSTLabelFromShiftedDate(toKSTShiftedDate(date));
}
