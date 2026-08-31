# Runtime and Motion Contract

## Route minimization

The observability layer accepts only a minimized application route:

- Input may be a current browser location or an explicit route string.
- Output contains a normalized pathname and only approved navigation key/value pairs.
- URL fragments and every unknown key/value pair are discarded.
- Both the in-memory flight recorder and persisted severe-performance snapshot use the same sanitizer.
- Reading a legacy snapshot returns and stores a sanitized route without changing its valid mode/timing fields.
- No external sink is introduced.

Negative controls must include code, state, access_token, refresh_token, token_hash, provider_token, email, zenflowAuthAttempt, error, journalReset, an arbitrary unknown value, duplicate parameters, and a fragment.

## Schedule motion

The existing reactive useShouldAnimate decision is obtained at the reachable Schedule owner and passed explicitly to ambient-loop owners.

When motionAllowed is true or omitted:

- every existing animation array and transition value remains exactly unchanged;
- no layer, color, geometry, event, text, z-index, safe-area rule, or interaction changes.

When motionAllowed is false:

- indefinite opacity, color, shadow, scale, rotation, and related ambient loops render a stable accessible frame;
- repeat Infinity is absent;
- event meaning and current-time meaning remain visible without relying on motion;
- one-shot functional entrances are not altered unless the same gate already owns them.

## Android debug configuration

- Empty debug AdMob application ID fails during configuration with an actionable, non-secret message.
- No Google sample/test application ID exists in tracked runtime configuration.
- Release validation is neither weakened nor bypassed.
- The regression proof uses only an injected syntactically valid non-secret placeholder in isolated tooling; it is not written to production source or a bundle.

## Proof boundary

Unit/static contracts prove data minimization and prop policy. They do not prove browser pixels, installed native behavior, assistive-technology usability, artistic quality, public deployment, or store readiness. Those rows require fresh runtime evidence or remain UNVERIFIED.

