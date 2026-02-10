'use client';

import { AlertTriangle, Bug, Home, RefreshCw, Settings } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { logger } from '@/lib/logging';

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  const [isReporting, setIsReporting] = useState(false);

  const handleReport = async () => {
    setIsReporting(true);
    try {
      // 에러 리포팅 로직
      await fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.message,
          digest: error.digest,
          stack: error.stack,
          timestamp: new Date().toISOString(),
          page: 'dashboard',
        }),
      });
    } catch (e) {
      logger.error('Error reporting failed:', e);
    } finally {
      setIsReporting(false);
    }
  };

  const errorType = useMemo(() => {
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) {
      return 'network';
    }
    if (message.includes('permission') || message.includes('auth')) {
      return 'auth';
    }
    if (message.includes('loading') || message.includes('timeout')) {
      return 'loading';
    }
    return 'unknown';
  }, [error.message]);

  const errorInfo = {
    network: {
      title: '네트워크 연결 오류',
      description: '서버와의 연결에 문제가 발생했습니다.',
      solution: '인터넷 연결을 확인하고 다시 시도해주세요.',
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    },
    auth: {
      title: '권한 오류',
      description: '대시보드 접근 권한이 없습니다.',
      solution: '로그인 후 다시 시도하거나 관리자에게 문의하세요.',
      icon: Settings,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
    loading: {
      title: '로딩 시간 초과',
      description: '데이터 로딩에 예상보다 시간이 걸리고 있습니다.',
      solution: '페이지를 새로고침하거나 잠시 후 다시 시도해주세요.',
      icon: RefreshCw,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    unknown: {
      title: '알 수 없는 오류',
      description: '예상치 못한 오류가 발생했습니다.',
      solution: '문제가 지속되면 관리자에게 문의해주세요.',
      icon: Bug,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    },
  };

  const currentError = errorInfo[errorType];
  const IconComponent = currentError.icon;

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 to-blue-50 p-4 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-2xl">
        <Card className={`${currentError.bgColor} border-2`}>
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
              <div className={`rounded-full p-4 ${currentError.bgColor}`}>
                <IconComponent className={`h-12 w-12 ${currentError.color}`} />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentError.title}
            </CardTitle>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {currentError.description}
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 해결 방법 */}
            <div className="text-center">
              <p className="mb-4 text-sm font-medium text-gray-900 dark:text-white">
                해결 방법:
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                {currentError.solution}
              </p>
            </div>

            {/* 액션 버튼들 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Button
                onClick={reset}
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                다시 시도
              </Button>
              <Button
                onClick={() => (window.location.href = '/')}
                variant="outline"
                className="w-full"
              >
                <Home className="mr-2 h-4 w-4" />
                홈으로 돌아가기
              </Button>
            </div>

            {/* 안전 모드 */}
            <div className="text-center">
              <Button
                onClick={() =>
                  (window.location.href = '/dashboard?instant=true&safe=true')
                }
                variant="outline"
                className="w-full border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400"
              >
                <Settings className="mr-2 h-4 w-4" />
                안전 모드로 접속
              </Button>
            </div>

            {/* 에러 상세 정보 (개발자용) */}
            {process.env.NODE_ENV === 'development' && (
              <details className="rounded-lg bg-gray-100 p-4 dark:bg-slate-800">
                <summary className="cursor-pointer font-medium text-gray-900 dark:text-white">
                  개발자 정보
                </summary>
                <div className="mt-4 space-y-2 text-sm">
                  <div>
                    <strong>Error Message:</strong>
                    <code className="mt-1 block rounded bg-gray-200 p-2 text-xs dark:bg-slate-700">
                      {error.message}
                    </code>
                  </div>
                  {error.digest && (
                    <div>
                      <strong>Error Digest:</strong>
                      <code className="mt-1 block rounded bg-gray-200 p-2 text-xs dark:bg-slate-700">
                        {error.digest}
                      </code>
                    </div>
                  )}
                  {error.stack && (
                    <div>
                      <strong>Stack Trace:</strong>
                      <code className="mt-1 block max-h-32 overflow-auto rounded bg-gray-200 p-2 text-xs dark:bg-slate-700">
                        {error.stack}
                      </code>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* 에러 신고 */}
            <div className="text-center">
              <Button
                onClick={handleReport}
                disabled={isReporting}
                variant="ghost"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <Bug className="mr-2 h-4 w-4" />
                {isReporting ? '신고 중...' : '문제 신고하기'}
              </Button>
            </div>

            {/* 추가 도움말 */}
            <div className="border-t pt-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                문제가 계속 발생하면{' '}
                <a
                  href="mailto:support@openmanager.com"
                  className="text-blue-600 hover:underline"
                >
                  기술 지원팀
                </a>
                에 문의하세요.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 시스템 상태 확인 */}
        <div className="mt-6 text-center">
          <Card className="bg-white/50 backdrop-blur-sm dark:bg-slate-900/50">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                시스템 상태를 확인하려면{' '}
                <a
                  href="/api/health"
                  target="_blank"
                  className="text-blue-600 hover:underline"
                  rel="noopener"
                >
                  여기를 클릭
                </a>
                하세요.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
