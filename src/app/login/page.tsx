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

import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: 'Login',
  description: 'OpenManager AI 로그인',
};

// 🎯 로그인 페이지 - 서버 컴포넌트
export default function LoginPage() {
  return <LoginClient />;
}
