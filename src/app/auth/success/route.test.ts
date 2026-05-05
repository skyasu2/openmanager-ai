/**
 * @vitest-environment node
 */

import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { GET } from './route';

function getLocationUrl(response: Response): URL {
  const location = response.headers.get('location');
  expect(location).toBeTruthy();
  return new URL(location as string);
}

describe('/auth/success GET', () => {
  it('redirects legacy success handoff requests to dashboard', () => {
    const response = GET(
      new NextRequest('https://openmanager.test/auth/success')
    );

    expect(response.status).toBe(307);
    expect(getLocationUrl(response).pathname).toBe('/dashboard');
  });

  it('keeps safe relative next path when provided', () => {
    const response = GET(
      new NextRequest(
        'https://openmanager.test/auth/success?next=/dashboard/servers'
      )
    );

    expect(getLocationUrl(response).pathname).toBe('/dashboard/servers');
  });

  it('rejects external redirect targets', () => {
    const response = GET(
      new NextRequest(
        'https://openmanager.test/auth/success?next=https://evil.example'
      )
    );

    expect(getLocationUrl(response).pathname).toBe('/dashboard');
  });
});
