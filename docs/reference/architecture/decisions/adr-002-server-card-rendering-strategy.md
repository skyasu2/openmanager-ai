# ADR-002: Server Card Rendering Strategy

> 서버 카드 렌더링 전략 진화와 최종 의사결정 ADR
> Owner: platform-architecture
> Status: Active
> Doc type: Decision
> Last reviewed: 2026-02-14
> Canonical: docs/reference/architecture/decisions/adr-002-server-card-rendering-strategy.md
> Tags: adr,rendering,dashboard,performance

**Date**: 2025-10-20
**Status**: Decided
**Context**: This document analyzes the evolution of the server card rendering strategy on the main dashboard to optimize for Web Vitals, memory usage, and user experience. The component in question renders a list of up to 15 server cards.

---

## 1. Evolution of Rendering Strategies

### Phase 1: Simple Pagination (Initial Implementation)

- A standard dropdown to select page size (4, 6, 8, 12, 15).
- A simple, responsive CSS grid.
- Traditional pagination UX.

### Phase 2: Virtualized Scrolling with `react-window` (Attempted)

- **Date**: 2025-10-14
- The `react-window` library was introduced to handle rendering.
- **Decision**: This approach was abandoned after only 52 minutes of testing.

### Phase 3: "Show More" Button (Current Core Logic)

- The `react-window` library was removed.
- A custom `VirtualizedServerList.tsx` component was created.
- It uses a responsive CSS grid and dynamically calculates the number of cards per row based on viewport width.
- An "expand" button allows the user to see the full list.

### Phase 4: Dual Strategy (Final Implementation)

- A conditional rendering strategy was implemented.
  - For lists of **less than 15 servers**, the simple pagination dropdown is used.
  - For a **full list of 15 servers**, the `VirtualizedServerList` with the "Show More" button is used.

---

## 2. Comparison of Strategies

### `react-window` (Abandoned)

- **Reason for attempting**: It theoretically offers the best performance for hundreds or thousands of items by only rendering what is visible.
- **Reason for abandoning (after 52 minutes)**:
  - **Over-engineering**: For a list of only 15 items, the complexity of a virtualization library was not justified.
  - **Poor UX**: It required a fixed item height (350px), which prevented a fully responsive design. The virtualized scroll experience also felt less natural than a native scroll.
  - **Dependency Bloat**: It added an unnecessary 13KB (minified) to the bundle.
- **Conclusion**: The trade-off of implementation complexity vs. performance gain was not worth it for a small list. The "Show More" button provides a better, more natural UX.

### "Show More" Button (`VirtualizedServerList`)

- **Pros**:
  - **Excellent initial performance**: Only renders the first row (e.g., 4-5 cards), leading to a fast First Contentful Paint (FCP).
  - **Responsive Design**: Dynamically adjusts the number of cards per row.
  - **Good UX**: An intuitive and common pattern for expanding lists.
- **Cons**:
  - **Complex Logic**: Requires manual handling of window `resize` events to recalculate the grid.
  - **State Management**: Needs to manage `expanded` and `cardsPerRow` state.

### Dual Strategy (Current)

- **Pros**:
  - **Flexibility**: Provides the best of both worlds, using a simple, performant method for small lists and the more advanced "Show More" for the full list.
  - **Balanced Performance**: Optimized for all list sizes.
- **Cons**:
  - **Implementation Complexity**: Maintains two different rendering paths.
  - **Slightly Inconsistent UX**: The UI behavior changes when the user selects the "show all" option.
- **Conclusion**: This is the best compromise for the current requirements, providing optimal performance and a good user experience across all scenarios.

---

## 3. Key Takeaways & Future Considerations

- **`react-window` is not a silver bullet**: It is a powerful tool, but it should only be used when dealing with hundreds or thousands of list items where the performance benefits clearly outweigh the implementation complexity.
- **Debounce `resize` events**: The report suggests adding a `debounce` to the `resize` event listener in `VirtualizedServerList` to improve performance during window resizing.
- **Re-evaluate at scale**: The decision to abandon `react-window` was based on a maximum of 15 servers. If this number is expected to grow significantly (e.g., to 30+), `react-window` should be reconsidered.
