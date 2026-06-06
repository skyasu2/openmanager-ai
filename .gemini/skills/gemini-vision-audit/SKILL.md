---
name: gemini-vision-audit
description: Analyze visually and review UI layout regressions using Gemini Vision capabilities when explicitly requested by the user.
version: v1.0.0
---

# Gemini Vision Audit Skill

> Common baseline: before editing this skill, review `docs/development/vibe-coding/skills.md` and `config/ai/skill-baselines.json`.

Gemini 전용 비주얼 감사 워크플로우를 가이드합니다.

## 개요
Gemini 모델의 멀티모달 비전 기능을 활용하여 UI 레이아웃, 디자인 시스템 준수 여부 및 시각적 회귀(Visual Regression)를 검출합니다.

## 실행 규칙 (Invariants)
1. 사용자가 명시적으로 비주얼 QA 또는 레이아웃 검증을 요구하거나, UI 테마/스타일 변경이 감지된 경우에만 수동으로 이 스킬을 활성화합니다.
2. 불필요하게 실시간 API 호출을 반복하여 Free Tier 할당량을 낭비하지 않도록, 필요한 최소한의 스크린샷 캡처만 수행합니다.
3. 캡처된 스크린샷과 피그마(Figma) 시안 혹은 정상 동작 스냅샷을 대조하여 깨진 마진, 색상 정합성 오류, 폰트 오버플로우 등을 분석합니다.

## 상세 워크플로우
1. 테스트 대상 페이지로 이동합니다 (예: `https://openmanager-ai.vercel.app` 또는 로컬 서버).
2. Playwright MCP 또는 DevTools MCP를 이용해 화면 스크린샷을 찍어 저장합니다.
   - 예: `.playwright-mcp/vision-audit-dashboard.png`
3. 캡처된 스크린샷을 Gemini Vision 입력으로 제공하여 다음 문항들을 평가하도록 합니다:
   - "이 화면에 잘려 보이거나 레이아웃이 어긋난 UI 카드가 있는가?"
   - "기본 정의된 디자인 시스템 규격(폰트, 컬러 팔레트 등)에 어긋나는 요소가 있는가?"
4. 검사 결과를 기록하여 `reports/qa` 하위의 Assess entry에 포함시킵니다.
