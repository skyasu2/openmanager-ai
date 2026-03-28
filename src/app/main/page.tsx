/**
 * 🔄 /main → / 리다이렉트
 *
 * 이전 /main 경로로 접근하는 사용자를 루트 랜딩 페이지로 안내
 * 하위 호환성 유지를 위한 리다이렉트
 *
 * @refactored 2024-12 - 메인 페이지를 루트(/)로 이동
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function MainPageRedirect() {
  redirect('/');
}
