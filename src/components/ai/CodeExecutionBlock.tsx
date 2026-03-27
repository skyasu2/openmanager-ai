/**
 * 🐍 CodeExecutionBlock Component
 *
 * Renders a code block with "Run" button and execution results.
 * Uses Pyodide for browser-based Python execution.
 *
 * @version 1.0.0
 * @created 2025-12-18
 */

'use client';

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Loader2,
  Play,
  Terminal,
} from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useCodeInterpreter } from '@/hooks/useCodeInterpreter';
import { logger } from '@/lib/logging';
import type { ExecutionResult } from '@/services/code-interpreter';

export interface CodeExecutionBlockProps {
  /** The code to display and optionally execute */
  code: string;
  /** Programming language (currently only 'python' is executable) */
  language?: string;
  /** Whether to show the run button */
  showRunButton?: boolean;
  /** Callback when code is executed */
  onExecute?: (result: ExecutionResult) => void;
}

/**
 * Code Execution Block Component
 *
 * Displays code with syntax highlighting and optional execution capability.
 */
export const CodeExecutionBlock = memo(function CodeExecutionBlock({
  code,
  language = 'python',
  showRunButton = true,
  onExecute,
}: CodeExecutionBlockProps) {
  const {
    execute,
    isReady,
    isLoading: isPyodideLoading,
    initialize,
  } = useCodeInterpreter();
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const isPythonCode = language.toLowerCase() === 'python' || language === 'py';
  const canExecute = isPythonCode && showRunButton;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      logger.error('복사 실패:', err);
    }
  }, [code]);

  const handleRun = useCallback(async () => {
    if (!isPythonCode) return;

    // Initialize Pyodide if not ready
    if (!isReady && !isPyodideLoading) {
      await initialize();
    }

    setIsExecuting(true);
    setResult(null);

    try {
      const executionResult = await execute(code);
      setResult(executionResult);
      onExecute?.(executionResult);
    } catch (err) {
      setResult({
        success: false,
        output: '',
        error: err instanceof Error ? err.message : '실행 중 오류 발생',
        executionTime: 0,
      });
    } finally {
      setIsExecuting(false);
    }
  }, [
    code,
    isPythonCode,
    isReady,
    isPyodideLoading,
    initialize,
    execute,
    onExecute,
  ]);

  const handleDownloadPlot = useCallback(
    (base64Image: string, index: number) => {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${base64Image}`;
      link.download = `plot-${index + 1}.png`;
      link.click();
    },
    []
  );

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-2">
        <div className="flex items-center space-x-2">
          <Terminal className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-300">
            {language.toUpperCase()}
          </span>
          {isPythonCode && (
            <span className="rounded bg-green-600/20 px-1.5 py-0.5 text-xs text-green-400">
              실행 가능
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1 rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
            title="코드 복사"
          >
            {isCopied ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                <span className="text-green-400">복사됨</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>복사</span>
              </>
            )}
          </button>

          {/* Run Button */}
          {canExecute && (
            <button
              type="button"
              onClick={handleRun}
              disabled={isExecuting || isPyodideLoading}
              className="flex items-center space-x-1 rounded bg-green-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              title={isPyodideLoading ? 'Python 환경 로딩 중...' : '코드 실행'}
            >
              {isExecuting || isPyodideLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{isPyodideLoading ? '로딩...' : '실행 중...'}</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>실행</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Code Content */}
      <pre className="overflow-x-auto p-4 text-sm">
        <code className="text-gray-100">{code}</code>
      </pre>

      {/* Execution Result */}
      {result && (
        <div
          className={`border-t ${
            result.success
              ? 'border-green-700 bg-green-900/20'
              : 'border-red-700 bg-red-900/20'
          }`}
        >
          {/* Result Header */}
          <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
            <div className="flex items-center space-x-2">
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-400" />
              )}
              <span
                className={`text-xs font-medium ${
                  result.success ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {result.success ? '실행 완료' : '실행 오류'}
              </span>
            </div>
            <div className="flex items-center space-x-1 text-xs text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              <span>{result.executionTime}ms</span>
            </div>
          </div>

          {/* Result Content */}
          <div className="p-4">
            {result.error ? (
              <pre className="whitespace-pre-wrap text-sm text-red-400">
                {result.error}
              </pre>
            ) : (
              <>
                {result.output && (
                  <pre className="whitespace-pre-wrap text-sm text-gray-200">
                    {result.output}
                  </pre>
                )}

                {/* Plot Images */}
                {result.plots && result.plots.length > 0 && (
                  <div className="mt-4 space-y-4">
                    {result.plots.map((plot, index) => (
                      <div key={index} className="relative">
                        {/* biome-ignore lint/performance/noImgElement: Base64 dynamic images cannot use next/image */}
                        <img
                          src={`data:image/png;base64,${plot}`}
                          alt={`Plot ${index + 1}`}
                          className="max-w-full rounded border border-gray-700"
                        />
                        <button
                          type="button"
                          onClick={() => handleDownloadPlot(plot, index)}
                          className="absolute right-2 top-2 rounded bg-gray-800/80 p-1.5 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                          title="이미지 다운로드"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
