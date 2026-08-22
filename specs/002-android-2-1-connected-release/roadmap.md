# Spec of Specs Roadmap

The existing `002-android-2-1-connected-release` feature remains the umbrella recovery record. Future implementation should be split into bounded sub-specs after owner authorization; this audit does not create implementation branches or migrate code.

| Slice | Future sub-spec | User failure addressed | Depends on | Exit / kill criterion | Current state |
|---|---|---|---|---|---|
| R0 | recovery-isolation-and-evidence | dirty mixed work is mistaken for a releasable candidate | owner authorizes clean lane | exact manifest and attribution; stop on unexplained files | PLANNED |
| R1 | authoritative-schema-and-types | local/remote data contracts drift and corrupt sync/release claims | R0, G-013 | generated types, migration/RLS, sync/tombstone/rollback proof | BLOCKED |
| R2 | core-save-and-interruption-safety | habit/journal action is lost, duplicated or interrupted by ads/lifecycle | R0–R1 | save independent of ads/network; restart/process-death proof | PLANNED |
| R3 | android-api36-navigation-reflow | Back/layout/IME/RTL/large text traps users | R0–R2 | five destinations, all overlays, eight locales, API 36 matrix | PLANNED |
| R4 | exact-aab-and-internal-track | tested source differs from shipped artifact | R1–R3, G-014–G-019 | one signed hash, splits/upgrade/profiles/symbols, internal evidence | BLOCKED |
| R5 | play-legal-store-truth | console/declarations/legal copy contradict runtime | selected candidate, G-008/G-009/G-016/G-017 | exact-candidate truth matrix and qualified approvals | BLOCKED |
| R6 | operations-and-staged-rollout | unhealthy build expands without ownership/rollback | R4–R5, G-021–G-024 | operator/alerts/halt/replacement; same-hash 10/50/100 | BLOCKED |
| S1 | all-ages-public-social-safety | discovery/ranking/invites expose children/users to abuse | G-005–G-011 | threat model/control plan accepted; child/unknown remains OFF otherwise | ASK |
| S2 | social-data-and-authorization | IDOR/enumeration/replay/forged ranks create unsafe state | S1 | RLS/RPC/rate limits/idempotency/moderation evidence | BLOCKED |
| S3 | social-experience-and-qr | links/QR cause hidden writes, unsafe camera or fabricated records | S1–S2, G-010 | inert decode + explicit confirm + all states/locales/platforms | BLOCKED |
| M1 | non-orb-motion-inventory-baselines | animation obscures meaning or leaks lifecycle resources | G-012 only after concepts | inventory/baseline/concept pack; stop before implementation | PLANNED |
| M2 | selected-motion-implementation | unapproved/generic motion harms craft/accessibility/performance | M1 owner selection | technical/runtime/craft/motion gates separated | BLOCKED |
| A1 | monetization-decision | ads invent value or exploit sensitive moments | G-001 | owner selects A/B/C; otherwise OFF | ASK |
| A2A | genuine-reward-product-discovery | option A lacks user value/economy/safety | A1=A, G-002 | product acceptance/kill criteria approved | BLOCKED |
| A2B | voluntary-nonreward-ad-feasibility | option B format is mislabeled or policy-unsafe | A1=B, G-003 | exact format passes policy/UX/legal/all-ages analysis | BLOCKED |
| A2C | ads-off-hardening | option C or undecided state accidentally initializes/requests | A1=C or safe default | fail-closed proof across platforms/lifecycle | PLANNED after authorization |

## Dependency logic

- `R0 → R1 → R2 → R3 → R4 → R5 → R6` is the core Android release path.
- `S1 → S2 → S3` is a separate high-risk program. It does not enter core release merely because UI files already exist.
- `M1 → owner selection → M2` is the non-orb craft path. The orb remains frozen.
- `A1` branches into one option only. A reward product and an honest non-reward ad format are not interchangeable.
- Ads OFF is the default and cannot block R0–R6.
- Public social/QR, monetization and motion can be omitted from the deadline candidate only when their gates are demonstrably OFF and store/legal truth reflects the shipped candidate.

## Proof progression

Each implementation sub-spec must independently follow:

`current failure → RED or characterization baseline → minimal authorized change → same evidence GREEN → blast-radius checks → platform/runtime evidence → exact-artifact binding where applicable → owner/external gate → release evidence`

Plans, static checks, old receipts, console metadata and specialist summaries do not skip any arrow.
