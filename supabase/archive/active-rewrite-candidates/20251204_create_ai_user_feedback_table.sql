-- Migration: Create AI User Feedback Table
-- Description: 사용자 피드백을 저장하여 AI 학습에 활용
-- Date: 2025-12-04
-- Author: AI Assistant

-- 1. AI 사용자 피드백 테이블 생성
CREATE TABLE IF NOT EXISTS ai_user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id TEXT NOT NULL,
  feedback TEXT NOT NULL CHECK (feedback IN ('helpful', 'not_helpful', 'incorrect')),
  detailed_reason TEXT,
  additional_comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 메타데이터
  session_id TEXT,
  user_agent TEXT,
  page_url TEXT
);

-- 2. 인덱스 생성 (분석 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_ai_feedback_interaction
  ON ai_user_feedback(interaction_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created_at
  ON ai_user_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_type
  ON ai_user_feedback(feedback);

-- 3. RLS (Row Level Security) 정책
ALTER TABLE ai_user_feedback ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 피드백 삽입 가능 (익명 포함)
CREATE POLICY "Anyone can insert feedback"
  ON ai_user_feedback
  FOR INSERT
  TO public
  WITH CHECK (true);

-- 읽기는 인증된 사용자만 (분석용)
CREATE POLICY "Authenticated users can read feedback"
  ON ai_user_feedback
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. 피드백 통계 뷰 (분석용)
CREATE OR REPLACE VIEW ai_feedback_stats AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  feedback,
  COUNT(*) as count,
  COUNT(CASE WHEN detailed_reason IS NOT NULL THEN 1 END) as with_reason
FROM ai_user_feedback
GROUP BY DATE_TRUNC('day', created_at), feedback
ORDER BY date DESC;

-- 5. 코멘트
COMMENT ON TABLE ai_user_feedback IS 'AI 응답에 대한 사용자 피드백 저장 - 학습 개선에 활용';
COMMENT ON COLUMN ai_user_feedback.interaction_id IS '연관된 AI 상호작용 ID';
COMMENT ON COLUMN ai_user_feedback.feedback IS '피드백 유형: helpful, not_helpful, incorrect';
COMMENT ON COLUMN ai_user_feedback.detailed_reason IS '상세 피드백 사유 (선택)';
