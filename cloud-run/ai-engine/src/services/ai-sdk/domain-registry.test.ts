import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssistantRuntimeHost } from './assistant-runtime-host';

function createMockMonitoringHost(): AssistantRuntimeHost {
  return {
    domain: { id: 'openmanager-monitoring' },
  } as AssistantRuntimeHost;
}

describe('domain-registry', () => {
  afterEach(() => {
    vi.doUnmock('./monitoring-runtime-host');
    vi.resetModules();
  });

  it('keeps the registry empty until a domain runtime host is bootstrapped', async () => {
    vi.resetModules();

    const registry = await import('./domain-registry');

    expect(() => registry.getDefaultDomainHost()).toThrow(
      'No domain registered'
    );
  });

  it('bootstraps the built-in monitoring domain without agent-config side effects', async () => {
    vi.resetModules();

    const registry = await import('./domain-registry');
    const host = createMockMonitoringHost();

    vi.doMock('./monitoring-runtime-host', async () => {
      const currentRegistry = await import('./domain-registry');
      currentRegistry.registerDomainHost(
        'openmanager-monitoring',
        () => host,
        true
      );

      return {
        getDefaultMonitoringAssistantRuntimeHost: () => host,
      };
    });

    await import('./domain-bootstrap');
    const monitoring = await import('./monitoring-runtime-host');

    expect(registry.getDefaultDomainHost()).toBe(
      monitoring.getDefaultMonitoringAssistantRuntimeHost()
    );
    expect(registry.getDomainHost('openmanager-monitoring')).toBe(
      monitoring.getDefaultMonitoringAssistantRuntimeHost()
    );
  });

  it('registers the real monitoring host through domain bootstrap', async () => {
    vi.resetModules();
    vi.doUnmock('./monitoring-runtime-host');

    const registry = await import('./domain-registry');
    await import('./domain-bootstrap');

    const host = registry.getDefaultDomainHost();
    expect(host.domain.id).toBe('openmanager-monitoring');
    expect(host.createToolSet).toEqual(expect.any(Function));
    expect(host.createSystemPrompt).toEqual(expect.any(Function));
    expect(host.adapterKinds).toEqual(
      expect.objectContaining({
        stateStore: expect.any(String),
        sessionStore: expect.any(String),
        jobQueue: expect.any(String),
      })
    );
  }, 60_000);
});
