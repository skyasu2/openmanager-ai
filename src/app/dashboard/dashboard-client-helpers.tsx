'use client';

import dynamic from 'next/dynamic';

export const AnimatedAISidebar = dynamic(
  async () => {
    const AISidebarV4 = await import('@/components/ai-sidebar/AISidebarV4');

    return function AnimatedAISidebarWrapper(props: {
      isOpen: boolean;
      onClose: () => void;
      [key: string]: unknown;
    }) {
      const { isOpen, onClose, ...otherProps } = props;
      const MOBILE_SIDEBAR_WIDTH_VW = 90;
      const mobileBackdropTapWidth = `calc(100vw - ${MOBILE_SIDEBAR_WIDTH_VW}vw)`;
      return (
        <>
          {isOpen && (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 z-30 bg-black/50 md:hidden"
              />
              <button
                type="button"
                className="fixed inset-y-0 left-0 z-40 md:hidden"
                style={{ width: mobileBackdropTapWidth }}
                onClick={onClose}
                aria-label="사이드바 닫기"
              />
              <div
                className="fixed right-0 top-0 z-50 h-dvh w-full max-w-[90vw] transform transition-transform duration-300 ease-in-out md:top-24 md:h-[calc(100dvh-6rem)] md:w-96 lg:top-16 lg:h-[calc(100dvh-4rem)]"
                style={{
                  transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                }}
              >
                <AISidebarV4.default
                  onClose={onClose}
                  isOpen={isOpen}
                  {...otherProps}
                />
              </div>
            </>
          )}
        </>
      );
    };
  },
  {
    loading: () => (
      <div className="fixed right-0 top-0 z-50 h-dvh w-full max-w-[90vw] border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 md:top-24 md:h-[calc(100dvh-6rem)] md:w-96 lg:top-16 lg:h-[calc(100dvh-4rem)]">
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export const ContentLoadingSkeleton = () => (
  <div className="min-h-screen bg-gray-100 p-6 dark:bg-gray-900">
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800"></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800"
          ></div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800"
          ></div>
        ))}
      </div>
    </div>
  </div>
);

export function checkTestMode(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const cookieStr = typeof document.cookie === 'string' ? document.cookie : '';
  const cookies = cookieStr.split(';').map((c) => c.trim());
  const hasTestMode = cookies.some((c) => c.startsWith('test_mode=enabled'));
  const hasTestToken = cookies.some((c) => c.startsWith('vercel_test_token='));

  if (hasTestMode || hasTestToken) {
    return true;
  }

  try {
    const testModeEnabled =
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('test_mode_enabled') === 'true';

    if (testModeEnabled) {
      return true;
    }
  } catch {}

  return false;
}
