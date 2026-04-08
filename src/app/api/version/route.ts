import { NextResponse } from 'next/server';
import { version as PACKAGE_VERSION } from '../../../../package.json';

const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ||
  process.env.npm_package_version ||
  'unknown';
const BUILD_VERSION = PACKAGE_VERSION || APP_VERSION;

export async function GET() {
  return NextResponse.json({
    version: APP_VERSION,
    buildVersion: BUILD_VERSION,
    nextjs: process.env.NEXT_PUBLIC_NEXTJS_VERSION || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
}
