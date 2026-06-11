/**
 * 🐍 useCodeInterpreter Hook
 *
 * React hook for browser-based Python code execution.
 * Uses Pyodide (WebAssembly) for zero-cost execution.
 *
 * @version 1.0.0
 * @created 2025-12-18
 *
 * @example
 * ```tsx
 * const { execute, isReady, isLoading, error } = useCodeInterpreter();
 *
 * const handleRun = async () => {
 *   const result = await execute('print("Hello!")');
 *   logger.info(result.output);
 * };
 * ```
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logging';
import {
  type ExecutionResult,
  pyodideService,
} from '@/services/code-interpreter';

export interface UseCodeInterpreterReturn {
  /** Execute Python code */
  execute: (code: string) => Promise<ExecutionResult>;
  /** Whether Pyodide is ready */
  isReady: boolean;
  /** Whether Pyodide is currently loading */
  isLoading: boolean;
  /** Initialization error if any */
  error: string | null;
  /** Manually initialize Pyodide */
  initialize: () => Promise<void>;
}

export function useCodeInterpreter(): UseCodeInterpreterReturn {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);

  const initialize = useCallback(async () => {
    if (pyodideService.isReady()) {
      setIsReady(true);
      setError(null);
      lastErrorRef.current = null;
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    lastErrorRef.current = null;

    try {
      await pyodideService.initialize();
      setIsReady(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Pyodide 초기화 실패';
      lastErrorRef.current = errorMessage;
      setError(errorMessage);
      logger.error('🐍 [Pyodide] 초기화 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // Check if already initialized on mount
  useEffect(() => {
    if (pyodideService.isReady()) {
      setIsReady(true);
      setError(null);
      lastErrorRef.current = null;
    }
  }, []);

  const execute = useCallback(
    async (code: string): Promise<ExecutionResult> => {
      if (!isReady) {
        // Try to initialize first
        if (!pyodideService.isReady()) {
          await initialize();
        }
      }

      if (!pyodideService.isReady()) {
        return {
          success: false,
          output: '',
          error:
            lastErrorRef.current ||
            error ||
            'Pyodide가 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.',
          executionTime: 0,
        };
      }

      return pyodideService.execute(code);
    },
    [isReady, initialize, error]
  );

  return {
    execute,
    isReady,
    isLoading,
    error,
    initialize,
  };
}
