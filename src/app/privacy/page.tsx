/**
 * 📜 Privacy Policy Page
 * 포트폴리오 프로젝트용 최소 개인정보 처리방침
 */

import Link from 'next/link';

export const metadata = {
  title: '개인정보 처리방침 | OpenManager AI',
  description: 'OpenManager AI 개인정보 처리방침',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/login"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            ← 로그인으로 돌아가기
          </Link>
        </div>

        {/* Content */}
        <article className="prose prose-invert prose-sm max-w-none">
          <h1 className="text-2xl font-bold mb-6">개인정보 처리방침</h1>

          <p className="text-white/70 text-sm mb-8">최종 수정일: 2026년 1월</p>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-white/90">
              1. 수집하는 정보
            </h2>
            <ul className="list-disc list-inside text-white/70 space-y-1">
              <li>
                <strong>OAuth 로그인 시:</strong> 이름, 이메일, 프로필 이미지
                (GitHub/Google 제공)
              </li>
              <li>
                <strong>게스트 모드:</strong> 임시 세션 ID만 생성 (개인정보
                없음)
              </li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-white/90">
              2. 정보 사용 목적
            </h2>
            <ul className="list-disc list-inside text-white/70 space-y-1">
              <li>로그인 상태 유지 (세션 관리)</li>
              <li>서비스 이용 기록 (데모 목적)</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-white/90">
              3. 정보 보관
            </h2>
            <ul className="list-disc list-inside text-white/70 space-y-1">
              <li>세션 종료 시 자동 삭제</li>
              <li>서버에 영구 저장하지 않음</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-white/90">
              4. 제3자 제공
            </h2>
            <p className="text-white/70">
              수집된 정보는 제3자에게 제공하지 않습니다.
            </p>
          </section>
        </article>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-white/10 text-center">
          <p className="text-xs text-white/40">
            OpenManager AI v{process.env.NEXT_PUBLIC_APP_VERSION || '7.0.1'}
          </p>
        </div>
      </div>
    </div>
  );
}
