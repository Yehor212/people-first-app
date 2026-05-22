# ZenFlow Partner Center Tabs Audit

Purpose: prevent a false "Store submission complete" claim by checking every
visible Partner Center tab with the same evidence rule.

This audit extends `STORE_SUBMISSION_AUDIT.md`. It is stricter than a normal
listing checklist: a tab is `PASS` only when Partner Center live evidence or a
fresh repo command proves it. Prepared repo copy is not the same as a live Store
submission.

Canonical machine-readable source:

`docs/release/microsoft-store/partner-center-tabs-audit.json`

## Completion Rule

Use these statuses exactly:

| Status | Meaning |
| --- | --- |
| `PASS` | Fresh repo or live Partner Center evidence proves the row for the current draft. |
| `READY_IN_REPO_LIVE_UNVERIFIED` | The repo packet is prepared and guarded, but Partner Center live proof is not complete yet. |
| `BLOCKED_UNTIL_PACKAGE_UPLOAD` | Partner Center cannot prove the row until a package is uploaded. |
| `BLOCKED_UNTIL_SIGNING` | Direct EXE/NSIS release cannot advance until Authenticode signing exists. |
| `UNVERIFIED` | The row may be valid, but fresh proof is missing after the latest live change. |
| `NOT_APPLICABLE` | The row is outside the current ZenFlow desktop Store submission scope. |

No row may be upgraded to `PASS` from memory, expectation, or a screenshot from
another product/build. No evidence = `UNVERIFIED` or `FAIL`, never `PASS`.

## Tab Matrix

| Partner Center area | Status | Current evidence | Required next action |
| --- | --- | --- | --- |
| Product Identity | `PASS` | `product-identity.public.json` contains the live product id, package identity, publisher, publisher display name, and PFN. | Use exact values for package manifests; never invent identity fields. |
| Manage app names | `PASS` | Product exists as `ZenFlow`; public identity file matches. | Keep Store name and app display name aligned. |
| Pricing and availability | `PASS` | `tmp/partner-center-overview-after-save.png` showed `Complete` on 2026-05-21. | Recheck immediately before certification because this is a live commercial setting. |
| Properties | `PASS` | `tmp/partner-center-overview-after-save.png` showed `Complete` on 2026-05-21. | Keep scope aligned with Windows desktop. |
| Age ratings | `PASS` | `tmp/partner-center-overview-after-save.png` showed `Complete`; Store copy is guarded against medical/therapy claims. | Recheck if copy or product scope changes. |
| English Store listing | `PASS` | English listing saved; three Desktop screenshots and captions are committed. | Treat this as English-only proof. |
| Additional Store listing languages | `READY_IN_REPO_LIVE_UNVERIFIED` | `store-listing-localized.json` covers `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, `he`; live Partner Center still showed English only. | Use Export/Import listings or one-language-at-a-time save, then capture proof per language. |
| Languages supported in packages | `BLOCKED_UNTIL_PACKAGE_UPLOAD` | Partner Center states package languages appear after packages are uploaded. | Upload accepted package, then compare detected package languages against the intended list. |
| Store logos | `PASS` | Official logo assets are committed; Partner Center logo section proof exists in `tmp/partner-center-store-logos-visible.png`. | Keep official-logo assets; do not switch to draft orb exports without owner approval. |
| Packages | `BLOCKED_UNTIL_PACKAGE_UPLOAD` | Partner Center showed `Packages` as `Not started`; `npm run desktop:store:package` now generates the Store `.msixupload` candidate. | Upload `tmp/microsoft-store-msix/ZenFlow_1.7.3.0_x64.msixupload`, capture Partner Center acceptance proof, then review package languages. |
| Submission Options | `UNVERIFIED` | Overview marked it recommended earlier, but it has not been freshly audited after package work. | Reopen after package upload and verify release timing/settings. |
| Additional Testing Information | `UNVERIFIED` | No current live proof captured. | Add reviewer test notes if certification needs login or usage guidance. |
| Product page experiment | `NOT_APPLICABLE` | First Store submission does not use product-page experiments. | Do not enable experiments before base page is certified. |
| Add-ons | `NOT_APPLICABLE` | No paid add-ons in current scope. | Leave unused unless future monetization changes scope. |
| WNS/MPNS | `NOT_APPLICABLE` | Current package does not use Microsoft push notification credentials. | Configure only if future Windows notifications require it. |
| Xbox services | `NOT_APPLICABLE` | ZenFlow is not an Xbox integration. | Leave unused. |
| Maps | `NOT_APPLICABLE` | ZenFlow does not use Microsoft Maps. | Leave unused. |
| Product collections and purchases | `NOT_APPLICABLE` | No Store commerce or in-app purchases. | Do not enable without owner approval and privacy/security review. |
| Partner Center account verification | `UNVERIFIED` | A prior overview showed a red account-verification warning; current account state must be rechecked. | Verify account status before certification. |
| Submit for certification | `BLOCKED_UNTIL_PACKAGE_UPLOAD` | Partner Center package acceptance, WACK or Store certification proof, package-language review, and account verification are missing. | Do not submit yet. |

## Why The Language Page Still Looks Incomplete

The screenshot with only `English` complete is not a contradiction. It proves
the live Store listing currently has only English saved. The repo has prepared
localized copy for the other seven app languages, but those rows are not live
until Partner Center imports or saves them.

There are three separate language surfaces:

1. App UI source languages: `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, `he`.
2. Store listing languages: live listing pages in Partner Center.
3. Package-supported languages: detected only after package upload.

Do not collapse those surfaces into one status.

## Safe Partner Center Workflow

1. Use `STORE_LISTING_LOCALIZED_PACKET.md` and
   `store-listing-localized.json` for multilingual listing copy.
2. Prefer Partner Center `Export listings` / `Import listings` for multiple
   languages.
3. If editing manually, add and save one language at a time.
4. Capture proof after every language.
5. Re-open Application overview and confirm status after save.
6. Re-run `npm run desktop:store:check`.

Never use coordinate-only checkbox automation for language selection. It can
select the wrong language when search, scroll, or modal state changes.

## Certification Stop Conditions

Stop and report `PARTIAL`, `UNVERIFIED`, or `BLOCKED` when any of these remain:

- `Packages` is `Not started` until the generated MSIXUPLOAD is uploaded and accepted.
- Direct EXE/NSIS artifacts are unsigned when direct distribution is in scope.
- Partner Center account verification is not current.
- No accepted generated MSIXUPLOAD package is visible in Partner Center.
- Package languages are unavailable or not reviewed.
- Additional Store listing languages are repo-ready but not live-proved.
- Windows App Certification Kit or equivalent Store package acceptance proof is
  missing.

## Official References

- Store listing information:
  https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/add-and-edit-store-listing-info
- Screenshots and Store images:
  https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images
- Store listing import/export:
  https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/import-and-export-store-listings
- MSIX app package requirements:
  https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements
- Upload app packages:
  https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/upload-app-packages?pivots=store-installer-msix&source=recommendations
- Microsoft code signing options:
  https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- MSI/EXE app package requirements if the product path changes:
  https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements
