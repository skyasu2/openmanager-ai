/**
 * Domain Registry
 *
 * Decouples the supervisor from any specific domain implementation.
 * Each domain registers its runtime host factory here; the supervisor
 * and routes look up hosts by domain ID without importing domain modules
 * directly.
 *
 * Usage — registering a domain (done once at module load in *-runtime-host.ts):
 *   registerDomainHost('my-domain-id', createMyDomainRuntimeHost);
 *
 * Usage — resolving a host in routes / supervisor:
 *   const host = getDomainHost('my-domain-id') ?? getDefaultDomainHost();
 *   const runtimeContext = await resolveDomainRuntimeContext(request);
 */

import type { AssistantRuntimeHost } from './assistant-runtime-host';
import {
  resolveSupervisorRuntimeContext,
  type SupervisorRuntimeContext,
} from './assistant-runtime-host';
import type { SupervisorRequest } from './supervisor-types';

type HostGetter = () => AssistantRuntimeHost;

const hostGetters = new Map<string, HostGetter>();
let defaultDomainId: string | undefined;

/**
 * Register a domain host factory.
 * The first domain registered becomes the default unless `asDefault` is explicit.
 */
export function registerDomainHost(
  domainId: string,
  getter: HostGetter,
  asDefault?: boolean
): void {
  hostGetters.set(domainId, getter);
  if (asDefault === true || defaultDomainId === undefined) {
    defaultDomainId = domainId;
  }
}

/** Returns the host for a specific domain ID, or undefined if not registered. */
export function getDomainHost(
  domainId: string
): AssistantRuntimeHost | undefined {
  return hostGetters.get(domainId)?.();
}

/**
 * Returns the default domain host (first registered, or explicitly set).
 * Throws if no domain has been registered yet.
 */
export function getDefaultDomainHost(): AssistantRuntimeHost {
  if (!defaultDomainId) {
    throw new Error(
      '[DomainRegistry] No domain registered. ' +
        'Import a domain runtime-host module before using the supervisor.'
    );
  }
  const host = getDomainHost(defaultDomainId);
  if (!host) {
    throw new Error(
      `[DomainRegistry] Default domain "${defaultDomainId}" getter returned undefined.`
    );
  }
  return host;
}

/**
 * Resolves a SupervisorRuntimeContext for the given request.
 * Uses request.runtimeHost if already set; otherwise falls back to the
 * default registered domain host.
 *
 * Replaces the monitoring-specific resolveMonitoringSupervisorRuntimeContext.
 */
export function resolveDomainRuntimeContext(
  request: SupervisorRequest
): Promise<SupervisorRuntimeContext> {
  const host = request.runtimeHost ?? getDefaultDomainHost();
  return resolveSupervisorRuntimeContext(request, host);
}
