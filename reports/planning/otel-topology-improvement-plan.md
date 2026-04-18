> Owner: project
> Status: Backlog — Phase 1 `db-mysql-dc1-backup` realism, Phase 2-A `Redis cross-AZ latency`, Phase 2-B `NFS SPOF`, baseline debt cleanup, Phase 3-A `lb-haproxy-dc1-03`, Phase 3-B `cache-redis-dc1-03`, Phase 3-C `storage-nfs-dc1-02` slice는 완료. 남은 실질 backlog는 `precomputed-state` 재생성 정리다.
> Doc type: Reference
> Last reviewed: 2026-04-17
> Tags: otel-data, topology, infrastructure, data-quality

# OTel 토폴로지 개선 계획

## 배경

현재 `public/data/otel-data/` 사전 생성 데이터는 on-premise 1 DC / 3 AZ / 18대 구성을 표현하며,
아래 분석에서 남은 구조적 취약점은 precomputed-state inventory 갭과 storage failover semantics 문서화 중심으로 정리된다. AI가 이 데이터를 기반으로 진단할 때
"정상 운영 중"으로만 해석되는 문제를 해결하고, 실제 운영 환경 수준의 현실성을 높이는 것이 목표.

## 현재 토폴로지

```
[Internet]
    ↓
[LB: HAProxy x3]  AZ1·AZ2·AZ3
    ↓
[Web: Nginx x3]   AZ1·AZ2·AZ3
    ↓
[API: WAS x3]     AZ1·AZ2·AZ3
    ↓         ↓          ↓
[MySQL x3]  [Redis x3]  [Storage x3]
AZ1/2/3    AZ1/2/3     AZ1/2/3     ← NFS active/standby + S3GW
```

## 발견된 문제점

| # | 항목 | 상태 | 내용 |
|---|------|:----:|------|
| P1 | LB AZ2 부재 | 완료 | `lb-haproxy-dc1-03` 추가로 AZ1·AZ2·AZ3 분산 완료 |
| P2 | Redis AZ3 부재 | 완료 | `cache-redis-dc1-03` 추가로 Redis 3노드 구성이 됨 |
| P3 | NFS SPOF | 완료 | `storage-nfs-dc1-02` 추가로 NFS active/standby inventory 구성 완료 |
| P4 | S3GW SPOF | 관찰 | `storage-s3gw-dc1-01`이 AZ3 단독. 객체 스토리지 게이트웨이 단일 노드 |
| P5 | db-backup 역할 모호 | 완료 | `db-mysql-dc1-backup`을 cold-standby / daily snapshot target으로 현실화 |

## 개선 방향

### 옵션 A: 서버 추가로 storage HA 완성 (17→18대)

서버 1대 추가:
- `storage-nfs-dc1-02` AZ2 추가 (NFS HA standby)

**장점**: storage inventory를 3AZ로 직접 완성  
**단점**: `precomputed-state`까지 포함하면 변경 범위가 커짐

### 옵션 B: 시나리오 데이터로 취약점 표현 (현 15대 유지)

서버 추가 없이, 기존 시나리오에 취약점 기반 장애 패턴을 추가:
- AZ2가 LB 없이 응답 지연 증가하는 메트릭 패턴 추가
- Redis cross-AZ 레이턴시 스파이크 로그 추가
- NFS 단독 구성 경고 상태 시나리오 추가

**장점**: 변경 범위 최소 (otel-fix.ts 시나리오만 수정)  
**단점**: 구조적 취약점이 데이터에 숨겨져 있어 AI가 구성 자체를 진단하기 어려움

### 옵션 C: db-backup 역할 명확화 (즉시 가능)

`db-mysql-dc1-backup` → `db-mysql-dc1-replica2` 로 리네임하거나,
backup 전용으로 스펙 다운 (8c/32GB/1TB) + 역할 설명 명시.

**장점**: 즉시 적용 가능, 스펙 현실성 향상  
**단점**: 서버 ID 변경 시 참조 파일 다수 수정 필요

---

## 작업 계획 (권장: B + C 우선, A는 장기)

### 이번 승인 slice (`2026-04-18`, Phase 1-A)

- 목표: `db-mysql-dc1-backup`을 primary와 동일 스펙의 애매한 노드가 아니라, `cold-standby / daily snapshot target` 성격의 백업 노드로 현실화한다.
- 범위:
  - `resource-catalog.json`에서 backup 서버 스펙을 `8c / 32GB / 1TB`로 조정
  - backup 서버 설명용 메타데이터(`server.purpose`, `server.notes`) 추가
  - `hour-23` backup 메트릭을 `disk 중심 spike + 낮은 cpu/memory` 패턴으로 조정
  - `scripts/data/otel-fix.ts`와 `scripts/data/otel-verify.ts`에 위 계약 반영
  - Redis cross-AZ / NFS SPOF 시나리오 추가, 서버 수 증설은 이번 slice 제외

### 이번 slice 완료 결과 (`2026-04-18`, Phase 1-A)

- `resource-catalog.json`의 `db-mysql-dc1-backup`은 이제 `8c / 32GB / 1TB` 스펙과 `cold-standby / daily snapshot target` 설명 메타데이터를 가진다.
- `hour-23`와 `timeseries.json`의 backup 메트릭은 `disk-heavy / low-cpu / low-memory` 패턴으로 정렬됐다.
- `scripts/data/otel-fix.ts`는 위 backup profile을 재생성할 수 있고, `scripts/data/otel-verify.ts`는 backup realism 계약을 검증한다.
- 이번 slice 범위 밖의 기존 `data:verify` 실패 2건은 유지된다.
  - storage network range
  - ERROR 비율 하한

### 이번 승인 slice (`2026-04-18`, Phase 2-A)

- 목표: AZ3의 `api-was-dc1-03`가 AZ1 Redis(`cache-redis-dc1-01`)에 cross-AZ 접근하면서 응답 지연이 커지는 구조적 취약점을 데이터로 명시한다.
- 범위:
  - `hour-13~15`의 `api-was-dc1-03` `http.server.request.duration` spike 추가
  - `api-was-dc1-03`, `cache-redis-dc1-01` 로그에 `remote AZ cache` 원인 문구 추가
  - `timeseries.json`의 같은 구간 response duration 동기화
  - `otel-fix.ts`, `otel-verify.ts`에 S6 계약 반영
  - NFS SPOF(S7), verify baseline debt 2건, 서버 수 증설은 이번 slice 제외

### 이번 slice 완료 결과 (`2026-04-18`, Phase 2-A)

- `hour-13~15`의 `api-was-dc1-03`는 cross-AZ cache latency를 반영한 response duration spike를 가진다.
- `api-was-dc1-03`, `cache-redis-dc1-01` 로그에는 `remote AZ cache` 원인 문구가 기록된다.
- `timeseries.json`도 같은 구간 response duration spike를 반영한다.
- `otel-fix.ts`와 `otel-verify.ts`는 위 S6 계약을 재생성/검증한다.
- 이번 slice 범위 밖의 기존 `data:verify` 실패 2건은 유지된다.
  - storage network range
  - ERROR 비율 하한

### 이번 승인 slice (`2026-04-18`, Phase 2-B)

- 목표: `storage-nfs-dc1-01` 단일 공유 스토리지 노드의 I/O 병목이 02~04시에 발생하고, 그 영향이 WAS 응답 지연으로 번지는 구조적 취약점을 데이터로 명시한다.
- 범위:
  - `hour-02~04`의 `storage-nfs-dc1-01` disk/cpu spike 추가
  - `storage-nfs-dc1-01`, `api-was-*` 로그에 NFS 병목 원인 문구 추가
  - `timeseries.json`의 같은 구간 WAS response duration 동기화
  - `otel-fix.ts`, `otel-verify.ts`에 S7 계약 반영
  - storage network baseline debt, ERROR 비율 하한, 서버 수 증설은 이번 slice 제외

### 이번 slice 완료 결과 (`2026-04-18`, Phase 2-B)

- `hour-02~04`의 `storage-nfs-dc1-01`은 disk/cpu saturation과 NFS SPOF 원인 로그를 가진다.
- `api-was-dc1-01~03`은 같은 구간에 NFS 병목 전파를 반영한 response duration spike와 관련 로그를 가진다.
- `timeseries.json`은 위 WAS latency spike를 같은 구간에 반영한다.
- `otel-fix.ts`와 `otel-verify.ts`는 위 S7 계약을 재생성/검증한다.
- 이번 slice 범위 밖의 기존 `data:verify` 실패 2건은 유지된다.
  - storage network range
  - ERROR 비율 하한

### 이번 승인 slice (`2026-04-18`, baseline debt cleanup)

- 목표: `data:verify`에 남아 있는 baseline debt 2건을 제거해 OTel 생성 데이터의 기본 검증을 모두 통과시킨다.
- 범위:
  - `hour-23`의 `storage-s3gw-dc1-01` network drift를 storage baseline 범위 안으로 조정
  - severity baseline을 보강해 전체 로그에서 `ERROR > 3%` 계약을 복구
  - `otel-fix.ts`, `otel-verify.ts`와 계약 테스트를 위 두 기준에 맞게 동기화
  - 서버 수 증설(Phase 3), 새 토폴로지 시나리오 추가는 이번 slice 제외

### 이번 slice 완료 결과 (`2026-04-18`, baseline debt cleanup)

- `hour-23`의 `storage-s3gw-dc1-01` network 값은 storage baseline 범위 안으로 복구됐다.
- anomaly-heavy 시간대에는 deterministic extra error 로그가 추가되어 전체 severity 분포가 `ERROR > 3%`를 다시 만족한다.
- `data:verify`는 이제 `29 passed, 0 failed`로 baseline debt 없이 통과한다.
- 남은 backlog는 Phase 3 서버 증설뿐이다.

### Phase 1: db-backup 역할 명확화 (즉시)

- [x] `resource-catalog.json`에서 `db-mysql-dc1-backup` 스펙 조정
  - `host.cpu.count`: 16 → 8
  - `host.memory.size`: 64GB → 32GB
  - `server.role` 설명 주석 추가: "cold standby / daily snapshot target"
- [x] `otel-fix.ts` S1 시나리오에서 backup 서버 메트릭 패턴 현실화
  - CPU/메모리 사용률을 primary보다 낮게 (백업 배치 시간대만 스파이크)
- [x] `otel-verify.ts`에 backup 서버 메트릭 범위 검증 추가

### Phase 2: 시나리오 취약점 표현 (단기)

- [x] **S6 추가**: Redis cross-AZ 레이턴시 시나리오 (AZ3 api-was가 AZ1 Redis 접근 시 응답 지연)
  - `hour-13~15` 슬롯에 api-was-dc1-03의 응답시간 spike 추가
  - Redis 관련 로그에 "connection to remote AZ cache" 경고 패턴 추가
- [x] **S7 추가**: NFS 단일 장애 징후 시나리오 (I/O wait 급증)
  - `hour-02~04` 슬롯에 storage-nfs-dc1-01 disk I/O 포화 + 연쇄 WAS 응답 지연
  - NFS 의존 서버들의 디스크 메트릭에 I/O wait 반영
- [x] `otel-verify.ts` 검증 항목 S6, S7 추가

### Phase 3: 서버 추가 (장기, 필요 시)

- [ ] `resource-catalog.json`에 3대 추가
  - `lb-haproxy-dc1-03` (AZ2, 4c/8GB/50GB)
  - `cache-redis-dc1-03` (AZ3, 4c/32GB/50GB)
  - `storage-nfs-dc1-02` (AZ2, 4c/16GB/5TB, hot-standby)
- [ ] `otel-fix.ts` 신규 서버 메트릭 데이터 생성 로직 추가
- [ ] `timeseries.json` 재생성 (15→18 서버)
- [ ] AI Engine `precomputed-state.ts` 서버 목록 갱신

### 이번 승인 slice (`2026-04-18`, Phase 3-A)

- 목표: AZ2 load balancer 부재를 해소하기 위해 `lb-haproxy-dc1-03`를 inventory와 시계열 데이터에 추가한다.
- 범위:
  - `resource-catalog.json`에 `lb-haproxy-dc1-03` 추가 (`AZ2`, `4c/8GB/50GB`)
  - `src/config/server-registry.ts`에 신규 LB IP 추가
  - 24개 hourly 파일에 신규 LB metric datapoint 추가
  - `timeseries.json`에 신규 LB `serverId`와 144포인트 추가
  - `otel-fix.ts`에 신규 LB datapoint 생성 helper 추가
  - `cache-redis-dc1-03`, `storage-nfs-dc1-02`, `precomputed-state` 재생성은 이번 slice 제외

### 이번 slice 완료 결과 (`2026-04-18`, Phase 3-A)

- `lb-haproxy-dc1-03`는 이제 `resource-catalog`, `server-registry`, 24개 hourly, `timeseries`에 모두 존재한다.
- `otel-fix.ts`는 AZ2 LB datapoint와 timeseries row를 재생성할 수 있고, `otel-verify.ts`는 이 inventory 계약을 검증한다.
- `data:verify`는 `34 passed, 0 failed`로 유지된다.
- 남은 Phase 3 backlog는 `cache-redis-dc1-03`, `storage-nfs-dc1-02`, 필요 시 `precomputed-state` 재생성이다.

### 이번 승인 slice (`2026-04-18`, Phase 3-B)

- 목표: AZ3 Redis 부재를 해소하기 위해 `cache-redis-dc1-03`를 inventory와 시계열 데이터에 추가한다.
- 범위:
  - `resource-catalog.json`에 `cache-redis-dc1-03` 추가 (`AZ3`, `4c/32GB/50GB`)
  - `src/config/server-registry.ts`에 신규 Redis IP 추가
  - 24개 hourly 파일에 신규 Redis metric datapoint 추가
  - `timeseries.json`에 신규 Redis `serverId`와 144포인트 추가
  - `otel-fix.ts`, `otel-verify.ts`에 신규 Redis inventory helper/검증 추가
  - `storage-nfs-dc1-02`, `precomputed-state` 재생성, cross-AZ 시나리오 재해석은 이번 slice 제외

### 이번 slice 완료 결과 (`2026-04-18`, Phase 3-B)

- `cache-redis-dc1-03`는 이제 `resource-catalog`, `server-registry`, 24개 hourly, `timeseries`에 모두 존재한다.
- `otel-fix.ts`는 AZ3 Redis datapoint와 timeseries row를 재생성할 수 있고, `otel-verify.ts`는 이 inventory 계약을 검증한다.
- `data:verify`는 `39 passed, 0 failed`로 유지된다.
- 남은 Phase 3 backlog는 `storage-nfs-dc1-02`, 필요 시 `precomputed-state` 재생성이다.

### 이번 승인 slice (`2026-04-18`, Phase 3-C)

- 목표: `storage-nfs-dc1-02`를 AZ2 hot-standby storage node로 추가해 남은 NFS SPOF를 inventory 차원에서 완화한다.
- 범위:
  - `resource-catalog.json`에 `storage-nfs-dc1-02` 추가 (`AZ2`, `4c/16GB/5TB`, `server.purpose=hot-standby`)
  - `src/config/server-registry.ts`에 신규 NFS IP 추가
  - 24개 hourly 파일에 신규 storage metric datapoint 추가
  - `timeseries.json`에 신규 storage `serverId`와 144포인트 추가
  - `otel-fix.ts`, `otel-verify.ts`에 신규 storage standby inventory helper/검증 추가
- `precomputed-state` 재생성, topology scenario reinterpretation, S3 gateway 변경은 이번 slice 제외

### 이번 slice 완료 결과 (`2026-04-18`, Phase 3-C)

- `storage-nfs-dc1-02`는 이제 `resource-catalog`, `server-registry`, 24개 hourly, `timeseries`에 모두 존재한다.
- `server.purpose=hot-standby`, `server.notes=nfs failover target` 메타데이터가 추가됐다.
- `otel-fix.ts`는 AZ2 NFS standby datapoint와 timeseries row를 재생성할 수 있고, `otel-verify.ts`는 이 inventory 계약을 검증한다.
- `data:verify`는 `45 passed, 0 failed`로 유지된다.
- 남은 backlog는 `precomputed-state` 재생성 정리뿐이다.

---

## 영향 범위

| 파일 | Phase 1 | Phase 2 | Phase 3 |
|------|:-------:|:-------:|:-------:|
| `public/data/otel-data/resource-catalog.json` | ✅ | — | ✅ |
| `public/data/otel-data/hourly/*.json` | ✅ | ✅ | ✅ |
| `public/data/otel-data/timeseries.json` | — | — | ✅ |
| `scripts/data/otel-fix.ts` | ✅ | ✅ | ✅ |
| `scripts/data/otel-verify.ts` | ✅ | ✅ | ✅ |
| `cloud-run/ai-engine/src/data/precomputed-state.ts` | — | — | ✅ |
| `src/config/server-registry.ts` | — | — | ✅ |

---

## 선행 조건

- Phase 2 착수 전: Phase 1 완료 및 `npm run validate:all` 통과
- Phase 3 착수 전: Phase 2 완료 + AI 진단 품질 검증 (새 시나리오로 AI가 구조적 취약점을 탐지하는지 확인)

## 착수 조건 (SDD Gate)

> Status를 `Approved`로 전환하려면 아래 항목을 완성한다.

- [ ] **Phase 착수 전 변경 대상 파일 목록** 확정 (Phase 1: resource-catalog.json, otel-fix.ts, otel-verify.ts)
- [ ] **입출력 계약** — db-backup 스펙 수치 확정 (cpu: 8c, mem: 32GB), 시나리오 슬롯 확정
- [ ] **테스트 시나리오** — `otel-verify.ts` 검증 추가 항목 목록화 (backup 메트릭 범위)
- [ ] Phase 1 완료 후 `npm run validate:all` 통과 확인 후 Phase 2 착수

## 기대 효과

- AI가 "AZ2에 LB 없음", "Redis cross-AZ 레이턴시" 등 구조적 취약점을 직접 진단 가능
- 데모 시나리오의 현실성 향상 (단순 메트릭 임계값 초과 → 아키텍처 레벨 문제 진단)
- otel-fix 시나리오가 8→9개로 확장되어 AI 학습 다양성 증가
