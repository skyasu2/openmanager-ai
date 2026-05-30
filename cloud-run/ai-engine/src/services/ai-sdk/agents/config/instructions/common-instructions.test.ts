import { describe, expect, it } from 'vitest';

import {
  BASE_AGENT_INSTRUCTIONS,
  MARKDOWN_FORMAT_INSTRUCTIONS,
} from './common-instructions';

describe('BASE_AGENT_INSTRUCTIONS', () => {
  it('keeps technical units in English notation', () => {
    expect(BASE_AGENT_INSTRUCTIONS).toContain('기술 단위');
    expect(BASE_AGENT_INSTRUCTIONS).toContain('us/microseconds');
    expect(BASE_AGENT_INSTRUCTIONS).toContain('MiB');
  });

  it('keeps the markdown formatting block out of BASE to protect NLQ prompt budget', () => {
    expect(BASE_AGENT_INSTRUCTIONS).not.toContain('마크다운 출력 형식');
  });
});

describe('MARKDOWN_FORMAT_INSTRUCTIONS', () => {
  it('includes CommonMark code-fence / bold / hr / heading rules', () => {
    expect(MARKDOWN_FORMAT_INSTRUCTIONS).toContain('마크다운 출력 형식');
    expect(MARKDOWN_FORMAT_INSTRUCTIONS).toContain('닫기'); // 코드펜스 닫기
    expect(MARKDOWN_FORMAT_INSTRUCTIONS).toContain('인라인 코드');
    expect(MARKDOWN_FORMAT_INSTRUCTIONS).toContain('빈 강조');
    expect(MARKDOWN_FORMAT_INSTRUCTIONS).toContain('단독 줄');
  });
});
