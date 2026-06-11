-- HISTORICAL REFERENCE - DO NOT RUN.
-- Current schema source is supabase/migrations/**.
-- This legacy draft can be destructive or out of sync with the hosted schema.
-- Keep for migration history only; revive via a new guarded Supabase migration.

-- 🎯 Phase 4: AI Insight Center Database Migration
-- AI 인사이트 센터를 위한 데이터베이스 스키마
-- 생성일: 2025-08-05

-- ====================================
-- 1. 코드 품질 분석 이력
-- ====================================
CREATE TABLE IF NOT EXISTS code_quality_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id VARCHAR(100) NOT NULL,
    analysis_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Overall metrics
    overall_health INTEGER NOT NULL CHECK (overall_health >= 0 AND overall_health <= 100),
    complexity_rating VARCHAR(20) CHECK (complexity_rating IN ('good', 'moderate', 'poor')),
    test_coverage VARCHAR(20) CHECK (test_coverage IN ('adequate', 'insufficient')),
    technical_debt VARCHAR(20) CHECK (technical_debt IN ('manageable', 'significant')),
    
    -- Detailed metrics (JSONB for flexibility)
    complexity_metrics JSONB NOT NULL,
    coverage_metrics JSONB NOT NULL,
    debt_metrics JSONB NOT NULL,
    
    -- Analysis results
    recommendations JSONB,
    priority_actions TEXT[],
    debt_hotspots JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- 2. 성능 병목 분석 결과
-- ====================================
CREATE TABLE IF NOT EXISTS performance_bottlenecks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id VARCHAR(100) NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Bottleneck details
    component VARCHAR(200) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    impact TEXT NOT NULL,
    resolution TEXT NOT NULL,
    
    -- Metrics at detection time
    metrics_snapshot JSONB NOT NULL,
    
    -- Database performance
    slow_queries INTEGER DEFAULT 0,
    avg_query_time DECIMAL(10,2),
    connection_pool_utilization DECIMAL(5,2),
    
    -- Network performance
    network_latency_p99 DECIMAL(10,2),
    throughput_in DECIMAL(10,2),
    throughput_out DECIMAL(10,2),
    
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- 3. 아키텍처 개선 제안
-- ====================================
CREATE TABLE IF NOT EXISTS architecture_improvements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Assessment metadata
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current_architecture JSONB NOT NULL,
    
    -- Improvement details
    area VARCHAR(100) NOT NULL,
    current_state TEXT NOT NULL,
    recommended_state TEXT NOT NULL,
    benefits TEXT[],
    implementation_complexity VARCHAR(20) CHECK (implementation_complexity IN ('low', 'medium', 'high')),
    
    -- Scalability assessment
    scalability_score INTEGER CHECK (scalability_score >= 0 AND scalability_score <= 100),
    bottlenecks TEXT[],
    required_changes TEXT[],
    
    -- Tech stack recommendations
    tech_stack_updates JSONB,
    tech_stack_additions JSONB,
    tech_stack_replacements JSONB,
    
    implemented BOOLEAN DEFAULT FALSE,
    implemented_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- 4. 비용 최적화 분석
-- ====================================
CREATE TABLE IF NOT EXISTS cost_optimization_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Current costs
    monthly_cost DECIMAL(10,2) NOT NULL,
    server_count INTEGER NOT NULL,
    storage_gb DECIMAL(10,2) NOT NULL,
    bandwidth_gb DECIMAL(10,2) NOT NULL,
    
    -- Cost breakdown
    cost_breakdown JSONB NOT NULL,
    
    -- Optimization opportunities
    optimization_opportunities JSONB,
    potential_savings DECIMAL(10,2),
    savings_percentage DECIMAL(5,2),
    
    -- Resource rightsizing
    rightsizing_recommendations JSONB,
    
    -- Cloud migration analysis
    cloud_migration_roi JSONB,
    
    applied BOOLEAN DEFAULT FALSE,
    applied_at TIMESTAMP WITH TIME ZONE,
    actual_savings DECIMAL(10,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- 5. 보안 감사 보고서
-- ====================================
CREATE TABLE IF NOT EXISTS security_audit_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Vulnerability summary
    critical_issues INTEGER NOT NULL DEFAULT 0,
    high_issues INTEGER NOT NULL DEFAULT 0,
    medium_issues INTEGER NOT NULL DEFAULT 0,
    low_issues INTEGER NOT NULL DEFAULT 0,
    
    -- Risk assessment
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    overall_rating VARCHAR(20) CHECK (overall_rating IN ('Good', 'Fair', 'Poor')),
    
    -- Detailed findings
    priority_fixes JSONB,
    compliance_gaps TEXT[],
    
    -- Security recommendations
    hardening_recommendations JSONB,
    implemented_measures TEXT[],
    
    -- Remediation tracking
    remediated BOOLEAN DEFAULT FALSE,
    remediation_date TIMESTAMP WITH TIME ZONE,
    remediation_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- 6. 개선 로드맵
-- ====================================
CREATE TABLE IF NOT EXISTS improvement_roadmaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Roadmap metadata
    timeline_months INTEGER NOT NULL,
    total_investment DECIMAL(10,2),
    expected_roi TEXT,
    
    -- Phases (JSONB array)
    phases JSONB NOT NULL,
    
    -- Progress tracking
    current_phase INTEGER DEFAULT 1,
    phase_status VARCHAR(20) DEFAULT 'pending' CHECK (phase_status IN ('pending', 'in_progress', 'completed')),
    
    -- Metrics
    completion_percentage DECIMAL(5,2) DEFAULT 0,
    actual_investment DECIMAL(10,2) DEFAULT 0,
    measured_improvements JSONB,
    
    active BOOLEAN DEFAULT TRUE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- 7. 경영진 요약 보고서
-- ====================================
CREATE TABLE IF NOT EXISTS executive_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    period VARCHAR(20) NOT NULL, -- '7d', '30d', '90d'
    
    -- Key metrics
    system_health INTEGER CHECK (system_health >= 0 AND system_health <= 100),
    performance_score INTEGER CHECK (performance_score >= 0 AND performance_score <= 100),
    security_rating VARCHAR(5), -- 'A+', 'A', 'B+', 'B', 'C'
    cost_efficiency INTEGER CHECK (cost_efficiency >= 0 AND cost_efficiency <= 100),
    
    -- Summary data
    achievements TEXT[],
    concerns TEXT[],
    recommendations TEXT[],
    
    -- ROI analysis
    roi_analysis JSONB,
    
    -- Reference to detailed reports
    code_quality_ref UUID REFERENCES code_quality_analysis(id),
    performance_ref UUID REFERENCES performance_bottlenecks(id),
    architecture_ref UUID REFERENCES architecture_improvements(id),
    cost_ref UUID REFERENCES cost_optimization_analysis(id),
    security_ref UUID REFERENCES security_audit_reports(id),
    roadmap_ref UUID REFERENCES improvement_roadmaps(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- INDEXES
-- ====================================
CREATE INDEX idx_code_quality_server_date ON code_quality_analysis(server_id, analysis_date DESC);
CREATE INDEX idx_code_quality_health ON code_quality_analysis(overall_health);

CREATE INDEX idx_performance_server ON performance_bottlenecks(server_id);
CREATE INDEX idx_performance_severity ON performance_bottlenecks(severity);
CREATE INDEX idx_performance_resolved ON performance_bottlenecks(resolved);

CREATE INDEX idx_architecture_date ON architecture_improvements(assessment_date DESC);
CREATE INDEX idx_architecture_implemented ON architecture_improvements(implemented);

CREATE INDEX idx_cost_date ON cost_optimization_analysis(analysis_date DESC);
CREATE INDEX idx_cost_savings ON cost_optimization_analysis(potential_savings DESC);

CREATE INDEX idx_security_date ON security_audit_reports(audit_date DESC);
CREATE INDEX idx_security_score ON security_audit_reports(risk_score);

CREATE INDEX idx_roadmap_active ON improvement_roadmaps(active);
CREATE INDEX idx_roadmap_status ON improvement_roadmaps(phase_status);

CREATE INDEX idx_executive_date ON executive_summaries(report_date DESC);
CREATE INDEX idx_executive_period ON executive_summaries(period);

-- ====================================
-- TRIGGERS
-- ====================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_code_quality_updated_at
    BEFORE UPDATE ON code_quality_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roadmap_updated_at
    BEFORE UPDATE ON improvement_roadmaps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ====================================
-- FUNCTIONS
-- ====================================

-- Function to calculate overall system health score
CREATE OR REPLACE FUNCTION calculate_system_health_score()
RETURNS INTEGER AS $$
DECLARE
    health_score INTEGER;
BEGIN
    SELECT 
        ROUND(AVG(
            CASE 
                WHEN overall_health IS NOT NULL THEN overall_health
                ELSE 50
            END
        ))::INTEGER INTO health_score
    FROM code_quality_analysis
    WHERE analysis_date > CURRENT_TIMESTAMP - INTERVAL '7 days';
    
    RETURN COALESCE(health_score, 70);
END;
$$ LANGUAGE plpgsql;

-- Function to get latest bottlenecks
CREATE OR REPLACE FUNCTION get_latest_bottlenecks(p_limit INTEGER DEFAULT 5)
RETURNS TABLE(
    component VARCHAR,
    severity VARCHAR,
    impact TEXT,
    detected_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pb.component,
        pb.severity,
        pb.impact,
        pb.detected_at
    FROM performance_bottlenecks pb
    WHERE pb.resolved = FALSE
    ORDER BY 
        CASE pb.severity
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
        END,
        pb.detected_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- ROW LEVEL SECURITY (RLS)
-- ====================================

-- Enable RLS on all tables
ALTER TABLE code_quality_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_bottlenecks ENABLE ROW LEVEL SECURITY;
ALTER TABLE architecture_improvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_optimization_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE improvement_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies (allow authenticated users to read all, write with proper permissions)
CREATE POLICY "Allow authenticated read" ON code_quality_analysis
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated write" ON code_quality_analysis
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read" ON performance_bottlenecks
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated write" ON performance_bottlenecks
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read" ON architecture_improvements
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated write" ON architecture_improvements
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read" ON cost_optimization_analysis
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated write" ON cost_optimization_analysis
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read" ON security_audit_reports
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated write" ON security_audit_reports
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read" ON improvement_roadmaps
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated write" ON improvement_roadmaps
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update" ON improvement_roadmaps
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read" ON executive_summaries
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated write" ON executive_summaries
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ====================================
-- COMMENTS
-- ====================================
COMMENT ON TABLE code_quality_analysis IS 'AI 기반 코드 품질 분석 결과 저장';
COMMENT ON TABLE performance_bottlenecks IS '시스템 성능 병목 현상 분석 및 추적';
COMMENT ON TABLE architecture_improvements IS '시스템 아키텍처 개선 제안 및 구현 추적';
COMMENT ON TABLE cost_optimization_analysis IS '인프라 비용 최적화 분석 및 권장사항';
COMMENT ON TABLE security_audit_reports IS '보안 감사 결과 및 취약점 추적';
COMMENT ON TABLE improvement_roadmaps IS '단계별 개선 로드맵 및 진행 상황';
COMMENT ON TABLE executive_summaries IS '경영진 대시보드용 종합 요약 보고서';
