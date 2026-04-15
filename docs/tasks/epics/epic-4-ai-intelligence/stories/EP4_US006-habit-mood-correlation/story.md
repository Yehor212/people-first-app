# EP4_US006: Habit-Mood Correlation

**Epic:** [Epic 4 - AI Intelligence, Insights & Emotional Mirror](../../epic.md)
**Priority:** Medium
**Status:** Backlog
**Labels:** user-story
**Created:** 2026-04-14

---

## Story

**As a** journaler

**I want** to see which activities correlate with better mood

**So that** I can make informed lifestyle choices based on my own data

---

## Context

### Current Situation
- Users log mood and activities but see no relationship between them
- No analytics show which habits are associated with better or worse mood
- Users must guess which activities help — no data-driven insight

### Desired Outcome
- Analytics chart showing activity → average mood correlation
- Active toggle grid in quick check-in for tracking activities
- Bar chart visualization: activity name → average mood when that activity is logged
- Requires 14+ days of data before showing results (statistical significance)
- Clear "correlation" language — never says "causes"

---

## Acceptance Criteria

### Main Scenarios

- **Given** a user has logged mood and activities for 14+ days
  **When** they open the Habit-Mood Correlation section in Stats
  **Then** a bar chart displays each tracked activity with its average associated mood score, sorted by strongest positive correlation

- **Given** the correlation chart is displayed
  **When** the user taps on a specific activity bar
  **Then** a detail view shows: number of days tracked, average mood on those days vs overall average, and a "correlation, not causation" disclaimer

- **Given** a user logs activities via the quick check-in toggle grid
  **When** they toggle activities on/off for today
  **Then** the selections are saved and included in future correlation calculations

### Edge Cases

- **Given** a user has fewer than 14 days of combined mood + activity data
  **When** they navigate to the Habit-Mood Correlation section
  **Then** a message shows "Track your mood and activities for X more days to see correlations" with a progress bar

### Error Handling

- **Given** an activity has been logged fewer than 3 times in 14 days
  **When** the correlation chart is generated
  **Then** that activity is excluded from the chart with a note: "Some activities need more data points"

---

## Implementation Tasks

Tasks created via ln-300-task-coordinator after ln-310-multi-agent-validator.

---

## Test Strategy

> [!NOTE]
> This section is intentionally **empty** at Story creation.
> Tests are planned later by **test planner** after manual testing passes (quality gate Pass 1).

*Test planning deferred to execution phase.*

---

## Technical Notes

### Orchestrator Brief
<!-- ORCHESTRATOR_BRIEF_START -->
| Aspect | Value |
|--------|-------|
| **Tech** | React, Dexie, Chart library, Zustand |
| **Key Files** | `src/components/HabitCorrelationChart.tsx`, `src/hooks/useHabitCorrelation.ts`, `src/services/correlationEngine.ts` |
| **Approach** | Calculate Pearson/Spearman correlation from 14+ days of activity+mood data, render bar chart |
| **Complexity** | Medium (statistics engine + chart) |
<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture Considerations
- Layers affected: Service (correlationEngine.ts), Hook (useHabitCorrelation.ts), UI (chart + toggle grid)
- Patterns: Computed cache in Dexie (`habitMoodCorrelations` table), recalculate on new data
- Side-effect boundary: Creates new `habitMoodCorrelations` cache table in Dexie
- Orchestration depth: 1 level (data query → correlation calculation → chart render)
- Constraints: Never use "causes" language — always "correlates" or "associated with"

### Library Research

**Primary libraries:**
| Library | Version | Purpose | Docs |
|---------|---------|---------|------|
| Dexie.js | v4.x | Store correlation cache + activity logs | dexie.org |

**Key APIs:**
- `correlationEngine.calculate(moodData, activityData, days)` — compute Pearson/Spearman correlation
- `db.habitMoodCorrelations.put(cache)` — cache computed correlations

**Key constraints:**
- Minimum 14 days of data required before showing any correlations
- Activities with < 3 occurrences excluded (insufficient sample size)
- Correlation values range -1 to +1; display as human-readable labels (Strong positive, Weak, etc.)
- Cache invalidation: recalculate when new mood/activity data is added

**Standards compliance:**
- Statistical significance: 14-day minimum, 3+ occurrences per activity
- Ethical data presentation: "correlation, not causation" disclaimer on every view

### Integration Points
- **External Systems**: None (fully local)
- **Internal Services**: Existing mood data + activity data from Dexie, JournalStats.tsx (embed chart)
- **Database**: New `habitMoodCorrelations` cache table, existing mood + activity tables

### Performance & Security
- Correlation calculation < 1 second for 90 days of data
- Cache results to avoid recalculation on every view
- All data local — no privacy concerns

---

## Definition of Done

### Functionality
- [ ] All acceptance criteria met (main + edge cases + errors)
- [ ] Logging added appropriately

### Testing
- [ ] All implementation tasks completed
- [ ] Test task created and completed (by test planner)
- [ ] All tests passing

### Code Quality
- [ ] Code reviewed and approved
- [ ] Follows project patterns
- [ ] Performance meets requirements
- [ ] Documentation updated
- [ ] All affected existing code refactored
- [ ] All existing tests updated and passing

---

## Dependencies

### Depends On
- **Epic 1**: Entry types + activities data (provides structured activity tracking)

### Blocks
- None

---

## Assumptions

| ID | Category | Assumption | Confidence | Validated | Invalidation Impact |
|----|----------|------------|------------|-----------|---------------------|
| A1 | DEPENDENCY | Epic 1 activity data schema is available and populated | MEDIUM | NO | Need to define activity schema independently |
| A2 | DATA | Users log activities consistently enough for meaningful correlations | MEDIUM | NO | Need to prompt users to log activities more regularly |
| A3 | FEASIBILITY | Pearson/Spearman correlation is appropriate for mood (ordinal) × activity (binary) data | HIGH | NO | May need point-biserial correlation instead |
| A4 | SCOPE | Correlation chart is read-only analytics — no predictive features | HIGH | NO | Would need ML pipeline |
