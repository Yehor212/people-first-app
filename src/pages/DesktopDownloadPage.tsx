import {
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  FileKey2,
  MonitorDown,
  PackageCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { MiniValenceOrb } from "@/components/state-of-mind/MiniValenceOrb";
import { useLanguage } from "@/contexts/LanguageContext";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { APP_VERSION } from "@/lib/appVersion";
import { getDesktopReleaseState } from "@/lib/desktopRelease";

import "./DesktopDownloadPage.css";

const GITHUB_RELEASES_URL = "https://github.com/Yehor212/people-first-app/releases";

const copy = {
  uk: {
    eyebrow: "ZENFLOW DESKTOP DOCK",
    title: "Окремий простір для плавного ZenFlow на комп'ютері",
    body:
      "Той самий візуал, ті самі канонічні орби, але в контрольованому desktop-runtime без залежності від розширень, вкладок і стану Chrome-профілю.",
    downloadReady: "Завантажити підписаний EXE",
    downloadLocked: "Підписаний EXE готується",
    webFallback: "Відкрити web-версію",
    v2Preview: "Перейти у V2",
    releaseStatus: "Публічне скачування відкриється тільки після підпису",
    releaseBody:
      "Локальний EXE вже збирається, але для користувачів кнопка заблокована до валідного Authenticode-підпису, hash-перевірки і release-gate.",
    versionLabel: "Версія",
    signatureLabel: "Підпис",
    signatureValue: "Очікує signed release",
    hashLabel: "SHA-256",
    hashPending: "Очікує release hash",
    runtimeLabel: "Runtime",
    runtimeValue: "Tauri 2 + WebView2",
    orbitLabel: "Орби",
    orbitValue: "Канонічний WebGL only",
    promiseTitle: "Що це дає користувачу",
    promiseItems: [
      {
        title: "Менше випадкових лагів",
        body:
          "Desktop shell ізолює ZenFlow від важкого Chrome-профілю, десятків вкладок і сторонніх розширень.",
      },
      {
        title: "Візуал не спрощується",
        body:
          "Продуктивність поліпшується навколо канонічних орбів, а не заміною їх на дешевший fallback.",
      },
      {
        title: "Одна синхронізація",
        body:
          "V1, V2, web, PWA і desktop лишаються на одному ordered-sync контракті з anti-resurrection захистом.",
      },
    ],
    releaseRailTitle: "Безпечний шлях релізу",
    releaseRail: [
      "Зібрати EXE",
      "Підписати сертифікатом",
      "Перевірити hash і release-gate",
      "Відкрити download",
    ],
    trustTitle: "Не встановлюємо сирі білди",
    trustBody:
      "Якщо підпису немає, сторінка не дає скачати інсталятор. Це захищає користувачів і репутацію продукту.",
    releasesLink: "GitHub Releases",
    pageLabel: "ZenFlow Desktop download page",
  },
  en: {
    eyebrow: "ZENFLOW DESKTOP DOCK",
    title: "A dedicated desktop space for smooth ZenFlow",
    body:
      "Same visuals, same canonical orbs, inside a controlled desktop runtime instead of an overloaded Chrome profile.",
    downloadReady: "Download signed EXE",
    downloadLocked: "Signed EXE is being prepared",
    webFallback: "Open web ZenFlow",
    v2Preview: "Open V2 preview",
    releaseStatus: "Public download opens only after signing",
    releaseBody:
      "The local EXE already builds, but user download stays locked until Authenticode signing, hash verification, and release gates pass.",
    versionLabel: "Version",
    signatureLabel: "Signature",
    signatureValue: "Waiting for signed release",
    hashLabel: "SHA-256",
    hashPending: "Waiting for release hash",
    runtimeLabel: "Runtime",
    runtimeValue: "Tauri 2 + WebView2",
    orbitLabel: "Orbs",
    orbitValue: "Canonical WebGL only",
    promiseTitle: "What users get",
    promiseItems: [
      {
        title: "Fewer random freezes",
        body:
          "The desktop shell isolates ZenFlow from a heavy Chrome profile, many tabs, and third-party extensions.",
      },
      {
        title: "No visual downgrade",
        body:
          "Performance work happens around the canonical orbs, never by replacing them with a cheaper fallback.",
      },
      {
        title: "One sync contract",
        body:
          "V1, V2, web, PWA, and desktop stay on the same ordered-sync contract with anti-resurrection protection.",
      },
    ],
    releaseRailTitle: "Safe release path",
    releaseRail: [
      "Build EXE",
      "Sign with certificate",
      "Verify hash and release gate",
      "Open download",
    ],
    trustTitle: "No raw builds for users",
    trustBody:
      "If the signature is missing, this page refuses to expose the installer. That protects users and product trust.",
    releasesLink: "GitHub Releases",
    pageLabel: "ZenFlow Desktop download page",
  },
} as const;

type Copy = (typeof copy)[keyof typeof copy];

function buildAppHref(path = ""): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\//, "")}`;
}

function selectCopy(language: string): Copy {
  return language === "uk" ? copy.uk : copy.en;
}

export function DesktopDownloadPage() {
  const { language } = useLanguage();
  const animate = useShouldAnimate();
  const tx = selectCopy(language);
  const webHref = buildAppHref();
  const v2Href = buildAppHref("orb?nav=v2&navLayout=phone");
  const release = getDesktopReleaseState();

  return (
    <main
      className="desktop-download-page"
      data-testid="desktop-download-page"
      data-animate={animate ? "true" : "false"}
      aria-label={tx.pageLabel}
    >
      <div className="desktop-download-page__stars" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <header className="desktop-download-page__nav" aria-label={tx.pageLabel}>
        <a className="desktop-download-page__brand" href={webHref}>
          <MiniValenceOrb valence={0.18} hasEntry={false} size="sm" chrome="badge" />
          <span>ZenFlow</span>
        </a>
        <nav className="desktop-download-page__links" aria-label={tx.pageLabel}>
          <a href={webHref}>{tx.webFallback}</a>
          <a href={GITHUB_RELEASES_URL} rel="noreferrer" target="_blank">
            {tx.releasesLink}
            <ExternalLink aria-hidden="true" />
          </a>
        </nav>
      </header>

      <section className="desktop-download-page__hero">
        <div className="desktop-download-page__dock" aria-hidden="true">
          <span className="desktop-download-page__dock-rail desktop-download-page__dock-rail--top" />
          <span className="desktop-download-page__dock-rail desktop-download-page__dock-rail--bottom" />
          <span className="desktop-download-page__dock-column desktop-download-page__dock-column--left" />
          <span className="desktop-download-page__dock-column desktop-download-page__dock-column--right" />
          <span className="desktop-download-page__dock-window" />
          <span className="desktop-download-page__dock-scan" />
          <span className="desktop-download-page__dock-core">
            <MiniValenceOrb valence={0.18} hasEntry={false} size="lg" chrome="none" />
          </span>
        </div>

        <div className="desktop-download-page__hero-copy">
          <p className="desktop-download-page__eyebrow">
            <Sparkles aria-hidden="true" />
            {tx.eyebrow}
          </p>
          <h1>{tx.title}</h1>
          <p className="desktop-download-page__lead">{tx.body}</p>

          <div className="desktop-download-page__actions">
            {release.ready ? (
              <a
                className="desktop-download-page__primary"
                href={release.downloadUrl}
                download
              >
                <Download aria-hidden="true" />
                {tx.downloadReady}
              </a>
            ) : (
              <button
                className="desktop-download-page__primary desktop-download-page__primary--locked"
                type="button"
                disabled
                aria-disabled="true"
              >
                <ShieldCheck aria-hidden="true" />
                {tx.downloadLocked}
              </button>
            )}
            <a className="desktop-download-page__secondary" href={v2Href}>
              {tx.v2Preview}
              <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section className="desktop-download-page__release" aria-label={tx.releaseStatus}>
        <div>
          <p className="desktop-download-page__section-kicker">
            <PackageCheck aria-hidden="true" />
            {tx.releaseStatus}
          </p>
          <p>{tx.releaseBody}</p>
        </div>
        <dl>
          <div>
            <dt>{tx.versionLabel}</dt>
            <dd>{APP_VERSION}</dd>
          </div>
          <div>
            <dt>{tx.signatureLabel}</dt>
            <dd>{release.ready ? release.signatureStatus : tx.signatureValue}</dd>
          </div>
          <div>
            <dt>{tx.hashLabel}</dt>
            <dd>{release.ready ? release.sha256.slice(0, 12) : tx.hashPending}</dd>
          </div>
          <div>
            <dt>{tx.runtimeLabel}</dt>
            <dd>{tx.runtimeValue}</dd>
          </div>
          <div>
            <dt>{tx.orbitLabel}</dt>
            <dd>{tx.orbitValue}</dd>
          </div>
        </dl>
      </section>

      <section className="desktop-download-page__grid" aria-label={tx.promiseTitle}>
        <div className="desktop-download-page__section-heading">
          <MonitorDown aria-hidden="true" />
          <h2>{tx.promiseTitle}</h2>
        </div>
        {tx.promiseItems.map((item) => (
          <article key={item.title} className="desktop-download-page__card">
            <CheckCircle2 aria-hidden="true" />
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </section>

      <section className="desktop-download-page__rail" aria-label={tx.releaseRailTitle}>
        <div>
          <p className="desktop-download-page__section-kicker">
            <FileKey2 aria-hidden="true" />
            {tx.releaseRailTitle}
          </p>
          <h2>{tx.trustTitle}</h2>
          <p>{tx.trustBody}</p>
        </div>
        <ol>
          {tx.releaseRail.map((step) => (
            <li key={step}>
              <span aria-hidden="true" />
              {step}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
