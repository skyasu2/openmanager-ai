/**
 * Server Logs Tool (AI SDK Format)
 *
 * 서버 로그 조회 도구. PrecomputedSlot의 serverLogs에서
 * level/source 필터링 후 AI에게 반환.
 *
 * @version 1.0.0
 */

import { tool } from 'ai';
import { z } from 'zod';
import { getRecentHistory } from '../data/precomputed-state';
import type { GeneratedLog } from '../data/log-generator';

export const getServerLogs = tool({
  description: `서버의 최근 시스템 로그를 조회합니다.

## 사용 시나리오
- "서버 로그 보여줘" → 이 도구 (level="all")
- "에러 로그 분석해줘" → level="error"
- "nginx 로그 확인" → source="nginx"
- "최근 1시간 로그" → slotsBack=6

## 출력 형식
{ "success": true, "serverId": "...", "logs": [{ "level": "error", "source": "kernel", "message": "..." }], "summary": { "error": 2, "warn": 1, "info": 3 } }`,
  inputSchema: z.object({
    serverId: z.string().describe('조회할 서버 ID. 예: "web-nginx-dc1-01", "db-mysql-dc1-primary"'),
    level: z
      .enum(['error', 'warn', 'info', 'all'])
      .default('all')
      .describe('로그 레벨 필터. error=에러만, warn=경고만, info=정보만, all=전체'),
    source: z
      .string()
      .optional()
      .describe('로그 소스 필터. 예: "nginx", "mysql", "kernel", "redis", "docker"'),
    slotsBack: z
      .number()
      .default(3)
      .describe('조회할 슬롯 수 (1=현재 10분, 6=최근 1시간). 메트릭 변화가 있는 구간에서 더 다양한 로그 수집'),
  }),
  execute: async ({ serverId, level, source, slotsBack }) => {
    const history = getRecentHistory(Math.min(slotsBack, 12));

    if (history.length === 0) {
      return { success: false, error: '데이터를 찾을 수 없습니다.' };
    }

    // 여러 슬롯의 로그를 병합 (중복 메시지 제거)
    const seenMessages = new Set<string>();
    const allLogs: GeneratedLog[] = [];

    for (const slot of history) {
      const logs = slot.serverLogs?.[serverId];
      if (!logs) continue;

      for (const log of logs) {
        if (!seenMessages.has(log.message)) {
          seenMessages.add(log.message);
          allLogs.push(log);
        }
      }
    }

    if (allLogs.length === 0) {
      // 서버 존재 여부 확인
      const serverExists = history[0].servers.some((s) => s.id === serverId);
      if (!serverExists) {
        return { success: false, error: `서버 "${serverId}"를 찾을 수 없습니다.` };
      }
      return {
        success: true,
        serverId,
        logs: [],
        summary: { error: 0, warn: 0, info: 0 },
        message: '조회 기간 내 로그가 없습니다.',
      };
    }

    // 필터링
    let filtered = allLogs;
    if (level !== 'all') {
      filtered = filtered.filter((l) => l.level === level);
    }
    if (source) {
      const srcLower = source.toLowerCase();
      filtered = filtered.filter((l) => l.source.toLowerCase().includes(srcLower));
    }

    // 요약 통계
    const summary = {
      error: filtered.filter((l) => l.level === 'error').length,
      warn: filtered.filter((l) => l.level === 'warn').length,
      info: filtered.filter((l) => l.level === 'info').length,
    };

    return {
      success: true,
      serverId,
      timeRange: `최근 ${slotsBack * 10}분`,
      logs: filtered.slice(0, 20), // 최대 20개 (토큰 절약)
      summary,
    };
  },
});
