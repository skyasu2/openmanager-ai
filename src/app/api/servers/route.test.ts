import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const { mockUnifiedGet } = vi.hoisted(() => ({
  mockUnifiedGet: vi.fn(),
}));

vi.mock('../servers-unified/route', () => ({
  GET: mockUnifiedGet,
}));

import { GET } from './route';

describe('/api/servers legacy route contract', () => {
  it('legacy GET handler delegates to /api/servers-unified?action=list', async () => {
    mockUnifiedGet.mockResolvedValueOnce(
      Response.json({ success: true, data: [] })
    );

    const request = new NextRequest('http://localhost/api/servers');
    const response = await GET(request);
    const payload = await response.json();

    expect(mockUnifiedGet).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
    expect(payload).toEqual({ success: true, data: [] });
  });
});
