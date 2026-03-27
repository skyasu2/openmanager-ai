import { logger } from '../../../lib/logger';

export type HandoffEvent = {
  from: string;
  to: string;
  reason?: string;
  timestamp: Date;
};

const HANDOFF_MAX = 50;
const handoffBuffer: (HandoffEvent | null)[] = new Array(HANDOFF_MAX).fill(null);
let handoffHead = 0;
let handoffCount = 0;

export function recordHandoff(from: string, to: string, reason?: string) {
  handoffBuffer[handoffHead] = { from, to, reason, timestamp: new Date() };
  handoffHead = (handoffHead + 1) % HANDOFF_MAX;
  if (handoffCount < HANDOFF_MAX) {
    handoffCount += 1;
  }

  logger.info(
    `[Handoff] ${from} → ${to} (${reason || 'no reason'}) [${handoffCount}/${HANDOFF_MAX}]`
  );
}

export function getRecentHandoffs(n = 10): HandoffEvent[] {
  const result: HandoffEvent[] = [];
  const start = (handoffHead - handoffCount + HANDOFF_MAX) % HANDOFF_MAX;
  const count = Math.min(n, handoffCount);
  const offset = handoffCount - count;

  for (let i = 0; i < count; i += 1) {
    const idx = (start + offset + i) % HANDOFF_MAX;
    const event = handoffBuffer[idx];
    if (event) {
      result.push(event);
    }
  }

  return result;
}
