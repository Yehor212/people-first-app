---
description: Hook pattern rules — applies to src/hooks/**/*.{ts,tsx}
---

# Hook Pattern Rules

- No side effects beyond React lifecycle (useEffect, useLayoutEffect)
- Ref pattern for stable listeners — see `useAuthSession` for reference
- Hook naming: `use[Feature].ts` (one hook per file)
- No store creation inside hooks — stores are in `src/stores/`
- `exhaustive-deps` suppressions must be intentional and commented
- Custom hooks should be composable — avoid deep nesting
- Cleanup functions required for subscriptions, timers, and event listeners
