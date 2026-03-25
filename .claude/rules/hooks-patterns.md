---
description: Hook pattern rules — applies to src/hooks/**/*.{ts,tsx}
---

# Hook Pattern Rules

- Keep side effects within React lifecycle only (useEffect, useLayoutEffect)
- Ref pattern for stable listeners — see `useAuthSession` for reference
- Hook naming: `use[Feature].ts` (one hook per file)
- Define all stores in `src/stores/` — hooks consume stores, they do not create them
- `exhaustive-deps` suppressions must be intentional and commented
- Custom hooks should be composable — prefer flat composition over deep nesting
- Cleanup functions required for subscriptions, timers, and event listeners
