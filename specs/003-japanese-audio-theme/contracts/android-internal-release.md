# Android Internal Release Contract

## Preconditions

- The owner has approved all ten exact audio hashes.
- Feature and full release gates pass with no task-attributable failure.
- The PR is merged and local `main` exactly equals `origin/main`.
- The maximum existing Play version code is inspected immediately before choosing the new code.
- The existing authorized upload key is available without exposing its secret material.

## Artifact Binding

Record package name, version name/code, source commit, AAB path/hash, signing-certificate digest, and the generated delivery APK/base hash used for runtime verification.

## Console Boundary

- Upload only the exact bound AAB.
- Select only Internal testing.
- Do not promote to Closed, Open, or Production.
- Release notes describe the ten-track optional music control and softer theme change without therapeutic, cultural-authenticity, or unsupported performance claims.
- Obtain action-time owner confirmation before the final rollout action.
- After rollout, verify version code, status, track, artifact identity, and tester availability; record any processing or rejection state truthfully.
