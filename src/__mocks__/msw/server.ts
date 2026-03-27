/**
 * MSW Server Setup
 *
 * Node.js 환경 (Vitest, Jest 등)에서 MSW를 초기화합니다.
 * 테스트 실행 시 API 목 처리를 위해 사용됩니다.
 *
 * @see https://mswjs.io/docs/integrations/node
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
