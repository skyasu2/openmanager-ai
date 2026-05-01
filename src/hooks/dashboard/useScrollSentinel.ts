import { type RefObject, useEffect, useRef } from 'react';

interface ScrollSentinelOptions {
  rootRef?: RefObject<Element | null>;
  rootMargin?: string;
}

export function useScrollSentinel(
  onIntersect: () => void,
  enabled: boolean,
  { rootRef, rootMargin = '120px' }: ScrollSentinelOptions = {}
) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!enabled || !sentinel || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        observer.disconnect();
        onIntersect();
      },
      {
        root: rootRef?.current ?? null,
        rootMargin,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [enabled, onIntersect, rootMargin, rootRef]);

  return sentinelRef;
}
