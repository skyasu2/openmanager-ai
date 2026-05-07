import { describe, expect, it } from 'vitest';
import { resolveSupervisorInternalDisclosureMode } from './internal-disclosure-mode';

describe('resolveSupervisorInternalDisclosureMode', () => {
  it('allows local development and server-verified test contexts', () => {
    expect(
      resolveSupervisorInternalDisclosureMode({ authType: 'development' })
    ).toBe('developer');
    expect(resolveSupervisorInternalDisclosureMode({ authType: 'test' })).toBe(
      'developer'
    );
    expect(
      resolveSupervisorInternalDisclosureMode({ authType: 'test-secret' })
    ).toBe('developer');
  });

  it('allows verified PIN guest sessions only when a server-issued userId exists', () => {
    expect(
      resolveSupervisorInternalDisclosureMode({
        authType: 'guest',
        userId: 'issued-guest-session-id',
      })
    ).toBe('developer');

    expect(resolveSupervisorInternalDisclosureMode({ authType: 'guest' })).toBe(
      undefined
    );
  });

  it('does not allow normal OAuth/API-key contexts', () => {
    expect(
      resolveSupervisorInternalDisclosureMode({
        authType: 'supabase',
        userId: 'user-1',
      })
    ).toBeUndefined();
    expect(
      resolveSupervisorInternalDisclosureMode({ authType: 'api-key' })
    ).toBeUndefined();
  });
});
