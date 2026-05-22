# ZenFlow Microsoft Store Submission Audit

Purpose: keep the Partner Center submission honest across every questionnaire,
listing language, package state, and release gate.

This audit was created after reviewing the live Partner Center language screen
and the saved submission overview on 2026-05-21. It separates three different
language surfaces that must not be mixed:

- **App i18n:** source-level ZenFlow UI languages.
- **Store listing languages:** customer-facing Microsoft Store listing pages.
- **Package languages:** languages detected from uploaded Store packages.

## Official Rules Used

- Microsoft Store listing requires at least one completed language with a text
  description and at least one screenshot.
- Microsoft recommends a Store listing for each package-supported language, but
  lets publishers remove package languages or add additional listing languages.
- If multiple Store listing languages are used, each language has its own
  listing page and its own screenshots/captions.
- Languages supported by packages are shown only after packages are uploaded.
- Unsupported language codes should not be included in packages because they can
  delay or fail certification.

References:

- `https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/add-and-edit-store-listing-info`
- `https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images`
- `https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements#supported-languages`

## Language State

| Surface | Status | Evidence | Required next action |
| --- | --- | --- | --- |
| App i18n source languages | `PASS` | `src/i18n/languages/{en,uk,es,de,fr,ja,ar,he}.ts`; `npm run i18n:check`; `npm run i18n:deep` | Keep all eight language files valid. |
| English Store listing | `PASS` | Partner Center saved overview; `tmp/partner-center-overview-after-save.png`; English screenshots and captions in `store-screenshots/desktop/` | Keep English screenshots/copy in sync with current app surface. |
| Additional Store listing languages | `PARTIAL` | Live language page shows only `English` as `Complete`; `tmp/partner-center-language-state-audit.png` | Do not add other languages until localized listing text, captions, and Store-safe screenshots are prepared for each language. |
| Package-supported languages | `FAIL` until package upload | Live language page says package languages will display after packages are uploaded; `Packages` is `Not started` | Build/upload accepted Store package, then verify the package language list. |
| Certification | `FAIL` until package/signing/WACK proof | `npm run desktop:release:check` reports unsigned artifacts; no MSIX/AppX package found | Do not click `Submit for certification`. |

## Supported Language Intent

ZenFlow app UI currently has eight source languages:

```text
en, uk, es, de, fr, ja, ar, he
```

These map to Microsoft Store-supported language families:

| App locale | Store language family | Current Store listing state |
| --- | --- | --- |
| `en` | English | `PASS` listing complete |
| `uk` | Ukrainian | `UNVERIFIED` listing not added |
| `es` | Spanish | `UNVERIFIED` listing not added |
| `de` | German | `UNVERIFIED` listing not added |
| `fr` | French | `UNVERIFIED` listing not added |
| `ja` | Japanese | `UNVERIFIED` listing not added |
| `ar` | Arabic | `UNVERIFIED` listing not added |
| `he` | Hebrew | `UNVERIFIED` listing not added |

Do not mark the multilingual Store release complete until every selected Store
listing language has localized text and screenshots, and the uploaded package
language list has been verified in Partner Center.

## Questionnaire Audit Matrix

| Partner Center section | Current status | Evidence | Logic check |
| --- | --- | --- | --- |
| Product Identity | `PASS` | `product-identity.public.json` records `9MZK46FHZV8K`, `YehorSha.ZenFlow`, publisher, PFN | Public metadata only; no secrets. |
| Pricing and availability | `PASS` | `tmp/partner-center-overview-after-save.png` shows `Complete` | Still requires final review before certification. |
| Properties | `PASS` | `tmp/partner-center-overview-after-save.png` shows `Complete` | Must stay aligned with Windows desktop-only release. |
| Age ratings | `PASS` | `tmp/partner-center-overview-after-save.png` shows `Complete` | No medical/therapy claims in listing copy. |
| Store listings | `PASS` for English only | `tmp/partner-center-overview-after-save.png` shows `Complete`; English listing screenshots/captions uploaded | `PASS` does not mean every app UI language has a Store page. |
| Additional Store listing languages | `PARTIAL` | `tmp/partner-center-language-state-audit.png` shows only English complete | Add only after localized assets exist. |
| Languages supported in packages | `FAIL` until package upload | `tmp/partner-center-language-state-audit.png` shows empty package language list | Expected while `Packages` is `Not started`, but blocks language release proof. |
| Packages | `FAIL` | Partner Center overview shows `Not started`; no MSIX/AppX package artifact found | Certification cannot be submitted. |
| Submission options | `UNVERIFIED` | Overview marked recommended, but final settings not audited after package upload | Recheck after package is added. |
| Store logos | `PASS` | Poster, box art, app tile 300/150/71, and hero art uploaded in Partner Center | Keep official-logo assets; orb drafts remain reference-only. |
| Certification submit | `FAIL` until package and WACK pass | Not submitted by design | Do not submit from listing-only evidence. |

## Store Language Policy For Future Work

1. English screenshots and English description are valid only for the English
   Store listing.
2. Do not reuse English captions as localized listing copy.
3. Do not add Ukrainian, Spanish, German, French, Japanese, Arabic, or Hebrew
   Store listing languages unless that language has:
   - localized short description,
   - localized full description,
   - localized feature rows,
   - localized search terms,
   - localized screenshot captions,
   - Store-safe screenshots for that language or an explicit decision that
     neutral screenshots with localized captions are acceptable.
4. After package upload, verify `Languages supported in packages` against the
   intended language list before certification.
5. If Partner Center package languages and Store listing languages differ,
   record the reason in this audit before submitting.

## Stop Conditions

Stop and report `PARTIAL` or `FAIL` when:

- Partner Center shows only English but the release claim says all languages.
- Package languages are empty because no package has been uploaded.
- A non-English Store listing lacks localized copy or captions.
- `Packages` is `Not started`.
- `desktop:release:check` fails because artifacts are unsigned.
- Windows App Certification Kit evidence is missing.
