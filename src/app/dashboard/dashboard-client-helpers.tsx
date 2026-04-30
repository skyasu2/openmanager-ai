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
      return (
        <>
          {isOpen && (
            <AISidebarV4.default
              onClose={onClose}
              isOpen={isOpen}
              {...otherProps}
            />
          )}
        </>
      );
    };
  },
  {
    loading: () => (
      <div className="fixed inset-0 z-50 h-dvh w-screen max-w-none border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 md:right-0 md:left-auto md:w-96 lg:w-[680px]">
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
