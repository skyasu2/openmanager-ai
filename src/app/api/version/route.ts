import { NextResponse } from 'next/server';
import { version as PACKAGE_VERSION } from '../../../../package.json';

const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ||
  process.env.npm_package_version ||
  'unknown';
const BUILD_VERSION = PACKAGE_VERSION || APP_VERSION;
const COMMIT_SHA =
  process.env.APP_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.CI_COMMIT_SHA ||
  '';
const RELEASE_TAG =
  process.env.APP_RELEASE_TAG || process.env.CI_COMMIT_TAG || '';
const PIPELINE_URL =
  process.env.APP_PIPELINE_URL || process.env.CI_PIPELINE_URL || '';
const DEPLOYMENT_PROVIDER = process.env.APP_DEPLOYMENT_PROVIDER || 'vercel';

export async function GET() {
  return NextResponse.json({
    version: APP_VERSION,
    buildVersion: BUILD_VERSION,
    nextjs: process.env.NEXT_PUBLIC_NEXTJS_VERSION || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    commitSha: COMMIT_SHA,
    shortCommitSha: COMMIT_SHA ? COMMIT_SHA.slice(0, 10) : '',
    releaseTag: RELEASE_TAG,
    pipelineUrl: PIPELINE_URL,
    deploymentProvider: DEPLOYMENT_PROVIDER,
    timestamp: new Date().toISOString(),
  });
}
