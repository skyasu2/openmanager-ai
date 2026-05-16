'use client';

import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface ArtifactManagerRefs {
  artifactIntentInFlightRef: MutableRefObject<boolean>;
  artifactInFlightRef: MutableRefObject<boolean>;
  artifactRequestIdRef: MutableRefObject<string | null>;
  artifactAbortControllerRef: MutableRefObject<AbortController | null>;
}

export interface ArtifactManager {
  isLoading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  refs: ArtifactManagerRefs;
  isBusy: () => boolean;
  reset: () => void;
  abortActiveRequest: () => void;
}

export function useArtifactManager(): ArtifactManager {
  const [isLoading, setLoading] = useState(false);
  const artifactIntentInFlightRef = useRef(false);
  const artifactInFlightRef = useRef(false);
  const artifactRequestIdRef = useRef<string | null>(null);
  const artifactAbortControllerRef = useRef<AbortController | null>(null);

  const refs = useMemo<ArtifactManagerRefs>(
    () => ({
      artifactIntentInFlightRef,
      artifactInFlightRef,
      artifactRequestIdRef,
      artifactAbortControllerRef,
    }),
    []
  );

  const reset = useCallback(() => {
    artifactAbortControllerRef.current?.abort();
    artifactAbortControllerRef.current = null;
    artifactRequestIdRef.current = null;
    artifactIntentInFlightRef.current = false;
    artifactInFlightRef.current = false;
    setLoading(false);
  }, []);

  const isBusy = useCallback(
    () => artifactInFlightRef.current || artifactIntentInFlightRef.current,
    []
  );

  const abortActiveRequest = useCallback(() => {
    artifactAbortControllerRef.current?.abort();
  }, []);

  return useMemo(
    () => ({
      isLoading,
      setLoading,
      refs,
      isBusy,
      reset,
      abortActiveRequest,
    }),
    [abortActiveRequest, isBusy, isLoading, refs, reset]
  );
}
