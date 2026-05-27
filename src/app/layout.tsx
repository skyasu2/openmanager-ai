import type { Metadata, Viewport } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import type { ReactNode } from 'react';
import { RootClientRuntime } from '@/app/RootClientRuntime';
import { shouldEnableVercelWebAnalytics } from '@/app/root-client-runtime-flags';
import { ClientProviders } from '@/components/providers/ClientProviders';
import './globals.css';
import './global-effects.css';
import { Analytics } from '@vercel/analytics/react';

import { SpeedInsights } from '@vercel/speed-insights/next';
import { getSiteUrl } from '@/lib/site-url';

// 🌐 SEO Configuration
const SITE_URL = getSiteUrl();
const SITE_NAME = 'OpenManager AI';

// next/font: 빌드 시 self-host -> 런타임 외부 요청 없음.
const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-noto-sans-kr',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  // 📌 기본 메타데이터
  title: {
    default: 'OpenManager AI - Operational Decision Support Assistant',
    template: '%s | OpenManager AI',
  },
  description:
    'Next.js 16 + React 19 + Vercel AI SDK 기반 운영 의사결정 AI 어시스턴트. deterministic fact layer와 tool-calling LLM으로 서버 상태를 분석합니다.',
  keywords: [
    'AI 서버 모니터링',
    'Operational Decision Support AI',
    'Next.js 16',
    'React 19',
    'Vercel AI SDK',
    'Tool-calling AI',
    'Server Monitoring',
    'OpenManager',
    '서버 관리',
    'DevOps',
    'Infrastructure Monitoring',
  ],
  authors: [{ name: 'OpenManager Team' }],
  creator: 'OpenManager AI',
  publisher: 'OpenManager',

  // 🔗 Canonical & Base URL
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/',
    languages: {
      'ko-KR': '/ko',
      'en-US': '/en',
    },
  },

  // 🖼️ Icons
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/icon-192.png',
  },

  // 📱 OpenGraph (Facebook, LinkedIn, Discord)
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'OpenManager AI - Operational Decision Support Assistant',
    description:
      'Next.js 16 + React 19 기반 운영 의사결정 AI 어시스턴트. deterministic fact layer + tool-calling LLM 기반 서버 분석.',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'OpenManager AI - AI Server Monitoring Platform',
      },
    ],
  },

  // 🐦 Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'OpenManager AI - Operational Decision Support Assistant',
    description: 'Next.js 16 + React 19 기반 운영 의사결정 AI 어시스턴트',
    images: ['/api/og'],
    creator: '@openmanager',
  },

  // 🤖 Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // 📊 Verification (필요시 추가)
  // verification: {
  //   google: 'google-site-verification-code',
  //   yandex: 'yandex-verification-code',
  // },

  // 🎨 Theme & Viewport
  manifest: '/manifest.json',
  category: 'technology',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning className={notoSansKR.variable}>
      <body className="font-sans antialiased">
        <ClientProviders>
          {children}
          <RootClientRuntime />
        </ClientProviders>
        <SpeedInsights />
        {shouldEnableVercelWebAnalytics() && <Analytics />}
      </body>
    </html>
  );
}
