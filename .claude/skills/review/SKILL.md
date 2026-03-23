---
name: review
description: Deep code review with forced categorical decomposition — checks security, logic, i18n, accessibility, performance separately
user-invocable: true
---

# Code Review Skill

When the user invokes /review [file-or-PR], perform a systematic review:

## Forced Categorical Decomposition (UBC FSE 2025, +43.67% F1)

Do NOT ask "what's wrong?" — check EACH category SEPARATELY:

### 1. SECURITY
- SQL/XSS/injection vulnerabilities
- Hardcoded secrets, API keys
- Auth bypass vectors
- Use Snyk MCP tools if available: `snyk_test`, `snyk_sast`

### 2. LOGIC
- Off-by-one errors
- Race conditions (Law 25)
- Null/undefined handling
- Edge cases: empty arrays, 0, negative, max values

### 3. STATE
- Zustand mutations via set() only
- IndexedDB ↔ Zustand consistency
- Deletion tracker IDs never reused

### 4. i18n
- All strings via translation keys
- RTL layout considered (ar, he)
- 8 languages: en, uk, es, de, fr, ja, ar, he

### 5. ACCESSIBILITY (Law 9)
- ARIA labels on interactive elements
- Touch targets ≥ 44px
- Keyboard navigation
- Screen reader support

### 6. PERFORMANCE (Law 8)
- 60fps animations (transform + opacity only)
- useMemo for expensive computations
- Lazy loading for heavy components
- No unnecessary re-renders

### 7. PLATFORM (Law 10)
- Android back handler on modals
- Safe area insets
- -webkit-backdrop-filter prefix
- prefers-reduced-motion respected

## Output Format

```
## Code Review: [file]

### SECURITY: PASS/FAIL
- [findings]

### LOGIC: PASS/FAIL
- [findings]

### STATE: PASS/FAIL
- [findings]

### i18n: PASS/FAIL
- [findings]

### ACCESSIBILITY: PASS/FAIL
- [findings]

### PERFORMANCE: PASS/FAIL
- [findings]

### PLATFORM: PASS/FAIL
- [findings]

### VERDICT: APPROVE / CHANGES REQUESTED
```
