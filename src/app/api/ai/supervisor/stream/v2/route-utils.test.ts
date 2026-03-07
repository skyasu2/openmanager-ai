import { describe, expect, it } from 'vitest';
import { NORMALIZED_MESSAGES_SCHEMA } from './route-utils';

describe('NORMALIZED_MESSAGES_SCHEMA', () => {
  it('허용된 normalized image/file mimeType은 통과해야 한다', () => {
    const result = NORMALIZED_MESSAGES_SCHEMA.safeParse([
      {
        role: 'user',
        content: '서버 상태 확인',
        images: [
          {
            data: 'data:image/png;base64,AAA',
            mimeType: 'image/png',
          },
        ],
        files: [
          {
            data: 'data:application/pdf;base64,BBB',
            mimeType: 'application/pdf',
          },
        ],
      },
    ]);

    expect(result.success).toBe(true);
  });

  it('허용되지 않은 normalized file mimeType은 실패해야 한다', () => {
    const result = NORMALIZED_MESSAGES_SCHEMA.safeParse([
      {
        role: 'user',
        content: '서버 상태 확인',
        files: [
          {
            data: 'ZmFrZQ==',
            mimeType: 'application/x-msdownload',
          },
        ],
      },
    ]);

    expect(result.success).toBe(false);
  });
});
