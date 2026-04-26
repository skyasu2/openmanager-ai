# QA 2026-04-27 AI Sidebar Release Smoke

- recordedAt: 2026-04-26T15:40:26.829Z
- target: https://openmanager-ai.vercel.app
- release: v8.11.35
- deployedVersion: 8.11.35
- aiResponseMs: 5092
- checks:
  - PASS /api/version returned 8.11.35
  - PASS guest login reached dashboard
  - PASS AI sidebar opened on production dashboard
  - PASS RAG/Web/심층 분석 toggles rendered enabled badges
  - PASS representative AI query completed after clarification and returned operational response text
  - PASS fullscreen handoff reached /dashboard/ai-assistant
- consoleErrors: 0
- consoleWarnings: 0
- failedRequests: 3 (navigation/telemetry aborts; console errors 0)

## Sidebar Response Excerpt

```text
AI 어시스턴트

AI Chat으로 시스템 질의

AI Chat

AI 기반 대화형 인터페이스

전체 서버 현황 기준으로 현재 서버 상태를 한 문장으로 요약해줘.

12:40:25 AM

복사
📊 서버 현황 요약
• 전체 18대: 정상 17대, 경고 1대, 위험 0대, 오프라인 0대
• 평균 CPU: 31%, 메모리: 46%, 디스크: 38%


⚠️ 주의 서버
• db-mysql-dc1-primary: 디스크 83% (안정 추세 →)


📈 추세
• 전체 서버는 평균 대비 큰 변동 없이 안정적입니다.


💡 권고
• db-mysql-dc1-primary: 로그 적체, 백업 산출물, tmp 디렉터리 증가 경로를 우선 점검하세요.

12:40:25 AM

1871ms

Cloud Run AI
·
서버 실시간 데이터 분석
RAG 허용
심층 분석 요청됨
분석 근거

도구: 서버 메트릭 조회 · 모드: 심층 분석 · 기간: 최근 1시간

복사
다시 생성
RAG 허용
Web 허용
심층 분석
대화 2/20
서버 운영 중심
Enter로 전송, Shift+Enter로 줄바꿈

AI 기능

AI Chat
서버 질의, 트러블슈팅, 명령어 추천
자동장애 보고서
Reporter Agent 장애 분석 보고서 생성
이상감지/예측
Analyst Agent 이상탐지, 근본원인, 예측분석
전체 화면으로 보기
```

## Fullscreen Text Excerpt

```text
OpenManager AI
현재 세션
새 대화
진행 중인 대화
1개 질문
AI 기능
AI Chat
NLQ Agent
장애 보고서
Reporter Agent
이상감지/예측
Analyst Agent
AI Engine Active
v8.11.35
대시보드
AI Workspace
/
대화
2026.04.27 00:40:26
(월)
GU
게스트 사용자
게스트 로그인
AI Chat

AI 기반 대화형 인터페이스

전체 서버 현황 기준으로 현재 서버 상태를 한 문장으로 요약해줘.

오전 12:40:26

복사

📊 서버 현황 요약 • 전체 18대: 정상 17대, 경고 1대, 위험 0대, 오프라인 0대 • 평균

오전 12:40:26

복사
다시 생성
분석 근거

도구: 서버 메트릭 조회 · 모드: 심층 분석 · 기간: 최근 1시간

RAG 허용
Web 허용
심층 분석
대화 2/20
서버 운영 중심
Enter로 전송, Shift+Enter로 줄바꿈
System Context
PROVIDER ROUTING
Groq
(Primary text routing)
Configured
Cerebras
(Structured routing + secondary text fallback)
Configured
Mistral
(Last-resort text fallback)
Configured
Gemini
(Vision primary)
Configured

표시 역할은 현재 라우팅 정책 기준이며, 실제 요청별 선택은 쿼리 유형과 fallback 상태에 따라 달라집니다.

Updated: 오전 12:40:26

SYSTEM STATUS
AI Engine
Online
Environment
Production
QUICK COMMANDS

서버 상태 요약
- 전체 현황 파악

CPU 80% 이상 서버
- 자연어 쿼리

장애 보고서 생성
- 자동 리포트

AI 엔진 상태
확인 안 됨
상태 확인
```

## Console Messages

```json
{
  "errors": [],
  "warnings": [],
  "failedRequests": [
    {
      "url": "https://openmanager-ai.vercel.app/api/system",
      "failure": "net::ERR_ABORTED"
    },
    {
      "url": "https://openmanager-ai.vercel.app/api/system",
      "failure": "net::ERR_ABORTED"
    },
    {
      "url": "https://openmanager-ai.vercel.app/api/system",
      "failure": "net::ERR_ABORTED"
    }
  ]
}
```

Screenshot: reports/qa/evidence/qa-20260427-ai-sidebar-release-smoke.png
