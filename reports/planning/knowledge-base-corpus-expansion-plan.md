# Knowledge Base Corpus Expansion Plan

- 상태: 계획 수립
- 작성일: 2026-04-12
- 목표: `knowledge_base`를 무작정 늘리지 않고, 현재 RAG governance 한도 안에서 부족한 카테고리를 우선 보강해 실제 답변 품질을 높인다.

## 배경

- 현재 backlog에는 `P3: knowledge_base RAG corpus 확충`이 남아 있다.
- 최근 점검 기준 `knowledge_base` live row는 `49`건이며, hybrid retrieval 경로 자체는 이미 정상이다.
- 현재 병목은 인덱스 부재가 아니라 **소규모 corpus + 카테고리 커버리지 부족 가능성** 쪽에 가깝다.
- governance 기준은 [rag-knowledge-engine.md](/mnt/d/dev/openmanager-ai/docs/reference/architecture/ai/rag-knowledge-engine.md:19) 와 [rag-doc-policy.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/lib/rag-doc-policy.ts:1)가 정의한다.

## 현재 상태 요약

- 권장 총 문서 수: `<=52`
- 하드 최대 문서 수: `<=60`
- 현재 live count: `49`
- 권장 길이: `280~520자`
- 하드 최대 길이: `<=600자`
- command 비중 상한: `<=38%`
- category target:
  - command `18~24`
  - incident `8~12`
  - best_practice `8~12`
  - troubleshooting `8~12`
  - architecture `2~4`
  - security `1~2`

## 핵심 해석

- 지금 단계의 corpus 확충은 "문서를 많이 넣는 작업"이 아니다.
- 권장 한도까지 남은 여유는 크지 않으므로, **추가 + 정리**를 같이 해야 한다.
- 특히 command 문서가 이미 큰 비중을 차지하는 구조라면, 신규 slot을 대부분 `incident / best_practice / troubleshooting`에 써야 한다.
- 즉, 실행 단위는 다음 둘 중 하나여야 한다.
  - 약한 기존 문서를 교체하면서 신규 문서를 넣기
  - 2~3개 저밀도 문서를 병합해 slot을 확보한 뒤 신규 문서를 넣기

## 범위

### 포함

- `knowledge_base` category/source/길이 분포 재측정
- 저품질 후보(`below_target`, 중복도 높은 seed/command 문서) 식별
- 신규 corpus 후보를 우선순위별로 정리
- free-tier 한도 안에서 추가/교체 배치 설계

### 제외

- 이번 단계에서 실제 DB insert/upsert 실행
- embedding 모델 교체
- retrieval 함수/가중치 조정
- `knowledge_relationships` 대량 재생성

## 우선 보강 대상

### 1. incident

- 실제 incident report에서 반복되는 패턴
- 장애 원인-증상-완화 절차가 1문서 단위로 요약 가능한 케이스
- 단순 raw report dump가 아니라 operator-oriented 요약본으로 작성

### 2. troubleshooting

- 자주 묻는 운영 질문
- 예:
  - CPU spike 진단 순서
  - memory pressure 해석법
  - AI sidebar 응답 지연 시 확인 순서
  - production auth / guest-login smoke 실패 시 점검 순서

### 3. best_practice

- 운영 규칙/실행 규범
- 예:
  - release QA 기준
  - Supabase migration 작업 규칙
  - GitLab canonical deploy 원칙
  - free-tier guardrail

### 4. security / architecture

- slot이 남을 때만 보강
- 이미 존재하는 문서가 적절히 대표하면 중복 작성하지 않음

## 추천 source 우선순위

1. `manual`
- 현재 운영 규칙과 QA 기준에서 사람이 검증한 내용

2. `imported`
- 이미 존재하는 reference docs를 RAG-friendly chunk로 재구성한 것

3. `incident_reports`
- 실제 운영 사례를 operator summary로 축약한 것

4. `seed_script` / `command_vectors_migration`
- 기존 문서가 짧고 boilerplate가 많으면 신규 추가보다 먼저 병합/교체 검토

## 실행 단계

### Phase 1. 실제 분포 재측정

- [ ] live `knowledge_base`의 category/source/title/길이 분포를 다시 측정
- [ ] `48` vs `49`처럼 문서화된 count drift가 있으면 기준값을 최신화
- [ ] `below_target`, `over_limit`, `duplicate-like` 후보 목록 생성

### Phase 2. slot 예산 확정

- [ ] 권장 한도 `52` 기준으로 신규 추가 가능 slot 계산
- [ ] command 과대표 시 대체/병합 후보 확정
- [ ] 이번 배치 목표를 `+3 docs 이내` 또는 `교체형 1:1`로 제한

### Phase 3. 신규 corpus 후보 초안 작성

- [ ] incident 2~3개
- [ ] troubleshooting 2~3개
- [ ] best_practice 2~3개
- [ ] 각 문서는 `280~520자` target으로 작성

### Phase 4. 품질 게이트 적용

- [ ] placeholder 제목 `0`
- [ ] auto-generated 문서 `0~1`
- [ ] command 비중 상한 준수
- [ ] 중복도 높은 문서 병합/삭제 검토

### Phase 5. 반영 배치 설계

- [ ] 실제 insert/upsert를 별도 migration 또는 운영 스크립트로 할지 결정
- [ ] relation edge를 수동 보강할지, 추후 자동 추출에 맡길지 결정
- [ ] 반영 후 retrieval spot-check 시나리오 정의

## 완료 기준

- [ ] 현재 corpus 분포와 quality debt 목록이 문서화됨
- [ ] 다음 배치에서 넣을 신규 문서 후보 6~9개가 준비됨
- [ ] 실제 반영 시에도 총 문서 수가 권장 `52` 안에 남도록 계획이 고정됨
- [ ] command 중심 편향을 더 키우지 않는 방향으로 확충 방침이 정리됨

## 메모

- 지금은 `P3`이므로, 실제 착수 트리거는 "AI 응답 품질 이슈가 반복 관측될 때"가 맞다.
- 다만 준비 없이 바로 corpus를 늘리면 free-tier footprint와 retrieval precision이 동시에 나빠질 수 있으므로, 다음 실행은 이 계획을 기준으로 해야 한다.
