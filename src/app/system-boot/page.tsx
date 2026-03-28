/**
 * 🚀 System Boot Page - 서버 컴포넌트
 *
 * 정적 생성 완전 비활성화 (동적 렌더링만 사용)
 * 클라이언트 로직은 SystemBootClient 컴포넌트에서 처리
 *
 * // Enhanced System Consistency Verified: 2025-12-12
 */

// 서버 사이드 설정 - 서버 컴포넌트에서만 사용 가능
// MIGRATED: Removed export const dynamic = "force-dynamic" (now default)

import type { Metadata } from 'next';
import SystemBootClient from './SystemBootClient';

export const metadata: Metadata = {
  title: '시스템 시작 중',
  robots: { index: false, follow: false },
};

// 🎯 시스템 부팅 페이지 - 서버 컴포넌트
export default function SystemBootPage() {
  return <SystemBootClient />;
}
