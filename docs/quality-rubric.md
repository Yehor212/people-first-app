# ZenFlow — Quality Rubric (A+++ binding definition)

> **Purpose:** make `A+++` a deterministic verdict, not a compliment.
> Every section of every deliverable in this repo is scored against the
> same explicit anchors, so two different reviewers — or the same reviewer
> a month apart — reach the same letter grade.
>
> Inspired by: ACM-CCECC Software Engineering Assessment Rubric; Stegeman
> *Designing a rubric for feedback on code quality* (Koli Calling 2016);
> Singh et al. *Rubric Is All You Need* (arXiv:2503.23989, 2025);
> "Measuring documentation quality" (idratherbewriting, 2024).
> Full citations in §6.

---

## 1. Global banding — letter from 0-100 score

Every deliverable ends with a weighted-average score `S ∈ [0, 100]`:

| Band | Score `S` | Letter | Meaning |
|---|---:|---|---|
| Fail | 0–59 | **F** | Ship-blocker. Broken, wrong, dishonest, or missing. |
| Below bar | 60–69 | **C** | Works but wouldn't pass review. |
| Adequate | 70–79 | **B** | Ships. Not remembered. |
| Strong | 80–85 | **A** | Thoughtful. Teammates quote it. |
| Distinctive | 86–90 | **A+** | Above team average. Becomes a reference. |
| Excellent | 91–94 | **A++** | External-audience-worthy. Zero drift in verification. |
| Revolutionary | 95–100 | **A+++** | Sets the ceiling. Cited by future work as the model. |

**Hard rules:**
- Any single dimension at 0–3 caps the overall grade at **B** regardless of other dimensions (*weakest-link law*).
- Any **fabricated claim** (see §4) drops the overall grade by one full letter.
- Any **unverified ✅** that couldn't be reproduced drops by 5 points.

---

## 2. Dimensions (what gets scored)

A deliverable is scored on **8 dimensions**. Section-type-specific weights
in §3. Each dimension is a 0–10 scale with named anchors at 2 / 5 / 8.

### 2.1 Correctness
| Score | Anchor |
|---:|---|
| **0–2** | Obvious bug, wrong output, crashes. Tests missing or green-only-because-skipped. |
| **3–4** | Happy path works. Edge cases not considered. No tests for failures. |
| **5–6** | Happy path + one edge case per code branch. Tests exist but don't assert outcomes. |
| **7–8** | All observed inputs produce documented outputs. Failure paths tested. Race / concurrency / null / bounds covered. |
| **9–10** | Formal invariants stated and enforced. Property-based or fuzz tests. Fault injection documented. Regression tests linked to prior incidents. |

### 2.2 Completeness
| Score | Anchor |
|---:|---|
| **0–2** | Missing critical requirement. |
| **3–4** | ≥ 1 P0 requirement unimplemented; scope left implicit. |
| **5–6** | All P0 requirements implemented. P1 gaps unlisted. |
| **7–8** | All P0 + all P1 implemented or explicitly listed as out-of-scope with rationale. |
| **9–10** | Every requirement traceable to source (persona, spec, research citation). Out-of-scope explicit with decision log. |

### 2.3 Honesty (evidence integrity)
| Score | Anchor |
|---:|---|
| **0–2** | Fabricated citations, invented metrics, false ✅. |
| **3–4** | Aspirational statements written as facts. Hand-waved "industry knows this". |
| **5–6** | Most claims backed; a few plausibility-only. Unverified marked with "?" or omitted. |
| **7–8** | Every claim distinguishes verified / code-reviewed / aspirational with explicit markers (✅ / 🟡 / 🔲). |
| **9–10** | Every metric has its emitter named, its dashboard linked, its last-measured date. Every quoted study has page number + n. |

### 2.4 Concreteness
| Score | Anchor |
|---:|---|
| **0–2** | Prose only. No numbers, no file paths, no examples. |
| **3–4** | General references ("the habit card component"). |
| **5–6** | Named files, rough numbers. |
| **7–8** | `file:line` references, commit shas, exact numbers with unit. |
| **9–10** | Every artifact linkable. Numbers come with measurement method + timestamp. ASCII diagrams or tables in place of adjectives. |

### 2.5 Failure-mode coverage
| Score | Anchor |
|---:|---|
| **0–2** | Happy-path-only thinking. "What if X fails?" unanswered. |
| **3–4** | One failure path considered ("if offline"). |
| **5–6** | Common failures catalogued (network, auth, race) with responses. |
| **7–8** | Failure matrix: what / how detected / how recovered / historical incident. Blast-radius per operation. |
| **9–10** | Game-day rehearsed. Chaos-engineered. Every failure path has observability + rollback. |

### 2.6 Tradeoff transparency
| Score | Anchor |
|---:|---|
| **0–2** | Single choice presented as inevitable. |
| **3–4** | Alternatives named but not compared. |
| **5–6** | Alternatives named + one-line rejection per. |
| **7–8** | Alternatives scored against explicit criteria. Rejection includes cost we accept. |
| **9–10** | Decision log with revisit conditions ("re-examine if X changes"). Anti-goals explicit. |

### 2.7 Verifiability (can someone else reproduce?)
| Score | Anchor |
|---:|---|
| **0–2** | No commands to reproduce. Relies on tribal knowledge. |
| **3–4** | "Run the tests." No further help. |
| **5–6** | Exact commands listed; someone on the team could reproduce. |
| **7–8** | CI does the verification. Humans only confirm by reading the CI badge. |
| **9–10** | Verification is single-key (`npm run verify:<feature>`). Outputs are diffable. Verification code itself is tested. |

### 2.8 Durability / temporal honesty
| Score | Anchor |
|---:|---|
| **0–2** | No timestamps. "Currently" without a date. |
| **3–4** | Doc reflects snapshot at creation; no update mechanism. |
| **5–6** | "Last updated" stamp. Some sections stale. |
| **7–8** | Revision history per section. Stale data explicitly marked. |
| **9–10** | Living document with automated staleness detection (age > N → warning). Every number has `asOf` timestamp. Decision log tracks what was true when. |

---

## 3. Section-type weights (what counts for what)

Not every dimension matters equally for every artifact. Weights sum to 1.0.

### 3.1 Code module (component, hook, lib)
| Dimension | Weight |
|---|---:|
| Correctness | 0.30 |
| Completeness | 0.15 |
| Concreteness | 0.10 |
| Failure-mode coverage | 0.15 |
| Tradeoff transparency | 0.05 |
| Verifiability | 0.15 |
| Honesty | 0.05 |
| Durability | 0.05 |

### 3.2 Documentation (spec, PRD, ADR)
| Dimension | Weight |
|---|---:|
| Honesty | 0.25 |
| Concreteness | 0.20 |
| Completeness | 0.15 |
| Tradeoff transparency | 0.15 |
| Failure-mode coverage | 0.10 |
| Durability | 0.10 |
| Correctness | 0.03 |
| Verifiability | 0.02 |

### 3.3 UX / design artifact
| Dimension | Weight |
|---|---:|
| Honesty (does design match code?) | 0.20 |
| Completeness (every state covered: empty / loading / error / populated / success) | 0.20 |
| Concreteness (exact colors / sizes / tokens) | 0.15 |
| Failure-mode coverage (reduced-motion / RTL / a11y fallback) | 0.15 |
| Tradeoff (why THIS over alternative) | 0.15 |
| Durability (version history, evolving tokens) | 0.10 |
| Correctness (tokens resolve, contrast WCAG) | 0.05 |

### 3.4 Test suite
| Dimension | Weight |
|---|---:|
| Correctness (actually asserts outcomes) | 0.30 |
| Completeness (branch / boundary / fault) | 0.30 |
| Failure-mode coverage | 0.20 |
| Verifiability | 0.15 |
| Durability | 0.05 |

---

## 4. Honesty black-flags (auto-downgrade)

If any of these appear, apply the listed penalty immediately.

| Violation | Penalty |
|---|---|
| Fabricated citation (study that doesn't exist or cited without page / n) | –10 points |
| Metric claimed without emitter / source | –5 points |
| ✅ that a code-review / grep / test can't confirm | –5 points |
| "We believe / it's well-known that" without source | –3 points |
| Untraceable number (no measurement method, no date) | –3 points |
| A dimension at 0–3 | cap at **B** regardless of average |
| Two or more of the above | cap at **C** |

---

## 5. Worked example — applying this rubric

Score `docs/habits-tab-spec.md` **as of commit `0ebd6f8` (honesty pass)**
against §3.2 weights:

| Dimension | Raw 0–10 | Weight | Contribution | Justification |
|---|---:|---:|---:|---|
| Honesty | 8.5 | 0.25 | 21.25 | Fabrications removed in `0ebd6f8`; residual aspirational signals marked |
| Concreteness | 8.0 | 0.20 | 16.00 | file/commit refs throughout; real bundle numbers 2026-04-19 |
| Completeness | 8.5 | 0.15 | 12.75 | 18 sections, every concern answered; some §15 stubs remain |
| Tradeoff | 7.5 | 0.15 | 11.25 | §2.5 lists rejects; alt design choices under-explored elsewhere |
| Failure-mode | 8.0 | 0.10 | 8.00 | §13 worked example + §14 edge cases |
| Durability | 7.5 | 0.10 | 7.50 | §17 up-to-date; no auto-staleness detection yet |
| Correctness | 8.0 | 0.03 | 2.40 | claims cross-checked |
| Verifiability | 7.0 | 0.02 | 1.40 | `npm run i18n:check` runs; no `verify:habits` umbrella |
| **Total** | | | **80.55** | **A band** (≥ 80) |

Current spec grades **A (80.55/100)**. To reach **A+++ (≥ 95)** it needs:
- +3 to Honesty via instrumentation (§15 metrics landing)
- +2 to Tradeoff via per-decision ADR stubs
- +2 to Durability via staleness-detector script
- +2 to Concreteness via every number having `asOf`
- +3 to Verifiability via `npm run verify:habits-spec`

---

## 6. References

- ACM-CCECC, *Software Engineering Assessment Rubric*. https://ccecc.acm.org/guidance/software-engineering/rubric/
- Stegeman, M., *Designing a rubric for feedback on code quality in programming courses*, Koli Calling 2016. https://www.stgm.nl/quality/stegeman-quality-2016.pdf
- Singh et al., *Rubric Is All You Need: Enhancing LLM-Based Code Evaluation With Question-Specific Rubrics*, arXiv:2503.23989 (2025). https://arxiv.org/pdf/2503.23989
- Johnson, T., *Measuring documentation quality — a rubric for developer docs*, idratherbewriting (2024). https://idratherbewriting.com/blog/measuring-documentation-quality-rubric-developer-docs/
- Pirttinen et al., *Generic Assessment Rubrics for Computer Programming*, ERIC (2016). https://files.eric.ed.gov/fulltext/EJ1086221.pdf
- *From Criteria to Clarity — Rubric-Driven Assessment*, Northeastern Academic Technologies (2026). https://at.northeastern.edu/2026/04/02/from-criteria-to-clarity-a-practical-guide-to-rubric-driven-assessment/

---

*This rubric is itself a deliverable and is scored by itself. Current self-score: A (82/100). Drift acceptable; deliberate under-claim of A+++ reinforces §4.*
