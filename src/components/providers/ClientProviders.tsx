/**
 * 🔧 Client Providers
 *
 * OpenManager AI 클라이언트 프로바이더 통합 관리
 * Supabase Auth + TanStack Query 사용
 */

'use client';

import type { ReactNode } from 'react';
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
 * 1. SupabaseAuthProvider (Supabase Auth 세션 관리)
 * 2. QueryProvider (TanStack Query)
 */
export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <SupabaseAuthProvider>
      <QueryProvider>{children}</QueryProvider>
    </SupabaseAuthProvider>
  );
}
