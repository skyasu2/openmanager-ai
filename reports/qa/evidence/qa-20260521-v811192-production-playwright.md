# QA Evidence: v8.11.192 Production Playwright

- Target: https://openmanager-ai.vercel.app
- Deployment: Vercel production
- Browser: Playwright Chromium isolated runtime
- Note: Playwright MCP navigation was blocked by a locked MCP Chrome profile; this run used the same production URL with an isolated Playwright browser.
- Query: OTel SSOT 18대 서버 상태 판단 기준을 KRL 근거로 설명해줘

## Checks

- PASS: landing renders v8.11.192
- PASS: landing AI title is crisp styled

  ```json
  {
    "text": "AI",
    "color": "rgba(0, 0, 0, 0)",
    "backgroundImage": "linear-gradient(135deg, rgb(165, 243, 252) 0%, rgb(96, 165, 250) 48%, rgb(196, 181, 253) 100%)",
    "filter": "none",
    "mixBlendMode": "normal",
    "opacity": "1",
    "textRendering": "geometricprecision",
    "textShadow": "none",
    "webkitTextFillColor": "rgba(0, 0, 0, 0)"
  }
  ```
- PASS: guest login reaches landing
- PASS: dashboard status summary matches production OTel snapshot
- PASS: AI KRL/OTel query returns grounded user-facing response with OTel status criteria

  ```json
  {
    "latencyMs": 10695,
    "responseLength": 1103,
    "excerpt": "OTel SSOT 18대 서버 상태 판단 기준을 KRL 근거로 설명해줘\n\n8:35:20 AM\n\n복사\n\n핵심 요약\n\nOTel 상태 판단 기준은 다음과 같습니다. - P0 오프라인: CPU, 메모리, 디스크가 모두 0인 경우\nP1/P2 심각: CPU와 메모리가 모두 임계값 이상이거나, CPU, 메모리, 디스크 중 하나가 임계값 이상인 경우 - 임계값: CPU 90%, 메모리 90%\nP3/P4 경고: CPU, 메모리, 디스크 중 2개 이상이 경고 임계값 이상이거나, 하나라도 경고 임계값 이상인 경우 - 경고 임계값: CPU 80%, 메모리 80%, 디스크 80%\nP99 온라인: CPU, 메모리, 디스크가 모두 경고 임계값 미만인 경우 이는 18대 서버 인벤토리와 현재 메트릭을 pre-generated OTel 데이터 슬롯을 SSOT로 사용합니다.\n\n상세 분석\n\n현재 CPU, 메모리, 디스크 값은 KRL에서 추정하지 않고 모니터링 데이터 툴 또는 OTel 슬롯 결과를 우선합니다. OTel 상태 판단 기준\n18대 서버 inventory와 현재 메트릭은 pre-generated OTel data slot을 SSOT로 봅니다. - 현재 CPU/Memory/Disk 값은 KRL에서 추정하지 않고 monitoring data tool 또는 OTel slot 결과를 우선합니다. - P0 offline: CPU, Memory, Disk가 모두 0인 경우\nP1/P2 critical: CPU와 Memory가 모두 critical 임계값(CPU 90%, Memory 90%) 이상이거나, CPU 90% / Memory 90% / Disk 90% 중 하나가 critical 임계값 이상인 경우\nP3/P4 warning: CPU/Memory/Disk 중 2개 이상이 warning 임계값(CPU 80%, Memory "
  }
  ```
- PASS: AI stream output hides raw tool/reasoning markers

## Production Responses

```json
[
  {
    "url": "https://openmanager-ai.vercel.app/api/health?service=ai&soft=true",
    "status": 200,
    "headers": {
      "x-ai-latency-ms": null,
      "x-vercel-id": "icn1::icn1::lrz6q-1779320113238-49f8985b8349"
    }
  },
  {
    "url": "https://openmanager-ai.vercel.app/api/ai/supervisor/stream/v2",
    "status": 200,
    "headers": {
      "x-ai-latency-ms": "4201",
      "x-vercel-id": "icn1::icn1::ql9dh-1779320113508-714bba004653"
    }
  }
]
```

## Console Warnings/Errors

```json
[
  {
    "type": "error",
    "text": "Failed to load resource: the server responded with a status of 401 ()"
  }
]
```

## Request Failures

```json
[
  {
    "url": "https://openmanager-ai.vercel.app/api/system",
    "failure": "net::ERR_ABORTED"
  },
  {
    "url": "https://openmanager-ai.vercel.app/?_rsc=5c339",
    "failure": "net::ERR_ABORTED"
  },
  {
    "url": "https://openmanager-ai.vercel.app/api/ai/wake-up",
    "failure": "net::ERR_ABORTED"
  },
  {
    "url": "https://openmanager-ai.vercel.app/api/system",
    "failure": "net::ERR_ABORTED"
  }
]
```

## Screenshots

- reports/qa/evidence/qa-20260521-v811192-landing-ai.png
- reports/qa/evidence/qa-20260521-v811192-dashboard.png
- reports/qa/evidence/qa-20260521-v811192-ai-krl.png
