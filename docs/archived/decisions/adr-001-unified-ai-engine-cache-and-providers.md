# [ARCHIVED] ADR-001: Google AI Unified Engine v1.1.0 Architecture Verification

> ⚠️ **ARCHIVED (2026-02-03)**: 이 ADR은 역사적 기록으로 보존됩니다.
> - **아카이브 사유**: 3-AI 리뷰 시스템에서 2-AI (Codex + Gemini)로 전환됨 (Qwen 제거, 2026-01-07)
> - **현재 AI 리뷰**: `.claude/rules/ai-tools.md` 참조

**Date**: 2025-11-16
**Status**: Archived (was: Decided)
**Context**: This document records the architectural review of the `GoogleAiUnifiedEngine` (commit 47f920c9) using a 3-AI cross-verification process. The goal was to verify the quality of the architecture after its initial implementation.

---

## Summary of AI Findings

### 📊 Codex (Practicality POV)

- **Core Argument**: The parallel context collection (`Promise.allSettled`) and error handling meet practical requirements. However, the provider selection mechanism has hard-coded dependencies, limiting extensibility.
- **Key Evidence**:
  1. **Parallel Execution**: Correctly uses `Promise.allSettled` to ensure resilience if one provider fails.
  2. **Error Logging**: `console.warn` for rejected providers is sufficient for practical debugging.
  3. **Cache Key Normalization**: `trim()` and `toLowerCase()` are good, but warns about potential case-mismatch issues.
  4. **Timeout Handling**: `AbortSignal.timeout` is a production-grade solution.
  5. **Extensibility Problem**: The `selectProviders` method uses a hard-coded map of keys (`'rag'`, `'ml'`, `'rule'`) and depends on a static `ProvidersConfig` type. Adding a new provider requires modifying multiple places. Recommends refactoring to a metadata-driven dynamic evaluation.
- **Recommendations**:
  1. Review scenario name normalization (case-insensitivity).
  2. Simplify provider filtering to be metadata-driven.

### 📐 Gemini (Architecture POV)

- **Core Argument**: The `IContextProvider` interface respects the Interface Segregation Principle (ISP) but violates the Dependency Inversion Principle (DIP) because the engine class instantiates providers directly. The `selectProviders` method is a clear violation of the Open/Closed Principle (OCP).
- **Key Evidence**:
  1. **SOLID Analysis**:
      - **SRP**: Good. Each provider has a single responsibility.
      - **OCP**: **Clearly violated**. The `if-else` chain in `selectProviders` requires modification to add new providers.
      - **LSP**: Good. All providers adhere to the `IContextProvider` interface.
      - **ISP**: Good. The interface is not bloated.
      - **DIP**: **Violated**. The `GoogleAiUnifiedEngine` creates its own provider instances instead of receiving them via dependency injection.
  2. **PromptBuilder**: Good use of Singleton and Strategy patterns; mostly OCP-compliant.
  3. **Cache Responsibility**: The in-memory cache is strongly coupled to a `Map` object.
- **Recommendations**:
  1. **Fix OCP Violation**: Add a `shouldBeEnabled(request, config)` method to the `IContextProvider` interface to remove hard-coded logic from the engine.
  2. **Fix DIP Violation**: Use dependency injection to provide provider instances to the engine's constructor.
  3. **Abstract the Cache**: Introduce a `CacheService` interface to decouple the engine from the `Map` implementation.

### ⚡ Qwen (Performance POV)

- **Core Argument**: Parallel execution is optimal, but a critical bug was found where a FIFO (First-In, First-Out) cache was implemented under the assumption it was an LRU (Least Recently Used) cache. Token estimation logic is also inaccurate, especially for non-ASCII characters.
- **Key Evidence**:
  1. **Parallel Execution**: Confirmed that `Promise.allSettled` reduces latency and improves resilience.
  2. **Cache Complexity**: Confirmed that `Map.get`/`set` provide O(1) average time complexity.
  3. **CRITICAL BUG - Incorrect Cache Eviction**: The implementation uses `Map.keys().next().value` for eviction, which removes the _oldest_ entry by insertion order, not the least recently _used_. This significantly reduces cache effectiveness.
  4. **Bottlenecks**:
      - The `ThinkingSteps` array could cause memory accumulation.
      - Token estimation (`text.length / 4`) is a rough approximation and is particularly inaccurate for Korean text.
- **Recommendations**:
  1. **High Priority: Fix the LRU bug.** The `get` and `set` methods must be modified to re-insert items to mark them as recently used.
  2. **Medium Priority: Improve token estimation** with better character-based weighting.
  3. **Low Priority: Optimize `ThinkingSteps` memory usage.**

---

## Decision

### Agreements and Conflicts

- **Agreement**: All 3 AIs agreed that the `Promise.allSettled` approach was optimal and that the provider selection logic was a key weakness (violating OCP / being hard-coded).
- **Conflict**: The AIs disagreed on the priority of the cache issue. Qwen identified the LRU bug as critical for performance, while Gemini focused on the lack of abstraction (strong coupling to `Map`) from an architectural standpoint.

### Final Judgment (Based on Project Context)

The project lead (Claude Code AI) made the final decision based on the 1-person AI development context where ROI is critical.

1. **Adopted (High Priority)**: **Qwen's LRU Bug Fix.** This was the most critical finding. The fix is low-cost (a few lines of code) and has a high impact on performance by improving the cache hit rate.
2. **Adopted (Medium Priority)**: **Codex's Metadata-driven Provider Filtering.** This improves extensibility and maintainability at a reasonable implementation cost, addressing the OCP violation identified by Gemini in a practical way.
3. **Deferred (Low Priority)**: **Gemini's full DIP and Cache Abstraction.** While architecturally pure, the refactoring effort to implement full dependency injection and a `CacheService` interface was deemed too high for the current one-person team, providing low immediate ROI. The current `Map`-based cache is sufficient.
4. **Deferred (Low Priority)**: **Qwen's token estimation and `ThinkingSteps` optimization.** The current accuracy and memory usage are acceptable for the system's usage patterns.

### Action Items

- **Immediate**:
  - [x] Fix the LRU cache bug by updating the `get` and `set` logic.
  - [x] Add `toLowerCase()` normalization for cache keys.
- **Next Sprint**:
  - [ ] Refactor the provider selection to be metadata-driven, removing the `if-else` chain.
- **Future**:
  - [ ] Consider improving token estimation accuracy if it becomes a problem.

---

This ADR preserves the multi-agent analysis that led to critical bug fixes and design improvements in the Unified AI Engine.
