/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useArtifactManager } from './useArtifactManager';

describe('useArtifactManager', () => {
  it('resets artifact loading and all in-flight refs together', () => {
    const { result } = renderHook(() => useArtifactManager());
    const abortController = new AbortController();

    act(() => {
      result.current.setLoading(true);
      result.current.refs.artifactIntentInFlightRef.current = true;
      result.current.refs.artifactInFlightRef.current = true;
      result.current.refs.artifactRequestIdRef.current = 'artifact-request-1';
      result.current.refs.artifactAbortControllerRef.current = abortController;
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isBusy()).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(abortController.signal.aborted).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.refs.artifactIntentInFlightRef.current).toBe(false);
    expect(result.current.refs.artifactInFlightRef.current).toBe(false);
    expect(result.current.isBusy()).toBe(false);
    expect(result.current.refs.artifactRequestIdRef.current).toBeNull();
    expect(result.current.refs.artifactAbortControllerRef.current).toBeNull();
  });

  it('aborts the active artifact request without clearing in-flight state', () => {
    const { result } = renderHook(() => useArtifactManager());
    const abortController = new AbortController();

    act(() => {
      result.current.setLoading(true);
      result.current.refs.artifactInFlightRef.current = true;
      result.current.refs.artifactRequestIdRef.current = 'artifact-request-2';
      result.current.refs.artifactAbortControllerRef.current = abortController;
    });

    act(() => {
      result.current.abortActiveRequest();
    });

    expect(abortController.signal.aborted).toBe(true);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.refs.artifactInFlightRef.current).toBe(true);
    expect(result.current.refs.artifactRequestIdRef.current).toBe(
      'artifact-request-2'
    );
  });
});
