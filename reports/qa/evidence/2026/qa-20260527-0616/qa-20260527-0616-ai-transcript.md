# QA-20260527-0616 AI Transcript Evidence

Target: https://openmanager-ai.vercel.app
Version: v8.12.53
Session: Playwright MCP on Vercel production

## Q-NEW46b: storage-nfs-dc1-01 disk RCA first run

Prompt:

```text
storage-nfs-dc1-01 디스크가 높은 원인이 뭐야?
```

Observed answer excerpt:

```text
storage-nfs-dc1-01: 디스크 사용률 93%로 critical 이상
디스크 사용률: 93% (임계값 80% 초과, 90% critical 돌파)
관련 메트릭: CPU(58%)와 디스크(93%) 간 강한 양의 상관관계(r=0.98) 확인
추정 원인: NFS 스토리지 볼륨의 과도한 데이터 축적 (근거 강도: 높음)
```

Verdict: PASS. No false CPU=0% appeared.

## Q-NEW46c: repeated disk RCA after session context/cache

Prompt repeated:

```text
storage-nfs-dc1-01 디스크가 높은 원인이 뭐야?
```

Observed answer excerpt:

```text
storage-nfs-dc1-01 서버의 디스크 사용률이 93%로 임계치(80%)를 초과하여 'critical' 상태입니다.
디스크 사용률: 93%
임계치: 80%
평균 CPU 사용률: 58%
평균 메모리 사용률: 42%
디스크 사용률과 CPU 사용률 간 강한 양의 상관관계(r=0.98)가 존재합니다.
```

Verdict: PASS. Repeated query did not report CPU=0%.

## Q-NEW46a: generic anomaly signal

Prompt:

```text
이상 징후 분석해줘
```

Observed behavior:

```text
조금 더 구체적으로 알려주세요
신뢰도 80%로 추가 정보가 필요합니다
입력: "이상 징후 분석해줘"
```

After selecting `필터 없이 전체 대상으로 실행`, the answer used the Analyst path:

```text
장애 징후 감지됨
총 서버: 18대
이상 서버: 2대 (db-mysql-dc1-primary, storage-nfs-dc1-01)
storage-nfs-dc1-01: Disk 93% (위험)
분석 근거: 도구: 전체 서버 이상 징후 확인 · 기간: 최근 1시간
```

Verdict: WARN. The previous metric-current misrouting is not reproduced, but the generic wording still opens a clarification step before all-target Analyst execution.
