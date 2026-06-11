const SYSTEM_BOOT_INTENT_KEY = 'openmanager:system-boot:intent';
const SYSTEM_BOOT_INTENT_TTL_MS = 30_000;

interface SystemBootIntentPayload {
  requestedAt: number;
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function markSystemBootIntent(now = Date.now()): void {
  const storage = getSessionStorage();
  if (!storage) return;

  const payload: SystemBootIntentPayload = { requestedAt: now };
  try {
    storage.setItem(SYSTEM_BOOT_INTENT_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

export function consumeSystemBootIntent(now = Date.now()): boolean {
  const storage = getSessionStorage();
  if (!storage) return false;

  let rawIntent: string | null = null;
  try {
    rawIntent = storage.getItem(SYSTEM_BOOT_INTENT_KEY);
    storage.removeItem(SYSTEM_BOOT_INTENT_KEY);
  } catch {
    return false;
  }

  if (!rawIntent) return false;

  try {
    const payload = JSON.parse(rawIntent) as Partial<SystemBootIntentPayload>;
    if (typeof payload.requestedAt !== 'number') return false;
    const ageMs = now - payload.requestedAt;
    return ageMs >= 0 && ageMs <= SYSTEM_BOOT_INTENT_TTL_MS;
  } catch {
    return false;
  }
}
