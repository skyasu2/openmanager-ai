import { describe, expect, it } from 'vitest';
import { createAssistantResponseView } from './assistant-response-view';

describe('createAssistantResponseView', () => {
  it('짧은 응답은 접지 않고 그대로 반환한다', () => {
    const text = 'CPU 사용률은 안정적입니다.';
    const view = createAssistantResponseView(text);

    expect(view.shouldCollapse).toBe(false);
    expect(view.summary).toBe(text);
    expect(view.details).toBeNull();
  });

  it('긴 다단락 응답은 첫 단락을 요약으로 분리한다', () => {
    const first = '핵심 요약: 현재 위험 서버 2대, 경고 서버 3대입니다.';
    const second = '원인 분석: API 서버에서 CPU 스파이크가 반복되었습니다.';
    const third =
      '권장 조치: 임계치 조정 및 오토스케일 정책을 즉시 점검하세요.';
    const longText = `${first}\n\n${second}\n\n${third}\n\n${'x'.repeat(700)}`;

    const view = createAssistantResponseView(longText);

    expect(view.shouldCollapse).toBe(true);
    expect(view.summary).toBe(first);
    expect(view.details).toContain(second);
    expect(view.details).toContain(third);
  });

  it('헤딩으로 시작하면 헤딩+첫 본문 단락을 요약으로 사용한다', () => {
    const text = `## 시스템 상태 요약

현재 전체 시스템은 경고 상태입니다.

### 원인

DB 연결 풀 고갈이 감지되었습니다.
${'y'.repeat(700)}`;

    const view = createAssistantResponseView(text);

    expect(view.shouldCollapse).toBe(true);
    expect(view.summary).toContain('## 시스템 상태 요약');
    expect(view.summary).toContain('현재 전체 시스템은 경고 상태입니다.');
    expect(view.details).toContain('### 원인');
  });

  it('단일 장문은 문장 단위로 요약/상세를 분리한다', () => {
    const text =
      '첫째, API 서버 지연이 증가했습니다. 둘째, 캐시 미스율이 상승했습니다. 셋째, DB 커넥션 재시도가 반복됩니다. 넷째, 트래픽 피크 구간이 확인됩니다.';

    const view = createAssistantResponseView(`${text} ${'z'.repeat(680)}`);

    expect(view.shouldCollapse).toBe(true);
    expect(view.summary).toContain('첫째, API 서버 지연이 증가했습니다.');
    expect(view.details).toBeTruthy();
  });
});
