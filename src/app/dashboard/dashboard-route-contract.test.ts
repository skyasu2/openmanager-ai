/**
 * @vitest-environment node
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getRegisteredServerIds } from '@/config/server-registry';

const dashboardRouteFiles = [
  'src/app/dashboard/servers/page.tsx',
  'src/app/dashboard/servers/[serverId]/page.tsx',
  'src/app/dashboard/alerts/page.tsx',
  'src/app/dashboard/logs/page.tsx',
  'src/app/dashboard/topology/page.tsx',
];

describe('dashboard app route contract', () => {
  it.each(dashboardRouteFiles)('defines %s', (routeFile) => {
    expect(existsSync(join(process.cwd(), routeFile))).toBe(true);
  });

  it('keeps server detail static params non-empty for cache components', () => {
    expect(getRegisteredServerIds()).toContain('api-was-dc1-01');
    expect(getRegisteredServerIds()).toContain('web-nginx-dc1-01');
  });
});
