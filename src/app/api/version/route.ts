import { NextResponse } from 'next/server';

const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ||
  process.env.npm_package_version ||
  'unknown';

export async function GET() {
  return NextResponse.json({
    version: APP_VERSION,
    nextjs: process.env.NEXT_PUBLIC_NEXTJS_VERSION || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
}
