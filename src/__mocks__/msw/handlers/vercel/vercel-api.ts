/**
 * Vercel Platform API Handlers
 *
 * Vercel 플랫폼 API를 모킹합니다.
 *
 * @endpoint https://api.vercel.com/v*
 * @see https://vercel.com/docs/rest-api
 */

import { HttpResponse, http } from 'msw';

const VERCEL_API_BASE_URL = 'https://api.vercel.com';

/**
 * Vercel API 핸들러
 */
export const vercelHandlers = [
  /**
   * Get Deployments - 배포 목록 조회
   *
   * @example GET /v6/deployments
   */
  http.get(`${VERCEL_API_BASE_URL}/v6/deployments`, ({ request }) => {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');

    console.log(`[MSW] Vercel Deployments Mocked: projectId=${projectId}`);

    return HttpResponse.json(
      {
        deployments: [
          {
            uid: 'mock-deployment-1',
            name: 'openmanager-ai',
            url: 'openmanager-ai-mock.vercel.app',
            created: Date.now(),
            state: 'READY',
            type: 'LAMBDAS',
            target: 'production',
            aliasAssigned: true,
          },
        ],
        pagination: {
          count: 1,
          next: null,
          prev: null,
        },
      },
      { status: 200 }
    );
  }),

  /**
   * Get Projects - 프로젝트 목록 조회
   *
   * @example GET /v9/projects
   */
  http.get(`${VERCEL_API_BASE_URL}/v9/projects`, () => {
    console.log('[MSW] Vercel Projects Mocked');

    return HttpResponse.json(
      {
        projects: [
          {
            id: 'mock-project-1',
            name: 'openmanager-ai',
            accountId: 'mock-account',
            framework: 'nextjs',
            devCommand: 'npm run dev',
            buildCommand: 'npm run build',
            installCommand: 'npm install',
            createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30일 전
            updatedAt: Date.now(),
          },
        ],
        pagination: {
          count: 1,
          next: null,
          prev: null,
        },
      },
      { status: 200 }
    );
  }),

  /**
   * Get Environment Variables - 환경 변수 조회
   *
   * @example GET /v9/projects/:projectId/env
   */
  http.get(
    `${VERCEL_API_BASE_URL}/v9/projects/:projectId/env`,
    ({ params }) => {
      const { projectId } = params;

      console.log(
        `[MSW] Vercel Env Variables Mocked: projectId=${String(projectId)}`
      );

      return HttpResponse.json(
        {
          envs: [
            {
              key: 'NEXT_PUBLIC_SUPABASE_URL',
              value: 'https://mock.supabase.co',
              type: 'encrypted',
              target: ['production', 'preview', 'development'],
              gitBranch: null,
              createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
              updatedAt: Date.now(),
              id: 'mock-env-1',
            },
          ],
          pagination: {
            count: 1,
            next: null,
            prev: null,
          },
        },
        { status: 200 }
      );
    }
  ),
];
