import { describe, expect, it } from 'vitest';
import {
  getSubstantiveJobResultContent,
  shouldFailCompletedJobResult,
} from './job-result-quality';

describe('job result quality', () => {
  it('rejects completed jobs with placeholder or title-only responses', () => {
    expect(shouldFailCompletedJobResult('completed', '완료')).toBe(true);
    expect(shouldFailCompletedJobResult('completed', '# 분석 결과')).toBe(true);
    expect(shouldFailCompletedJobResult('processing', '완료')).toBe(false);
  });

  it('accepts substantive completed job responses', () => {
    const content =
      '지난 24시간 기준 부하 최고 시간대는 오늘 14:30입니다. load1 최고 서버와 상위 서버 근거를 함께 제공합니다.';

    expect(getSubstantiveJobResultContent(content)).toBe(content);
    expect(shouldFailCompletedJobResult('completed', content)).toBe(false);
  });
});
