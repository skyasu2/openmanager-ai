import {
  type DependencyList,
  type EffectCallback,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { logger } from '@/lib/logging';

// 🛡️ 안전한 useEffect (자동 cleanup)
export function useSafeEffect(
  effect: EffectCallback,
  deps?: DependencyList
): void {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const cleanup = effect();

    return () => {
      isMountedRef.current = false;
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      }
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: deps is passed dynamically from caller
  }, deps);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
}

// 🔄 안전한 비동기 useEffect
export function useAsyncEffect(
  asyncEffect: () => Promise<undefined | (() => void)>,
  deps?: DependencyList
): void {
  const isMountedRef = useRef(true);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    const runAsyncEffect = async () => {
      try {
        const cleanup = await asyncEffect();
        if (isMountedRef.current && cleanup && typeof cleanup === 'function') {
          cleanupRef.current = cleanup;
        }
      } catch (error) {
        if (isMountedRef.current) {
          logger.error('Async effect error:', error);
        }
      }
    };

    void runAsyncEffect();

    return () => {
      isMountedRef.current = false;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: deps is passed dynamically from caller
  }, deps);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);
}

// 📱 반응형 디자인 훅
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useSafeEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    media.addEventListener('change', listener);

    return () => {
      media.removeEventListener('change', listener);
    };
  }, [query]);

  return matches;
}

// 🔥 디바운스 훅 (성능 최적화)
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useSafeEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// 🎯 인터섹션 옵저버 훅 (지연 로딩)
export function useIntersectionObserver(
  ref: RefObject<Element>,
  options?: IntersectionObserverInit
): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useSafeEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry) {
          setIsIntersecting(entry.isIntersecting);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return isIntersecting;
}

// 💾 로컬 스토리지 훅 (타입 안전)
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      logger.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      logger.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}

// 🔔 온라인 상태 훅
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useSafeEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
