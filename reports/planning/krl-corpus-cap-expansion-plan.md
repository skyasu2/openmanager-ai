> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-20
> Tags: rag, supabase, krl, corpus-policy

# KRL corpus cap 상향 계획 (2026-05-20)

## 목표

Supabase 사용량 문제가 없는 범위에서 KRL corpus governance를 소폭 상향하고, 부족한 `security`/`architecture` 검색 앵커를 보강한다.

## 근거

- Supabase 공식 billing 문서 기준 Free plan은 Database Size 500MB/project, Egress 5GB quota를 제공한다.
- 현재 KRL은 60건이고 모든 문서가 280~520자 target band 안에 있다.
- 추가 예정 7건은 텍스트/메타데이터 중심 소형 row라 DB size/egress 관점의 위험은 낮다.
- 현재 `command=25/60=41.7%`가 상한 42%에 근접하므로 command를 늘리지 않고 `security +4`, `architecture +3`만 추가한다.

## 계약

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| `DEFAULT_TARGET_TOTAL_DOCS` | 60 | 72 |
| `HARD_MAX_TOTAL_DOCS` | 64 | 80 |
| `MAX_COMMAND_DOC_RATIO` | 42% | 40% |
| `architecture` target | 2-5 | 2-8 |
| `security` target | 1-2 | 2-5 |

예상 live 분포:

```text
total=67
command=25      -> 37.3%
architecture=8 -> target max
security=5     -> target max
```

## 테스트 시나리오

- [ ] 정책 상수 테스트: target/hard/category range가 상향 계약과 일치한다.
- [ ] 계획 분포 테스트: 67건, command 25건, architecture 8건, security 5건이 governance PASS 범위다.
- [ ] seed dry-run: 7건 모두 target length band이고 warning이 없다.
- [ ] live smoke: security/architecture 신규 query가 기대 title을 반환한다.
- [ ] live governance: `rag:analyze` 전체 PASS.

## 구현 범위

- [ ] T0: failing policy spec 커밋
- [ ] T1: `rag-doc-policy.ts` governance 상수 상향
- [ ] T2: security/architecture seed JSON 7건 추가
- [ ] T3: `supabase:rag:smoke`에 신규 security/architecture query 추가
- [ ] T4: live Supabase upsert 적용
- [ ] T5: smoke/analyze/docs 검증 후 plan archive
