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

  it.each([
    'text/html',
    'application/javascript',
    'application/x-sh',
    'image/svg+xml',
    'application/zip',
  ])('위험 MIME 타입 %s은 차단되어야 한다', (mimeType) => {
    const asImage = NORMALIZED_MESSAGES_SCHEMA.safeParse([
      { role: 'user', content: 'test', images: [{ data: 'AAA', mimeType }] },
    ]);
    const asFile = NORMALIZED_MESSAGES_SCHEMA.safeParse([
      { role: 'user', content: 'test', files: [{ data: 'AAA', mimeType }] },
    ]);
    expect(asImage.success).toBe(false);
    expect(asFile.success).toBe(false);
  });

  it('빈 배열은 최소 1개 메시지 필요로 실패해야 한다', () => {
    const result = NORMALIZED_MESSAGES_SCHEMA.safeParse([]);
    expect(result.success).toBe(false);
  });

  it('빈 content는 실패해야 한다', () => {
    const result = NORMALIZED_MESSAGES_SCHEMA.safeParse([
      { role: 'user', content: '' },
    ]);
    expect(result.success).toBe(false);
  });

  it('허용되지 않은 role은 실패해야 한다', () => {
    const result = NORMALIZED_MESSAGES_SCHEMA.safeParse([
      { role: 'hacker', content: 'test' },
    ]);
    expect(result.success).toBe(false);
  });
});
