import { describe, expect, it } from 'vitest';
import { VISION_INSTRUCTIONS } from './vision';

describe('VISION_INSTRUCTIONS', () => {
  it('keeps OpenManager current values and forecast deltas separated', () => {
    expect(VISION_INSTRUCTIONS).toContain('OpenManager 카드 판독 규칙');
    expect(VISION_INSTRUCTIONS).toContain('현재 상태');
    expect(VISION_INSTRUCTIONS).toContain('1시간 후 예측');
    expect(VISION_INSTRUCTIONS).toContain('판독 불확실');
  });

  it('does not force unrelated or unreadable images into monitoring analysis', () => {
    expect(VISION_INSTRUCTIONS).toContain('분석 범위와 거절 기준');
    expect(VISION_INSTRUCTIONS).toContain('억지로 운영 장애로 해석하지 않습니다');
    expect(VISION_INSTRUCTIONS).toContain(
      '첨부 이미지만으로는 OpenManager 운영 분석을 할 수 없습니다'
    );
    expect(VISION_INSTRUCTIONS).toContain('관련 정보 없음');
  });
});
