import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const incidentReportRoute = readFileSync(
  'src/app/api/ai/incident-report/route.ts',
  'utf8'
);
const endpointCatalog = readFileSync('docs/reference/api/endpoints.md', 'utf8');

describe('API endpoint catalog contract', () => {
  it('documents /api/ai/incident-report with the same route methods exported by code', () => {
    expect(incidentReportRoute).toMatch(/export const POST\b/);
    expect(incidentReportRoute).not.toMatch(/export const GET\b/);
    expect(incidentReportRoute).not.toMatch(/export const PATCH\b/);
    expect(endpointCatalog).toContain(
      '| `/api/ai/incident-report` | `POST` | `src/app/api/ai/incident-report/route.ts` |'
    );
    expect(endpointCatalog).not.toContain(
      '| `/api/ai/incident-report` | `GET, POST` |'
    );
  });
});
