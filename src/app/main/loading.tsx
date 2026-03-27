/**
 * Main Page Loading Component
 *
 * 메인 페이지 로딩 시 표시되는 스켈레톤 UI
 * Next.js App Router의 Streaming SSR을 위한 로딩 컴포넌트
 */

import MainPageSkeleton from '@/components/home/MainPageSkeleton';

export default function MainLoading() {
  return <MainPageSkeleton />;
}
