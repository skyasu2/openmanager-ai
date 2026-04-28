/**
 * 🔐 Login Page - 서버 컴포넌트
 *
 * 정적 생성 완전 비활성화 (동적 렌더링만 사용)
 * 클라이언트 로직은 LoginClient 컴포넌트에서 처리
 *
 * // Enhanced System Consistency Verified: 2025-12-12
 */

import type { Metadata } from 'next';
import '../landing-effects.css';

// 서버 사이드 설정 - 서버 컴포넌트에서만 사용 가능
// MIGRATED: Removed export const dynamic = "force-dynamic" (now default)

import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: 'Login',
  description: 'OpenManager AI 로그인',
};

// 🎯 로그인 페이지 - 서버 컴포넌트
export default function LoginPage() {
  // 서버 컴포넌트에서 필요한 인증 체크나 설정을 수행할 수 있습니다
  // 현재는 클라이언트 컴포넌트를 렌더링만 합니다

  return <LoginClient />;
}
