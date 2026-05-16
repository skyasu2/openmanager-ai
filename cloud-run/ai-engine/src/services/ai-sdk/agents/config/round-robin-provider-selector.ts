import { getMemoryCooldown } from '../../../resilience/quota-store-memory';
import type { TextRuntimeProvider } from './agent-runtime-policy';

// ============================================================================
// Provider Context Window Registry (Guaranteed Minimums)
// ============================================================================

// Context window values from provider-capabilities.ts getTextProviderCapabilities
// These are conservative minimums guaranteed across model variants.
const PROVIDER_CONTEXT_WINDOW: Record<TextRuntimeProvider, number> = {
  groq: 131_072,    // Llama 4 Scout (17B) — 131K context
  mistral: 32_000,   // Mistral Small — 32K context
  zai: 128_000,     // GLM Flash — 128K context
  cerebras: 65_536,  // gpt-oss-120b — 65.5K context
};

/**
 * Round-Robin Rotation Pool in canonical order.
 * Order reflects baseline priority but cursor position determines actual selection.
 */
const ROTATION_POOL: readonly TextRuntimeProvider[] = [
  'groq',
  'mistral',
  'zai',
  'cerebras',
] as const;

/**
 * Module-level cursor for round-robin rotation.
 * Cloud Run instance-level, resets on restart.
 * Max 5 concurrent users → no mutex needed.
 */
let _cursor = 0;

// ============================================================================
// Public Interfaces
// ============================================================================

export interface RoundRobinSelection {
  /** Provider order: [eligible, context-ok] → [ineligible, context-short] → [cooled, 429] */
  providerOrder: readonly TextRuntimeProvider[];
  /** Rotation slot [0-3] where this selection started. Used for UI attribution. */
  rotationSlot: number;
}

// ============================================================================
// Primary Selection Function
// ============================================================================

/**
 * Select provider order using round-robin cursor with context guard + 429 cooldown.
 *
 * Three-bucket algorithm:
 * 1. eligible   — meets minContextWindow AND not in 429 cooldown → try first
 * 2. ineligible — doesn't meet minContextWindow AND not cooled → try second
 * 3. cooled     — currently in 429 cooldown (any context) → try last as fallback
 *
 * Cooldown is set by markProviderQuotaCooldown() in retry-with-fallback.ts
 * and stored synchronously via setMemoryCooldown() in quota-store-memory.ts.
 *
 * @param minContextWindow Minimum context tokens required (default 8_000)
 * @returns Selection with providerOrder and rotationSlot for attribution
 */
export function selectRoundRobinProviderOrder(
  minContextWindow: number = 8_000,
): RoundRobinSelection {
  const startSlot = _cursor;
  const eligible: TextRuntimeProvider[] = [];
  const ineligible: TextRuntimeProvider[] = [];
  const cooled: TextRuntimeProvider[] = [];

  // Rotate pool starting from cursor position
  for (let i = 0; i < ROTATION_POOL.length; i++) {
    const idx = (startSlot + i) % ROTATION_POOL.length;
    const provider = ROTATION_POOL[idx];

    // 429 cooldown check (synchronous, in-memory only — sufficient for single instance)
    if (getMemoryCooldown(provider) !== null) {
      cooled.push(provider);
      continue;
    }

    if (PROVIDER_CONTEXT_WINDOW[provider] >= minContextWindow) {
      eligible.push(provider);
    } else {
      ineligible.push(provider);
    }
  }

  // Advance cursor for next request
  _cursor = (startSlot + 1) % ROTATION_POOL.length;

  return {
    providerOrder: [...eligible, ...ineligible, ...cooled],
    rotationSlot: startSlot,
  };
}

// ============================================================================
// Test/Admin Helpers
// ============================================================================

/** Reset cursor for deterministic test behavior. */
export function resetRoundRobinCursor(): void {
  _cursor = 0;
}

/** Retrieve current cursor position (test/admin diagnostics). */
export function getRoundRobinCursor(): number {
  return _cursor;
}

/** Set cursor to specific position (test setup). */
export function setRoundRobinCursor(position: number): void {
  if (position < 0 || position >= ROTATION_POOL.length) {
    throw new Error(`Cursor must be in range [0, ${ROTATION_POOL.length - 1}]`);
  }
  _cursor = position;
}
