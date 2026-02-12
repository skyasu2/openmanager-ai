/**
 * 🔧 Client Providers
 *
 * OpenManager AI 클라이언트 프로바이더 통합 관리
 * Supabase Auth + TanStack Query 사용
 */

'use client';

import type { ReactNode } from 'react';
// 🚀 Vercel 호환 접근성 Provider 추가
import { AccessibilityProvider } from '@/context/AccessibilityProvider';
import QueryProvider from './QueryProvider';
import SupabaseAuthProvider from './SupabaseAuthProvider';

interface ClientProvidersProps {
  children: ReactNode;
}

/**
 * 클라이언트 사이드 Provider들을 관리하는 컴포넌트
 *
 * @description
 * 서버 컴포넌트인 layout.tsx에서 클라이언트 Provider들을 사용하기 위한 래퍼 컴포넌트입니다.
 * 모든 클라이언트 사이드 상태 관리 Provider들을 여기서 통합 관리합니다.
 *
 * Provider 계층 구조:
 * 1. AccessibilityProvider (WCAG 2.1 호환, SSR 안전)
 * 2. SupabaseAuthProvider (Supabase Auth 세션 관리)
 * 3. QueryProvider (TanStack Query)
 */
export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <AccessibilityProvider>
      <SupabaseAuthProvider>
        <QueryProvider>{children}</QueryProvider>
      </SupabaseAuthProvider>
    </AccessibilityProvider>
  );
}

export default ClientProviders;
