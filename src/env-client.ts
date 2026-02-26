/**
 * 클라이언트 안전 환경변수 상수
 *
 * ⚠️ 'use client' 컴포넌트에서는 이 파일을 import하세요.
 * @/env는 Zod를 사용하므로 클라이언트 번들에서 크래시를 유발합니다.
 */

const nodeEnv = process.env.NODE_ENV || 'development';
const vercelEnv = process.env.VERCEL;
const nextPublicVercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
const vercelUrl = process.env.VERCEL_URL;
const hasVercelEnvFlag =
  vercelEnv === '1' ||
  vercelEnv === 'true' ||
  process.env.VERCEL_ENV === 'production' ||
  process.env.VERCEL_ENV === 'preview' ||
  !!nextPublicVercelEnv ||
  !!vercelUrl;

const isBrowser = typeof window !== 'undefined';
const isVercelHost = isBrowser
  ? /(?:^|\.)vercel\.app$/i.test(window.location.hostname)
  : false;

export const isDevelopment = nodeEnv === 'development';
export const isProduction = nodeEnv === 'production';
export const isTest = nodeEnv === 'test';
export const isVercel = hasVercelEnvFlag || isVercelHost;
export const isVercelProduction =
  process.env.VERCEL_ENV === 'production' ||
  nextPublicVercelEnv === 'production';
export const isDebugEnabled =
  isDevelopment || process.env.NEXT_PUBLIC_DEBUG === 'true';
