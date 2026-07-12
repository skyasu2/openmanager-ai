import { createAuthLogoutResponse } from '../guest-login/response-utils';

export function POST() {
  return createAuthLogoutResponse({
    secureCookie: process.env.NODE_ENV === 'production',
  });
}
