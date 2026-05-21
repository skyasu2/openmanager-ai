# v8.11.194 Targeted Release QA Evidence

KST: 2026-05-21 13:07
Target: https://openmanager-ai.vercel.app
Deployment: https://openmanager-7x1doek0n-skyasus-projects.vercel.app
Deployment ID: dpl_7xf2j9vHZkGBYwdk71i4vdy4pNXq
Commit: 562ada666ad1b36bc12c81300fb8cea026fd1e1c
Release tag: v8.11.194

## Deployment Gates

- GitLab tag pipeline `2542261926` completed `success`.
- GitLab main validate pipeline `2542261925` completed `success`.
- Production `/api/version` returned `8.11.194`, commit `562ada666ad1b36bc12c81300fb8cea026fd1e1c`, pipeline URL `2542261926`.
- Production `/api/health?service=ai` returned healthy Cloud Run AI Engine `8.11.194`.
- Vercel usage check remained normal: effective `13.3467 USD`, billed `0.0000 USD`, chargeCount `11571`.

## Dashboard Core

- Landing already served `v8.11.194`.
- Guest session opened `/dashboard`.
- Dashboard rendered OpenTelemetry slot `13:00 KST (slot 78/143)`.
- Dashboard summary: total `18`, online `17`, warning `1`, risk `0`, offline `0`.
- System resource summary: CPU `30%`, memory `47%`, disk `35%`.
- AI Assistant sidebar opened and showed AI Engine `Ready`.

## Conversational AI QA

Standard five-question QA was executed through the production AI sidebar.

1. `현재 서버 전체 상태를 요약해줘`
   - Pass: returned total 18, normal 17, warning 1, risk 0, offline 0; average CPU 30%, memory 47%, disk 35%; identified `cache-redis-dc1-01` memory 82%.
2. `web-server-01 상태를 자세히 알려줘`
   - Pass: resolved alias `web-server-01 -> web-nginx-dc1-01`; returned online, CPU 32%, memory 43%, disk 30%, network 1%, load and response-time details.
3. `지난 24시간 중 가장 부하가 높았던 시간대는 언제야?`
   - Pass: returned `2026년 5월 21일 03:50`, load1 `16.58`, and attributed the peak to `db-mysql-dc1-primary`.
4. `지금 당장 조치가 필요한 서버가 있어?`
   - Pass: answered no immediate-action server and still gave a warning-level check path for `cache-redis-dc1-01`.
5. `방금 분석한 서버 중 네트워크 문제가 있는 것만 골라줘`
   - Pass: returned network usage >= 70% servers `0대`, with server metric tool evidence for the recent 1-hour window.

No raw tool markers, reasoning JSON, or visible transport errors were observed in the tested AI sidebar output.

## Artifact

- Screenshot: `reports/qa/evidence/qa-20260521-v811194-ai-five-question.png`
