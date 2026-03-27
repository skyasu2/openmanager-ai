-- MTTA (Mean Time To Acknowledge) 지원을 위한 마이그레이션
-- Phase 2: 장애 보고서 SLA 개선

-- 1. acknowledged_at 컬럼 추가
ALTER TABLE incident_reports
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITH TIME ZONE;

-- 2. acknowledged_by 컬럼 추가
ALTER TABLE incident_reports
ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. system_summary 컬럼 추가 (이미 없는 경우)
ALTER TABLE incident_reports
ADD COLUMN IF NOT EXISTS system_summary JSONB DEFAULT NULL;

-- 4. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_incident_reports_acknowledged_at
ON incident_reports(acknowledged_at)
WHERE acknowledged_at IS NOT NULL;

-- 5. SLA 통계 뷰 업데이트 (MTTA 포함)
CREATE OR REPLACE VIEW incident_sla_statistics AS
SELECT
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as incident_count,

  -- MTTA: 평균 인지 시간 (분)
  AVG(
    CASE
      WHEN acknowledged_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 60
      ELSE NULL
    END
  ) as avg_mtta_minutes,

  -- MTTR: 평균 복구 시간 (분)
  AVG(
    CASE
      WHEN resolved_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60
      ELSE NULL
    END
  ) as avg_mttr_minutes,

  -- 해결률
  COUNT(CASE WHEN status = 'resolved' THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) * 100 as resolution_rate,

  -- 인지 응답률
  COUNT(CASE WHEN acknowledged_at IS NOT NULL THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) * 100 as acknowledgment_rate,

  -- 심각도별 카운트
  COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
  COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
  COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
  COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count

FROM incident_reports
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

-- 6. SLA 계산 함수 추가
CREATE OR REPLACE FUNCTION calculate_sla_metrics(
  time_window INTERVAL DEFAULT INTERVAL '30 days',
  target_uptime FLOAT DEFAULT 99.9
)
RETURNS TABLE (
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  total_incidents BIGINT,
  resolved_incidents BIGINT,
  acknowledged_incidents BIGINT,
  avg_mtta_minutes FLOAT,
  avg_mttr_minutes FLOAT,
  estimated_downtime_minutes FLOAT,
  actual_uptime FLOAT,
  sla_violation BOOLEAN,
  remaining_budget_minutes FLOAT
) AS $$
DECLARE
  total_minutes FLOAT;
  max_downtime FLOAT;
BEGIN
  -- 기간의 총 분 계산
  total_minutes := EXTRACT(EPOCH FROM time_window) / 60;
  max_downtime := total_minutes * (1 - target_uptime / 100);

  RETURN QUERY
  SELECT
    NOW() - time_window as period_start,
    NOW() as period_end,
    COUNT(*)::BIGINT as total_incidents,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END)::BIGINT as resolved_incidents,
    COUNT(CASE WHEN acknowledged_at IS NOT NULL THEN 1 END)::BIGINT as acknowledged_incidents,
    AVG(
      CASE
        WHEN acknowledged_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 60
      END
    )::FLOAT as avg_mtta_minutes,
    AVG(
      CASE
        WHEN resolved_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60
      END
    )::FLOAT as avg_mttr_minutes,
    SUM(
      CASE
        WHEN severity = 'critical' THEN 15
        WHEN severity = 'high' THEN 5
        ELSE 0
      END
    )::FLOAT as estimated_downtime_minutes,
    (
      (total_minutes - COALESCE(SUM(
        CASE
          WHEN severity = 'critical' THEN 15
          WHEN severity = 'high' THEN 5
          ELSE 0
        END
      ), 0)) / total_minutes * 100
    )::FLOAT as actual_uptime,
    (
      (total_minutes - COALESCE(SUM(
        CASE
          WHEN severity = 'critical' THEN 15
          WHEN severity = 'high' THEN 5
          ELSE 0
        END
      ), 0)) / total_minutes * 100 < target_uptime
    ) as sla_violation,
    GREATEST(0, max_downtime - COALESCE(SUM(
      CASE
        WHEN severity = 'critical' THEN 15
        WHEN severity = 'high' THEN 5
        ELSE 0
      END
    ), 0))::FLOAT as remaining_budget_minutes
  FROM incident_reports
  WHERE created_at > NOW() - time_window;
END;
$$ LANGUAGE plpgsql;

-- 7. 보고서 인지 처리 함수
CREATE OR REPLACE FUNCTION acknowledge_incident(
  incident_id UUID,
  user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE incident_reports
  SET
    acknowledged_at = NOW(),
    acknowledged_by = user_id,
    status = CASE WHEN status = 'open' THEN 'investigating' ELSE status END,
    updated_at = NOW()
  WHERE id = incident_id AND acknowledged_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 8. 권한 부여
GRANT SELECT ON incident_sla_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_sla_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION acknowledge_incident TO authenticated;

-- 9. 코멘트 추가
COMMENT ON COLUMN incident_reports.acknowledged_at IS '장애 인지 시간 (MTTA 계산용)';
COMMENT ON COLUMN incident_reports.acknowledged_by IS '장애를 인지한 사용자';
COMMENT ON VIEW incident_sla_statistics IS 'SLA 통계 뷰 (MTTA, MTTR, 해결률 포함)';
COMMENT ON FUNCTION calculate_sla_metrics IS 'SLA 메트릭 계산 함수';
COMMENT ON FUNCTION acknowledge_incident IS '장애 보고서 인지 처리 함수';
