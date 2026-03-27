/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import {
  rulesLoader,
  getThreshold,
  isWarning,
  isCritical,
  getStatus,
  getServerStatus,
  getActiveAlertRules,
  getSummaryForAI,
  getAllThresholds,
  getRules,
} from './loader';

// system-rules.json 에서 읽히는 실제 값
// cpu: warning=80, critical=90
// memory: warning=80, critical=90
// disk: warning=80, critical=90
// network: warning=70, critical=85
// responseTime: warning=2000, critical=5000

describe('RulesLoader', () => {
  describe('Singleton', () => {
    it('편의 export가 싱글톤 인스턴스와 동일해야 한다', () => {
      // rulesLoader는 RulesLoader.getInstance()의 결과
      expect(rulesLoader).toBeDefined();
      expect(typeof rulesLoader.getThreshold).toBe('function');
      expect(typeof rulesLoader.isWarning).toBe('function');
    });
  });

  describe('getThreshold', () => {
    it('cpu 임계값이 system-rules.json과 일치해야 한다', () => {
      const t = getThreshold('cpu');
      expect(t.warning).toBe(80);
      expect(t.critical).toBe(90);
    });

    it('memory 임계값이 system-rules.json과 일치해야 한다', () => {
      const t = getThreshold('memory');
      expect(t.warning).toBe(80);
      expect(t.critical).toBe(90);
    });

    it('disk 임계값이 system-rules.json과 일치해야 한다', () => {
      const t = getThreshold('disk');
      expect(t.warning).toBe(80);
      expect(t.critical).toBe(90);
    });

    it('network 임계값이 system-rules.json과 일치해야 한다', () => {
      const t = getThreshold('network');
      expect(t.warning).toBe(70);
      expect(t.critical).toBe(85);
    });

    it('responseTime 임계값이 system-rules.json과 일치해야 한다', () => {
      const t = getThreshold('responseTime');
      expect(t.warning).toBe(2000);
      expect(t.critical).toBe(5000);
    });
  });

  describe('isWarning (경계값 테스트)', () => {
    // cpu: warning=80, critical=90 → [80, 90) 범위가 warning
    it('cpu 79 → false (warning 미만)', () => {
      expect(isWarning('cpu', 79)).toBe(false);
    });

    it('cpu 80 → true (warning 경계 포함)', () => {
      expect(isWarning('cpu', 80)).toBe(true);
    });

    it('cpu 89 → true (critical 미만)', () => {
      expect(isWarning('cpu', 89)).toBe(true);
    });

    it('cpu 90 → false (critical 이상이므로 warning이 아님)', () => {
      expect(isWarning('cpu', 90)).toBe(false);
    });

    // network: warning=70, critical=85 → [70, 85) 범위가 warning
    it('network 69 → false (warning 미만)', () => {
      expect(isWarning('network', 69)).toBe(false);
    });

    it('network 70 → true (warning 경계 포함)', () => {
      expect(isWarning('network', 70)).toBe(true);
    });

    it('network 84 → true (critical 미만)', () => {
      expect(isWarning('network', 84)).toBe(true);
    });

    it('network 85 → false (critical 이상이므로 warning이 아님)', () => {
      expect(isWarning('network', 85)).toBe(false);
    });
  });

  describe('isCritical (경계값 테스트)', () => {
    it('cpu 89 → false (critical 미만)', () => {
      expect(isCritical('cpu', 89)).toBe(false);
    });

    it('cpu 90 → true (critical 경계 포함)', () => {
      expect(isCritical('cpu', 90)).toBe(true);
    });

    it('network 84 → false (critical 미만)', () => {
      expect(isCritical('network', 84)).toBe(false);
    });

    it('network 85 → true (critical 경계 포함)', () => {
      expect(isCritical('network', 85)).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('cpu 50 → normal', () => {
      expect(getStatus('cpu', 50)).toBe('normal');
    });

    it('cpu 85 → warning', () => {
      expect(getStatus('cpu', 85)).toBe('warning');
    });

    it('cpu 95 → critical', () => {
      expect(getStatus('cpu', 95)).toBe('critical');
    });
  });

  describe('getServerStatus', () => {
    it('P1: CPU critical + Memory critical → critical', () => {
      expect(getServerStatus({ cpu: 90, memory: 90 })).toBe('critical');
    });

    it('P2: ANY metric critical → critical (CPU만 critical)', () => {
      expect(getServerStatus({ cpu: 90, memory: 50 })).toBe('critical');
    });

    it('P3: 2+ metrics warning → warning', () => {
      expect(getServerStatus({ cpu: 80, memory: 80 })).toBe('warning');
    });

    it('P4: 단일 metric warning → warning', () => {
      expect(getServerStatus({ cpu: 80 })).toBe('warning');
    });

    it('P99: 모든 메트릭 정상 → online', () => {
      expect(getServerStatus({ cpu: 50, memory: 60 })).toBe('online');
    });

    it('빈 객체 → online (메트릭 없음)', () => {
      expect(getServerStatus({})).toBe('online');
    });
  });

  describe('getActiveAlertRules', () => {
    it('enabled된 규칙만 반환해야 한다', () => {
      const rules = getActiveAlertRules();
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
      rules.forEach((rule) => {
        expect(rule.enabled).toBe(true);
      });
    });
  });

  describe('getSummaryForAI', () => {
    it('마크다운 테이블 포맷 문자열을 반환해야 한다', () => {
      const summary = getSummaryForAI();
      expect(typeof summary).toBe('string');
      expect(summary).toContain('CPU');
      expect(summary).toContain('Memory');
      expect(summary).toContain('Disk');
      expect(summary).toContain('Network');
      expect(summary).toContain('Response Time');
      // 테이블 구분자 존재
      expect(summary).toContain('|');
    });
  });

  describe('getAllThresholds', () => {
    it('5개 메트릭 키를 모두 포함해야 한다', () => {
      const thresholds = getAllThresholds();
      expect(thresholds).toHaveProperty('cpu');
      expect(thresholds).toHaveProperty('memory');
      expect(thresholds).toHaveProperty('disk');
      expect(thresholds).toHaveProperty('network');
      expect(thresholds).toHaveProperty('responseTime');
    });
  });

  describe('getRules', () => {
    it('전체 규칙 객체를 반환해야 한다', () => {
      const rules = getRules();
      expect(rules).toHaveProperty('version');
      expect(rules).toHaveProperty('thresholds');
      expect(rules).toHaveProperty('alertRules');
      expect(rules).toHaveProperty('metadata');
    });
  });
});
