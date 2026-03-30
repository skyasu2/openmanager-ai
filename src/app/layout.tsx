import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_KR } from 'next/font/google';
import type { ReactNode } from 'react';
import { ClientProviders } from '@/components/providers/ClientProviders';
import './globals.css';
import { EmergencyBanner } from '@/components/emergency/EmergencyBanner';
import { WebVitalsReporter } from '@/components/providers/WebVitalsReporter';
import { SystemBootstrap } from '@/components/system/SystemBootstrap';
import { Toaster } from '@/components/ui/toaster';
import { getSiteUrl } from '@/lib/site-url';

// Vercel Analytics & Speed Insights (무료 티어 최적화 - 비활성화)
// import { SpeedInsights } from '@vercel/speed-insights/next';
// import { Analytics } from '@vercel/analytics/react';

// 🔤 Font Configuration: Inter (영문) + Noto Sans KR (한글)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans-kr',
  display: 'swap',
});

// 🌐 SEO Configuration
const SITE_URL = getSiteUrl();
const SITE_NAME = 'OpenManager AI';

export const metadata: Metadata = {
  // 📌 기본 메타데이터
  title: {
    default: 'OpenManager AI - AI Native Server Monitoring',
    template: '%s | OpenManager AI',
  },
  description:
    'Next.js 16 + React 19 + Vercel AI SDK 기반 AI Native 서버 모니터링 플랫폼. 3개 AI 프로바이더와 5-Agent 시스템으로 실시간 장애 분석.',
  keywords: [
    'AI 서버 모니터링',
    'Next.js 16',
    'React 19',
    'Vercel AI SDK',
    'Multi-Agent AI',
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
    title: 'OpenManager AI - AI Native Server Monitoring',
    description:
      'Next.js 16 + React 19 기반 AI Native 서버 모니터링. 3개 AI 프로바이더 + 5-Agent 멀티 에이전트 시스템.',
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
    title: 'OpenManager AI - AI Native Server Monitoring',
    description: 'Next.js 16 + React 19 기반 AI Native 서버 모니터링 플랫폼',
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
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${notoSansKR.variable} font-sans antialiased`}
      >
        <EmergencyBanner />
        <ClientProviders>
          <SystemBootstrap />
          <Toaster />
          {children}
        </ClientProviders>
        <WebVitalsReporter />
        {/* Vercel Analytics 비활성화 - 무료 티어 최적화 (6개 404 에러 제거) */}
        {/* <SpeedInsights key="speed-insights" /> */}
        {/* <Analytics key="analytics" /> */}
      </body>
    </html>
  );
}
