import { createHash, timingSafeEqual } from 'node:crypto';

function digestApiKey(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * Compare API keys via fixed-length digests so every validation reaches
 * timingSafeEqual regardless of the user-supplied key length.
 */
export function verifyApiKeyValue(apiKey: string | undefined, validKey: string | undefined): boolean {
  if (!apiKey || !validKey) {
    return false;
  }

  return timingSafeEqual(digestApiKey(apiKey), digestApiKey(validKey));
}
