# QA-20260521-0550 Evidence - v8.11.194 Weekly Focused QA

> Target: Vercel production + Cloud Run AI Engine
> Build: v8.11.194 / commit `562ada666ad1b36bc12c81300fb8cea026fd1e1c`
> Scope: weekly focused targeted QA for grounded KRL, clarification split, session freeze, and Cerebras default.

## Result

12 checks passed, 0 failed.

| ID | Surface | Result |
|---|---|---|
| T1 | Landing hero AI title rendering | PASS |
| T2 | Version `v8.11.194` and release commit confirmed | PASS |
| T3 | AI Engine healthy, observed 89-128ms | PASS |
| T4 | Dashboard server summary values correct | PASS |
| T5 | Session server data freeze retained OTel slot after reload | PASS |
| T6 | AI Assistant panel opened and showed AI Engine Ready | PASS |
| T7 | Clarification trigger split: topology prompt opened clarification | PASS |
| T8 | KRL grounded synthesis: 5 KB results, Z.AI synthesis, OTel criteria/server names preserved | PASS with observation |
| T9 | Off-domain guard: weather prompt passed with domain warning | PASS |
| T10 | whole_fleet scope answered directly without clarification | PASS |
| T11 | Cerebras `gpt-oss-120b` default code path confirmed | PASS |
| T12 | Semantic frame trust boundary detected measured risk despite positive phrasing | PASS |

## Observation

T8 did not expose `groundingMode: llm-synthesized` in the UI debug view. This is not a new product regression in this QA run:

- The user-facing KRL answer was grounded and preserved the expected OTel topology/criteria evidence.
- Metadata visibility for `groundingMode` is already tracked under AI quality Task A.
- Production failure injection for KB fallback remains out of scope; unit/contract coverage is the intended validation layer for that path.

## Decision

Release status remains `go` for the tested scope. No hotfix is required from this run. The only follow-up is continuing the existing Task A metadata observability tracking and retesting it when KRL runtime or UI debug metadata contracts change.
