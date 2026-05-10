import { describe, expect, it } from 'vitest';
import { createMonitoringSystemPrompt } from './supervisor-prompt';

describe('createMonitoringSystemPrompt', () => {
  it('keeps general coding policy aligned with the frontend guard', () => {
    const prompt = createMonitoringSystemPrompt();

    expect(prompt).toContain('일반 코딩');
    expect(prompt).toContain('일반 알고리즘');
    expect(prompt).toContain('운영 관련 코드');
    expect(prompt).toContain('운영 점검 스크립트');
  });
});
