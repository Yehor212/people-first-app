# Law 16 — SELF-REFLECTION & RECURSIVE VERIFICATION (THE MIRROR LAW)

> "An agent that cannot audit itself is an agent that ships bugs with confidence."

## Core Principle

You are STRICTLY FORBIDDEN from declaring ANY task complete without first executing a structured self-reflection pass. This law applies to the Lead Agent AND every sub-agent (Explore agents, parallel auditors, fixers). Self-reflection is not optional introspection — it is a mandatory verification protocol with concrete checkpoints.

---

## PART 1 — THE FIVE MIRRORS (Mandatory Self-Checks)

After completing ANY implementation or audit, you MUST pass through all five mirrors sequentially. Failure at ANY mirror means the task is NOT complete.

### Mirror 1 — THE BRANCH MIRROR (Dead Path Detection)
**Question**: "Did I verify EVERY conditional branch, switch case, and early return?"

**Protocol**:
- For every `if/else if` chain: count the conditions. Count the handled cases. Are they equal?
- For every `switch`: does it have a `default`? Are all enum/union values covered?
- For every handler map (e.g., `CTA_CONFIG` + `handleAction`): do the keys in the config match the cases in the handler 1:1?
- For every early `return`: what happens when the condition is NOT met? Is the fallthrough path correct?

**Anti-pattern this prevents**: TodayFocusCard had `CTA_CONFIG` with 4 keys (`mood`, `habits`, `focus`, `gratitude`) but `handleAction` only handled 3. The `focus` case silently did nothing.

**Evidence requirement**: List every branch structure found. For each, state: "N conditions, N handled. PASS." or "MISMATCH at file:line — BUG."

### Mirror 2 — THE BOUNDARY MIRROR (Contract Consistency)
**Question**: "Do ALL numerical boundaries, validation limits, and thresholds agree across the entire pipeline?"

**Protocol**:
- For every validation schema (Zod, regex, maxLength): trace the number through UI → validation → error message → database constraint.
- `maxLength={500}` on textarea MUST match `z.string().max(500)` in schema MUST match `> 500` in error display logic.
- Timeouts, retry counts, debounce values — verify they're not contradicted by other code paths.

**Anti-pattern this prevents**: GratitudeJournal had `maxLength={500}` and `z.string().max(500)`, but the error message checked `> 2000`. Users typing 501-2000 chars saw "Invalid input" instead of "Text too long."

**Evidence requirement**: For each validation pipeline, state: "UI limit = X, schema limit = X, error threshold = X. MATCH/MISMATCH."

### Mirror 3 — THE INTERACTION MIRROR (Cross-Component Interference)
**Question**: "Did I verify what happens when Component A and Component B are BOTH active simultaneously?"

**Protocol**:
- For every hook/effect that modifies global state (body styles, document listeners, DOM attributes): trace ALL consumers.
- If `useScrollLock` is called by both parent and child, what happens when child unmounts first? When parent unmounts first? Both at once?
- If two modals can be open simultaneously, do their keyboard handlers (Escape), back handlers (Android), and scroll locks compose correctly?

**Anti-pattern this prevents**: SettingsPanel + DopamineSettings both called `useScrollLock`. When DopamineSettings closed, it restored body styles to pre-SettingsPanel state, killing ALL touch events on iPhone.

**Evidence requirement**: For each global-state-modifying hook, list ALL consumers and state: "N consumers found. Concurrent scenario verified: [description]. PASS/FAIL."

### Mirror 4 — THE SILENCE MIRROR (Error Path Audit)
**Question**: "For EVERY `catch` block and error handler, does the user receive clear feedback?"

**Protocol**:
- Grep for `catch`, `.catch(`, `onError`, `onRejected` in the scope.
- For each: Does it (a) log AND (b) inform the user via UI (toast, error state, announce)?
- `logger.error()` alone is NEVER sufficient — that's developer feedback, not user feedback.
- Exception: Decorative/optional features (ambient animations, optional analytics) where failure is invisible to user by design — these must be explicitly annotated with `// graceful: [reason]`.

**Anti-pattern this prevents**: Leaderboard opt-in toggle caught errors with `logger.error()` only. User saw the switch snap back with zero explanation.

**Evidence requirement**: For each catch block, state: "file:line — user feedback: [toast/announce/error state/graceful]. PASS/FAIL."

### Mirror 5 — THE ADVERSARY MIRROR (Devil's Advocate)
**Question**: "If I were trying to BREAK this code, what would I do?"

**Protocol**:
- **Rage-click test**: What if the user taps the same button 10 times rapidly?
- **Disconnect test**: What if the network drops mid-operation?
- **Back-button test**: What if the user presses back/Escape at every possible step?
- **RTL test**: Are all directional icons (`ChevronRight`, arrows) flipped?
- **320px test**: Does the layout work on the smallest supported screen?
- **Keyboard-only test**: Can every interactive element be reached and activated without touch/mouse?

**Anti-pattern this prevents**: Generic "it looks fine" approval without actually stress-testing edge cases.

**Evidence requirement**: For each test, state: "Simulated [scenario] — result: [OK/BUG at file:line]."

---

## PART 2 — SUB-AGENT REFLECTION PROTOCOL

When using Explore agents or parallel sub-agents, the following rules apply:

### 2.1 — Sub-Agent Output Requirements

Every sub-agent MUST include in its report:
1. **Evidence trail**: Every finding must cite `file:line` with the EXACT problematic code snippet.
2. **Confidence level**: `CERTAIN` (verified against code) / `PROBABLE` (pattern-based, needs lead verification) / `SPECULATIVE` (might be false positive).
3. **Disproof attempt**: Before reporting a bug, the sub-agent MUST spend at least one step trying to prove it's NOT a bug (check if autoprefixer handles it, check if native elements already handle keyboard, check if a parent component provides the missing functionality).
4. **Scope declaration**: Explicitly state what was checked AND what was NOT checked. "I audited files X, Y, Z. I did NOT check: [list]."

### 2.2 — Lead Agent Cross-Verification (MANDATORY)

The Lead Agent is STRICTLY FORBIDDEN from presenting sub-agent findings to the user without first:
1. **Reading the actual file** at the cited line — not trusting the sub-agent's description.
2. **Verifying the claim** against project conventions (e.g., does autoprefixer handle it? Does the component framework provide it?).
3. **Checking for context** the sub-agent might have missed (parent components, HOCs, CSS inheritance, PostCSS plugins).
4. **Classifying each finding** as: `CONFIRMED BUG` / `FALSE POSITIVE (reason)` / `NEEDS MORE INVESTIGATION`.

**FORBIDDEN**: Echoing sub-agent findings verbatim. Every finding must pass through the Lead Agent's own judgment filter.

### 2.3 — The Overlap Rule

If two sub-agents audit overlapping scopes, the Lead Agent MUST:
- Cross-reference their findings for contradictions (one says BUG, another says PASS for the same code).
- Resolve contradictions by reading the code directly.
- Ensure the UNION of all sub-agent scopes covers 100% of the target (no gaps between them).

---

## PART 3 — POST-IMPLEMENTATION REFLECTION

After writing ANY fix, BEFORE declaring it complete:

### 3.1 — Re-read Own Changes
Read back every modified file. Verify:
- The edit actually addresses the root cause (not just a symptom).
- No typos, no missing imports, no broken syntax.
- The fix doesn't introduce a NEW violation of Laws 1-26.

### 3.2 — Regression Imagination
For each change, ask: "What ELSE uses this code path?"
- If I changed a shared hook, what other components call it?
- If I changed a type/interface, does it break any callers?
- If I added a prop, is it passed from ALL parents (not just the one I checked)?

### 3.3 — The "User Would Say" Test
Mentally simulate the user encountering the fixed flow:
- Does the user see a clear, satisfying result?
- Is there any moment of confusion, delay, or ambiguity?
- Would the user NOTICE the fix was applied, or does it just silently work (which is correct for most bug fixes)?

---

## PART 4 — THE CONFESSION PROTOCOL

If self-reflection reveals a mistake in your own prior output:

1. **Admit immediately.** Do not rationalize, minimize, or hide the error.
2. **State what went wrong.** "I failed Mirror 3 — I checked useScrollLock in isolation but did not verify cross-component interaction."
3. **State the impact.** "This allowed the iPhone touch-death bug to survive the first audit."
4. **Fix it.** Apply the correction before continuing with any other work.
5. **Update your approach.** Add the failure pattern to your mental checklist for future passes.

**FORBIDDEN**: Post-hoc rationalization ("it was a minor issue", "it would have been caught by tests"). If the Mirror caught it, it was real. Own it.

---

## PART 5 — REFLECTION TIMING

| Event | Required Mirrors |
|-------|-----------------|
| After completing a single bug fix | Mirror 1 + Mirror 4 (minimum) |
| After completing a batch of fixes | All 5 Mirrors |
| After a full tab/feature audit | All 5 Mirrors + Part 2 (if sub-agents used) |
| After presenting findings to user | Mirror 5 (Adversary) on your own report |
| When user says "why didn't you catch this?" | Part 4 (Confession) + identify which Mirror failed |

---

## SUMMARY DIRECTIVE

The Mirror Law transforms the agent from a "fire-and-forget" executor into a self-correcting system. The cost of 30 seconds of self-reflection is INFINITELY lower than the cost of shipping a bug to a live user on Google Play. You do not have the luxury of "good enough" — you have the obligation of "verified correct."

**The agent that reflects catches its own bugs. The agent that doesn't reflects the user's frustration.**

---

## Cross-References

- **Amplifies**: All Laws 1-26 (self-verification gate before work is declared complete)
- **Mirror 4 (Silence)** → Law 5 (Loud Failure — every catch has user feedback?)
- **Mirror 5 (Adversary)** → Law 9 (Accessibility — keyboard-only, 320px, RTL), Law 10 (Cross-Platform — iOS/Android/Desktop)
- **Verified by**: Law 23 Post-Flight (Mirror Protocol is mandatory in POST-FLIGHT)
