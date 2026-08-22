# UX and Security Requirement Checklist: PWA Shell Lifecycle

**Purpose**: Review whether the feature requirements define a usable, accessible, localized, privacy-bounded PWA shell before implementation.  
**Created**: 2026-08-09  
**Feature**: [PWA Shell Lifecycle](../spec.md)

## UX, accessibility, and localization requirement quality

- [x] CHK001 Are install/update/offline action states named so no action is advertised when the browser cannot honestly perform it? [Completeness, Spec §FR-003–FR-006]
- [x] CHK002 Are the visible waiting, blocked, failed, dismissed, and retry states distinguished rather than summarized as a generic update error? [Clarity, Spec §User Story 2 and §FR-006–FR-008]
- [x] CHK003 Are screen-reader names, keyboard focus, target size, reduced motion, safe area, and Android-back implications specified for every user-visible shell surface? [Coverage, Contract §Accessibility]
- [x] CHK004 Are all eight locale and both RTL requirements stated for manual install/update/offline text without fragment concatenation? [Localization, Spec §FR-004 and §FR-010]
- [x] CHK005 Is the manual Safari path explicitly separate from Chromium event availability, so requirements cannot create a false install affordance? [Consistency, Spec §FR-004]
- [x] CHK006 Does the offline fallback copy avoid asserting remote sync completion, including when all PWA clients are closed? [Agency and honesty, Spec §FR-010]

## Privacy, trust, and recovery requirement quality

- [x] CHK007 Is the service-worker trust boundary stated as same-origin plus trusted script URL plus known message type, with unknown messages unable to mutate lifecycle state? [Security, Spec §FR-012]
- [x] CHK008 Is lifecycle diagnostic content limited to a normalized route identifier and are query/hash/OAuth/content/IDs explicitly excluded? [Privacy, Spec §FR-011]
- [x] CHK009 Are worker barrier callbacks prohibited from returning user content and distinguished from remote-sync proof? [Data boundary, Contract §Update]
- [x] CHK010 Is cache ownership defined narrowly enough to protect unrelated same-origin caches, including a negative-control preservation requirement? [Least privilege, Spec §FR-009]
- [x] CHK011 Do rejected/cancelled/timed-out writers block reload rather than turn a reliability failure into forced data-loss risk? [Recovery, Spec §FR-007]
- [x] CHK012 Is rollout/release authority excluded and is public/native/runtime evidence marked `UNVERIFIED` pending fresh observation? [Authority, Spec §Non-goals and §Evidence ledger]

## Review result

12/12 requirement-quality checks pass. These are pre-implementation review questions, not implementation test results.
