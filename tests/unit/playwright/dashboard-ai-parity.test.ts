import { describe, expect, it } from 'vitest';
import {
  doesAiTextMatchDashboardStatus,
  getNewConversationText,
  parseDashboardStatusSnapshot,
} from '../../e2e/helpers/dashboard-ai-parity';

describe('dashboard AI parity helpers', () => {
  it('extracts dashboard status counts from production-style text', () => {
    const snapshot = parseDashboardStatusSnapshot(
      '전체 18 Synthetic OTel snapshot · 16:00 KST 온라인 17 경고 0 위험 1 오프라인 0 상태 문제 발생'
    );

    expect(snapshot).toEqual({
      total: 18,
      online: 17,
      warning: 0,
      critical: 1,
      offline: 0,
    });
  });

  it('matches AI text that uses 정상 for dashboard online count', () => {
    expect(
      doesAiTextMatchDashboardStatus(
        '전체 18대: 정상 17대, 경고 0대, 위험 1대, 오프라인 0대',
        { total: 18, online: 17, warning: 0, critical: 1, offline: 0 }
      )
    ).toBe(true);
  });

  it('rejects previous-slot warning and critical count drift', () => {
    expect(
      doesAiTextMatchDashboardStatus(
        '전체 18대: 정상 17대, 경고 1대, 위험 0대, 오프라인 0대',
        { total: 18, online: 17, warning: 0, critical: 1, offline: 0 }
      )
    ).toBe(false);
  });

  it('does not treat a count prefix as an exact dashboard count', () => {
    expect(
      doesAiTextMatchDashboardStatus(
        '전체 180대: 정상 170대, 경고 0대, 위험 10대, 오프라인 0대',
        { total: 18, online: 17, warning: 0, critical: 1, offline: 0 }
      )
    ).toBe(false);
  });

  it('does not match 정상 inside 비정상 as the online count label', () => {
    expect(
      doesAiTextMatchDashboardStatus(
        '전체 18대: 비정상 17대, 경고 0대, 위험 1대, 오프라인 0대',
        { total: 18, online: 17, warning: 0, critical: 1, offline: 0 }
      )
    ).toBe(false);
  });

  it('isolates newly appended conversation text from restored history', () => {
    expect(
      getNewConversationText(
        'old question old answer',
        'old question old answer new question new answer'
      )
    ).toBe('new question new answer');
  });

  it('keeps full text when restored history is not a prefix of the conversation', () => {
    expect(
      getNewConversationText(
        'old question old answer',
        'new question repeats old question old answer inside the response'
      )
    ).toBe('new question repeats old question old answer inside the response');
  });
});
