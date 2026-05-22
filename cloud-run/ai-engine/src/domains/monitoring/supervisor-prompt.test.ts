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

  it('includes role-specific RCA hints for backup disk and Redis memory analysis', () => {
    const prompt = createMonitoringSystemPrompt();

    expect(prompt).toContain('서버 역할별 원인 가설');
    expect(prompt).toContain('db-mysql');
    expect(prompt).toContain('backup');
    expect(prompt).toContain('binlog');
    expect(prompt).toContain('dump');
    expect(prompt).toContain('incremental backup');
    expect(prompt).toContain('eviction policy');
    expect(prompt).toContain('maxmemory');
    expect(prompt).toContain('key TTL');
  });
});
