'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logging';
import { useUnifiedAdminStore } from '@/stores/useUnifiedAdminStore';

type BootstrapServiceStatus = 'pending' | 'success' | 'degraded' | 'failed';

type SoftAIHealthResponse = {
  status?: string;
  error?: string;
  reasonCode?: string;
  recoverable?: boolean;
};

/**
 * 🚀 시스템 부트스트랩 컴포넌트
 *
 * ✅ 개선된 기능:
 * - 시스템이 실제로 시작된 상태일 때만 실행
 * - 사용자가 "시스템 시작" 버튼을 누르기 전에는 실행 안 함
 * - AI 백엔드 서버 자동 웜업
 * - Cloud Run AI 연결 확인
 * - 시스템 초기화 상태 관리
 *
 * ## v5.84.0: Google AI → Cloud Run Migration
 * - Removed Google AI status check (deprecated)
 * - Uses Cloud Run AI health endpoint (/api/health?service=ai)
 */
export function SystemBootstrap(): React.ReactNode {
  const { isSystemStarted } = useUnifiedAdminStore();

  // 🔒 부트스트랩 중복 실행 방지 (세션 당 1회만 실행)
  const hasBootstrappedRef = useRef(false);

  const [_bootstrapStatus, setBootstrapStatus] = useState({
    mcp: 'pending' as BootstrapServiceStatus,
    cloudRunAI: 'pending' as BootstrapServiceStatus,
    supabase: 'pending' as BootstrapServiceStatus,
    completed: false,
  });

  useEffect(() => {
    // 🚨 중요: 시스템이 시작되지 않은 상태에서는 부트스트랩 실행 안 함
    if (!isSystemStarted) {
      logger.info('💤 시스템 부트스트랩 대기 중 - 시스템 시작 후 실행됩니다');
      return;
    }

    // 🔒 이미 부트스트랩이 실행됐으면 재실행 방지
    if (hasBootstrappedRef.current) {
      return;
    }

    let isMounted = true;
    let bootstrapCompleted = false;
    let aiHealthTimeout: NodeJS.Timeout | null = null;
    const systemStatusController = new AbortController();
    const aiHealthController = new AbortController();
    const databaseController = new AbortController();

    const bootstrap = async () => {
      // 🔒 부트스트랩 시작 시 즉시 플래그 설정 (중복 실행 방지)
      hasBootstrappedRef.current = true;
      logger.info(
        '🚀 시스템 부트스트랩 시작... (시스템 활성화 상태, 1회만 실행)'
      );

      // 🎯 로컬 상태 추적 (async 업데이트 문제 해결)
      const localStatus = {
        mcp: 'pending' as BootstrapServiceStatus,
        cloudRunAI: 'pending' as BootstrapServiceStatus,
        supabase: 'pending' as BootstrapServiceStatus,
      };

      // 🎯 세션 캐시 확인 (브라우저 세션 동안 한 번만 체크)
      const sessionKey = 'system-bootstrap-cache';
      let cachedBootstrap: string | null = null;
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          cachedBootstrap = sessionStorage.getItem(sessionKey);
        }
      } catch {
        logger.warn('[SystemBootstrap] sessionStorage.getItem failed');
      }

      if (cachedBootstrap) {
        try {
          const cached = JSON.parse(cachedBootstrap);
          const cacheAge = Date.now() - cached.timestamp;

          // 세션 캐시가 30분 이내면 재사용
          if (cacheAge < 30 * 60 * 1000) {
            logger.info('📦 부트스트랩 캐시 사용 (세션 동안 유효)');
            if (isMounted) {
              setBootstrapStatus({ ...cached.status, completed: true });
            }
            bootstrapCompleted = true;
            return;
          }
        } catch {
          logger.warn('⚠️ 부트스트랩 캐시 파싱 실패, 새로 시작');
        }
      }

      // 1. 시스템 상태 확인
      try {
        logger.info('🔄 시스템 상태 확인...');
        const systemResponse = await fetch('/api/system', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: systemStatusController.signal,
        });

        if (isMounted) {
          if (systemResponse.ok) {
            const systemData = await systemResponse.json();
            logger.info('✅ 시스템 상태:', systemData.status || '정상');
            localStatus.mcp = 'success';
            setBootstrapStatus((prev) => ({ ...prev, mcp: 'success' }));
          } else {
            logger.warn('⚠️ 시스템 상태 확인 실패:', systemResponse.status);
            localStatus.mcp = 'failed';
            setBootstrapStatus((prev) => ({ ...prev, mcp: 'failed' }));
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          logger.debug('시스템 상태 확인 요청 취소');
          return;
        }
        logger.error('❌ 시스템 상태 확인 오류:', error);
        if (isMounted) {
          localStatus.mcp = 'failed';
          setBootstrapStatus((prev) => ({ ...prev, mcp: 'failed' }));
        }
      }

      // 2. Cloud Run AI 상태 확인 (한 번만, 3초 타임아웃)
      aiHealthTimeout = setTimeout(() => aiHealthController.abort(), 3000);
      try {
        logger.info('🤖 Cloud Run AI 상태 확인...');
        const aiHealthResponse = await fetch(
          '/api/health?service=ai&soft=true',
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: aiHealthController.signal,
          }
        );

        if (isMounted) {
          const aiData =
            (await aiHealthResponse.json()) as SoftAIHealthResponse;
          if (aiHealthResponse.ok && aiData.status === 'ok') {
            logger.info('✅ Cloud Run AI 상태 확인 완료:', '정상');
            localStatus.cloudRunAI = 'success';
            setBootstrapStatus((prev) => ({ ...prev, cloudRunAI: 'success' }));
          } else if (
            aiHealthResponse.ok &&
            aiData.status === 'degraded' &&
            aiData.recoverable === true
          ) {
            logger.info('⏳ Cloud Run AI 상태 확인:', '콜드스타트 대기');
            localStatus.cloudRunAI = 'degraded';
            setBootstrapStatus((prev) => ({
              ...prev,
              cloudRunAI: 'degraded',
            }));
          } else {
            logger.warn(
              '⚠️ Cloud Run AI 상태 확인 실패:',
              aiHealthResponse.status
            );
            localStatus.cloudRunAI = 'failed';
            setBootstrapStatus((prev) => ({ ...prev, cloudRunAI: 'failed' }));
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          logger.debug('Cloud Run AI 상태 확인 취소 또는 타임아웃');
          if (isMounted) {
            localStatus.cloudRunAI = 'degraded';
            setBootstrapStatus((prev) => ({
              ...prev,
              cloudRunAI: 'degraded',
            }));
          }
        } else {
          // Cloud Run 미활성은 예상된 상황 — debug 레벨로 격하 (콘솔 노이즈 제거)
          logger.debug('Cloud Run AI 상태 확인 스킵 (미활성 또는 타임아웃)');
          if (isMounted) {
            localStatus.cloudRunAI = 'failed';
            setBootstrapStatus((prev) => ({ ...prev, cloudRunAI: 'failed' }));
          }
        }
      } finally {
        if (aiHealthTimeout) {
          clearTimeout(aiHealthTimeout);
          aiHealthTimeout = null;
        }
      }

      // 3. Supabase 상태 확인 (한 번만)
      try {
        logger.info('🟢 Supabase 상태 확인...');
        const supabaseResponse = await fetch('/api/database', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: databaseController.signal,
        });

        if (isMounted) {
          if (supabaseResponse.ok) {
            const supabaseData = await supabaseResponse.json();
            logger.info(
              '✅ Supabase 상태 확인 완료:',
              supabaseData.primary?.status || '연결됨'
            );
            localStatus.supabase = 'success';
            setBootstrapStatus((prev) => ({ ...prev, supabase: 'success' }));
          } else {
            logger.warn('⚠️ Supabase 상태 확인 실패:', supabaseResponse.status);
            localStatus.supabase = 'failed';
            setBootstrapStatus((prev) => ({ ...prev, supabase: 'failed' }));
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          logger.debug('Supabase 상태 확인 요청 취소');
          return;
        }
        logger.error('❌ Supabase 상태 확인 오류:', error);
        if (isMounted) {
          localStatus.supabase = 'failed';
          setBootstrapStatus((prev) => ({ ...prev, supabase: 'failed' }));
        }
      }

      // 4. 부트스트랩 완료 및 캐시 저장
      if (isMounted) {
        const finalStatus = {
          mcp: localStatus.mcp,
          cloudRunAI: localStatus.cloudRunAI,
          supabase: localStatus.supabase,
          completed: true,
        };

        setBootstrapStatus(finalStatus);

        // 세션 캐시에 저장 (브라우저 세션 동안 유효)
        try {
          sessionStorage.setItem(
            sessionKey,
            JSON.stringify({
              status: finalStatus,
              timestamp: Date.now(),
            })
          );
          logger.info('💾 부트스트랩 상태 세션 캐시에 저장');
        } catch (error) {
          logger.warn('⚠️ 세션 캐시 저장 실패:', error);
        }

        logger.info('🎉 시스템 부트스트랩 완료 (세션 동안 재사용됨)');
        bootstrapCompleted = true;
      }
    };

    // 페이지 로드 후 5초 뒤에 부트스트랩 실행 (UI 렌더링 완료 후, 과도한 동시 요청 방지)
    const timer = setTimeout(() => {
      void bootstrap();
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (aiHealthTimeout) clearTimeout(aiHealthTimeout);
      systemStatusController.abort();
      aiHealthController.abort();
      databaseController.abort();
      if (!bootstrapCompleted) {
        hasBootstrappedRef.current = false;
      }
    };
    // 🔒 의존성 배열에서 bootstrapStatus 제거 - 상태 변경 시 재실행 방지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSystemStarted]);

  // 시스템 초기화 상태 표시 제거됨 (웹 알람 삭제에 따라)
  return null;
}
