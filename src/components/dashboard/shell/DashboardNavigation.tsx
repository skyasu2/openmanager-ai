'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAISidebarStore } from '@/stores/useAISidebarStore';
import { dashboardNavItems } from './dashboard-navigation.config';

function DashboardNavLinks({
  pathname,
  compact = false,
  onNavigate,
}: {
  pathname: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const itemClassName = (active: boolean) =>
    cn(
      'group/nav-item relative flex h-11 w-full items-center rounded-lg text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2',
      compact
        ? 'justify-center gap-0 px-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-3'
        : 'gap-3 px-3',
      active
        ? 'bg-blue-50 font-semibold text-blue-700 ring-1 ring-blue-100'
        : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    );

  const renderItemContent = (
    item: (typeof dashboardNavItems)[number],
    active: boolean
  ) => {
    const Icon = item.icon;

    return (
      <>
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-2 bottom-2 left-0 w-0.5 rounded-r-full bg-blue-600 transition-opacity',
            active ? 'opacity-100' : 'opacity-0'
          )}
        />
        <Icon
          className={cn(
            'h-4 w-4 shrink-0 transition-colors',
            active
              ? 'text-blue-600'
              : 'text-slate-500 group-hover/nav-item:text-slate-700'
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            'min-w-0 whitespace-nowrap transition-[width,opacity] duration-150',
            compact &&
              'w-0 overflow-hidden opacity-0 group-hover/sidebar:w-auto group-hover/sidebar:opacity-100'
          )}
        >
          {item.label}
        </span>
      </>
    );
  };

  return (
    <nav aria-label="대시보드 내비게이션" className="space-y-1">
      {dashboardNavItems.map((item) => {
        const active = item.match(pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            onClick={onNavigate}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            className={itemClassName(active)}
          >
            {renderItemContent(item, active)}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardNavigation({
  isAIAssistantOpen = false,
}: {
  isAIAssistantOpen?: boolean;
}) {
  const pathname = usePathname() || '/dashboard';
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const didOpenMobileDrawerRef = useRef(false);
  const isSidebarStoreOpen = useAISidebarStore((state) => state.isOpen);
  const isCompact = isAIAssistantOpen || isSidebarStoreOpen;

  // biome-ignore lint/correctness/useExhaustiveDependencies: close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      if (didOpenMobileDrawerRef.current) {
        menuButtonRef.current?.focus();
        didOpenMobileDrawerRef.current = false;
      }
      return undefined;
    }

    didOpenMobileDrawerRef.current = true;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const drawer = drawerRef.current;
      if (!drawer) {
        return;
      }

      const focusableElements = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled'));

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (!firstElement || !lastElement) {
        return;
      }

      if (!drawer.contains(document.activeElement)) {
        event.preventDefault();
        firstElement.focus();
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileOpen]);

  return (
    <>
      <aside
        className={cn(
          'group/sidebar hidden h-dvh shrink-0 overflow-x-hidden overflow-y-auto border-r border-slate-200 bg-white px-3 py-4 shadow-xs transition-[width] duration-200 lg:block',
          isCompact ? 'w-16 hover:w-28' : 'w-28'
        )}
      >
        <DashboardNavLinks pathname={pathname} compact={isCompact} />
      </aside>

      {!isCompact && (
        <div className="fixed top-3 left-3 z-50 lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="대시보드 메뉴 열기"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-md"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="대시보드 메뉴 배경 닫기"
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setMobileOpen(false)}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="대시보드 메뉴"
            className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white p-4 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">OpenManager</p>
                <p className="text-xs text-slate-500">대시보드</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="대시보드 메뉴 닫기"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <DashboardNavLinks
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
