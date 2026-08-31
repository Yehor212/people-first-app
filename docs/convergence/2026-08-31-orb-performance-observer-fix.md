# Orb Visual-Ready Measurement Fix — 2026-08-31

## Trigger

The same released application tree produced three conflicting CI observations around the 2,500 ms Orb visual-ready budget:

- main first run: 2,561.5 ms (`FAIL`);
- main failed-job rerun: `PASS`;
- PR #86 first run: 2,505.6 ms (`FAIL`);
- PR #86 failed-job rerun: 2,501.1 ms (`FAIL`).

PR #85 changed only Python audio-review evidence, and PR #86 changed durable habit completion. Neither changed `ValenceOrb`, `MiniValenceOrb`, WebGPU/WebGL renderers, shaders, or the visual-ready marker.

## Root Cause

The application sets `data-orb-visual-ready="true"` on the first real rendered frame. The performance test waited for that attribute through Playwright polling and then called `performance.now()` in a second round trip. The wait could resolve successfully before its 2,500 ms timeout while the later observation added 1–61 ms of polling/transport latency. The duplicated assertion therefore measured Playwright observation delay, not the DOM event that defines application readiness.

## Fix

- Install a page-local `MutationObserver` immediately after `domcontentloaded`.
- Record `performance.now()` in the page at the exact mutation that makes the ready marker observable.
- Keep the existing Playwright `waitFor` as an independent user-visible timeout.
- Read the recorded page timestamp after the marker is present.
- Keep `MAX_ORB_VISUAL_READY_MS` unchanged at 2,500 ms.
- Change no application, renderer, animation, visual, or runtime code.

## Verification

- Test-first workflow contract: expected RED before the observer helpers existed; 35/35 passed after implementation.
- TypeScript and scoped ESLint passed.
- Three consecutive exact staged release-artifact runs passed with observed application-ready times:
  - 852.5 ms;
  - 829.7 ms;
  - 832.8 ms.
- Each run retained `--workers=1 --retries=0` and the 2,500 ms budget.

This fixes measurement accuracy; it does not weaken performance acceptance.
