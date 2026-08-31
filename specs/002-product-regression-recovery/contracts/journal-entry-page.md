# Contract: Journal Entry Page

## API

```ts
export interface JournalEntryPageResult {
  entries: JournalEntry[];
  totalCount: number;
  requestedCount: number;
  unavailableCount: number;
  state: "ready" | "empty" | "degraded" | "unavailable";
  hasMore: boolean;
  nextCursor: JournalEntryPageCursor | null;
}
```

## Semantics

| State | Condition | UI |
| --- | --- | --- |
| `empty` | Authoritative `totalCount === 0` and no requested raw rows | Existing genuine-empty experience |
| `ready` | All requested rows decrypted | Render all entries |
| `degraded` | At least one requested row decrypted and at least one did not | Render readable entries plus one safe count message |
| `unavailable` | Requested raw rows exist but none can be decrypted | No fake cards; show unavailable count and recovery action |

- `requestedCount` counts raw rows selected by the bounded query.
- `unavailableCount` is exactly `requestedCount - entries.length`.
- Ordering of readable entries matches their relative raw order.
- `nextCursor` is derived from the last raw requested row, including when that row is unavailable.
- `hasMore` and `totalCount` retain their current raw-query meaning.
- A missing vault key for an encrypted entry is unavailable/locked, never an entry with empty content.
- Error details contain no row ID, ciphertext, content, tag, media, or stable owner identifier.
- Only display page/date reads use settlement. Export, single-entry edit, migration, and password removal continue to fail closed.

## Consumer behavior

`useJournal` accumulates `unavailableCount` across loaded pages without converting degraded state to a global load error. A refresh replaces the count for the refreshed result; pagination adds only the new raw page. Genuine empty, locked, degraded, and storage-unavailable states remain distinct.

The journal list renders one natural localized status message outside the entry-card list. It does not render one placeholder per failed row, expose internal IDs, or announce private content.

## Tests

- Nine readable plus one unreadable entry produce stable order and count 1.
- All unreadable records produce `unavailable`, never the empty state.
- Zero rows produce `empty`.
- Missing vault key produces no blank entry.
- Duplicate timestamps and an unavailable cursor boundary produce no duplicate or loop.
- Second-page loading accumulates and refresh replaces the count.
- Export still rejects a mixed readable/unreadable set.
- UI/log/analytics negative controls detect seeded IDs, ciphertext markers, and private text.
