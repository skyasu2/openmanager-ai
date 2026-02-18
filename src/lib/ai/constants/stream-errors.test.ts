import { describe, expect, it } from 'vitest';
import {
  extractStreamError,
  isColdStartRelatedError,
  isModelConfigRelatedError,
} from './stream-errors';

describe('stream-errors', () => {
  describe('extractStreamError', () => {
    it('스트림 에러 마커에서 에러 메시지를 추출한다', () => {
      const result = extractStreamError('\n\n⚠️ 오류: Stream error');
      expect(result).toBe('Stream error');
    });

    it('에러 마커가 없으면 null을 반환한다', () => {
      const result = extractStreamError('정상 응답');
      expect(result).toBeNull();
    });
  });

  describe('isColdStartRelatedError', () => {
    it('timeout 계열 에러를 cold start 관련으로 판정한다', () => {
      expect(isColdStartRelatedError('Request timeout after 30s')).toBe(true);
    });
  });

  describe('isModelConfigRelatedError', () => {
    it('모델 권한/존재 오류를 감지한다', () => {
      const error =
        'Error: Model llama-3.3-70b does not exist or you do not have access to it.';
      expect(isModelConfigRelatedError(error)).toBe(true);
    });

    it('일반 네트워크 오류는 모델 설정 오류로 판정하지 않는다', () => {
      expect(isModelConfigRelatedError('fetch failed: ECONNRESET')).toBe(false);
    });
  });
});
