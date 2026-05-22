import { Fragment, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { DICT, type Locale } from "./i18n.js";

/* Speqify landing. PL is the default locale (Polish product); a header switch toggles EN. */

const LS_KEY = "speqify.lang";
function initialLocale(): Locale {
  const fromQuery = new URLSearchParams(location.search).get("lang");
  if (fromQuery === "en" || fromQuery === "pl") return fromQuery;
  const saved = localStorage.getItem(LS_KEY);
  if (saved === "en" || saved === "pl") return saved;
  return navigator.language?.toLowerCase().startsWith("en") ? "en" : "pl";
}

const Check = (p: { w?: number }) => (
  <svg
    width={p.w ?? 16}
    height={p.w ?? 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const Arrow = () => (
  <svg
    className="state-arrow"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);
const Logo = () => (
  <span className="logo-mark" aria-hidden="true">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  </span>
);

const FEATURE_ICONS: ReactNode[] = [
  <path d="M12 22s8-4 8-12V5l-8-3-8 3v5c0 8 8 12 8 12z M9 12l2 2 4-4" key="i0" />,
  <>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
  </>,
  <>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </>,
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>,
  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" key="i4" />,
  <>
    <path d="M5 13a7 7 0 0 1 7-7" />
    <path d="M12 20a7 7 0 0 1-7-7" />
    <path d="M12 6a7 7 0 0 1 7 7" />
    <circle cx="12" cy="13" r="2" />
  </>,
];
const FEATURE_TONE = ["feature-accent", "feature-info", "", "feature-success", "", ""];

export function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [submitted, setSubmitted] = useState(false);
  const t = DICT[locale];

  useEffect(() => {
    document.documentElement.lang = t.htmlLang;
    document.title = t.metaTitle;
    localStorage.setItem(LS_KEY, locale);
  }, [locale, t.htmlLang, t.metaTitle]);

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const email = (form.elements.namedItem("email") as HTMLInputElement | null)?.value ?? "";
    const apiBase =
      (import.meta.env as Record<string, string | undefined>).VITE_API_BASE ??
      "http://127.0.0.1:8787";
    // Best-effort: capture the lead, but the acknowledgement is shown either
    // way (no self-serve signup in V1 — the form must never feel broken).
    void fetch(`${apiBase}/leads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, locale }),
    }).catch(() => undefined);
    setSubmitted(true);
  };

  return (
    <>
      <div className="benefit-bar" role="region" aria-label={t.nav.features}>
        {t.benefit.map((b, i) => (
          <span key={b} className={`item${i === 1 || i === 3 ? " hide-sm" : ""}`}>
            {i > 0 ? <span className="dot">·</span> : null}
            {b}
          </span>
        ))}
      </div>

      <header className="header">
        <div className="container header-inner">
          <a href="#" className="logo" aria-label="Speqify">
            <Logo />
            <span>Speqify</span>
          </a>
          <nav className="nav" aria-label="Primary">
            <a href="#how">{t.nav.how}</a>
            <a href="#features">{t.nav.features}</a>
            <a href="#compare">{t.nav.compare}</a>
            <a href="#privacy">{t.nav.privacy}</a>
          </nav>
          <div className="header-cta">
            <div className="lang-switch" role="group" aria-label="Language">
              {(["pl", "en"] as Locale[]).map((l) => (
                <button
                  key={l}
                  className={locale === l ? "active" : ""}
                  aria-pressed={locale === l}
                  onClick={() => setLocale(l)}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <a
              href="#cta"
              className="btn btn-primary"
              style={{ height: 40, padding: "0 18px", fontSize: ".9375rem" }}
            >
              {t.ctaHeader}
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero" aria-labelledby="hero-h">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">{t.hero.eyebrow}</span>
            <h1 id="hero-h" className="h-display">
              {t.hero.h1}
            </h1>
            <p className="lead">{t.hero.lead}</p>
            <div className="hero-actions">
              <a href="#cta" className="btn btn-cta-hero">
                {t.hero.ctaPrimary}
              </a>
              <a href="#how" className="btn btn-secondary">
                {t.hero.ctaSecondary}
              </a>
            </div>
            <div className="hero-meta">
              {t.hero.checks.map((c) => (
                <span className="check" key={c}>
                  <Check />
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="mock" role="img" aria-label={t.hero.eyebrow}>
            <div className="mock-chrome">
              <span className="mock-dot" />
              <span className="mock-dot" />
              <span className="mock-dot" />
              <span className="mock-url">{t.hero.mockUrl}</span>
            </div>
            <div className="mock-body">
              <div className="app">
                <aside className="app-side">
                  <div className="b brand" />
                  <div className="b s1" />
                  <div className="b s2 active" />
                  <div className="b s3" />
                  <div className="b s4" />
                  <div className="b s5" />
                  <div className="b s2" />
                  <div className="b s1" />
                </aside>
                <main className="app-main">
                  <div className="app-title" />
                  <div className="app-row">
                    <div className="app-card">
                      <div className="ll" />
                      <div className="nn" />
                    </div>
                    <div className="app-card">
                      <div className="ll" />
                      <div className="nn" />
                    </div>
                    <div className="app-card">
                      <div className="ll" />
                      <div className="nn" />
                    </div>
                  </div>
                  <div className="app-table">
                    <div className="th" />
                    {[0, 1, 2, 3].map((r) => (
                      <div className="tr" key={r}>
                        <span className="cell a" />
                        <span className="cell b" />
                        <span className="cell c" />
                        <span className="cell d" />
                      </div>
                    ))}
                  </div>
                  <span className="app-btn">
                    {locale === "pl" ? "Eksportuj raport" : "Export report"}
                  </span>
                </main>
              </div>

              <div className="pin pin-1">
                <span className="dot pulse">1</span>
                <span className="selector">.app-btn.primary</span>
              </div>
              <div className="pin pin-2">
                <span className="dot">2</span>
              </div>

              <div className="annot-panel">
                <div className="annot-head">
                  <span className="title">
                    <span className="num">1</span> {locale === "pl" ? "Adnotacja" : "Annotation"}
                  </span>
                  <span className="status">{t.hero.mockStatus}</span>
                </div>
                <div className="annot-body">
                  <div className="annot-selector">{t.hero.mockSelector}</div>
                  <div className="annot-voice">
                    <span className="mic" aria-hidden="true">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                      </svg>
                    </span>
                    <span className="wave" aria-hidden="true">
                      {[6, 14, 9, 20, 12, 18, 8, 22, 11, 16, 7, 13, 19, 9, 15].map((h, i) => (
                        <span key={i} style={{ height: h }} />
                      ))}
                    </span>
                    <span className="time">0:42</span>
                  </div>
                  <p className="annot-text">{t.hero.mockVoice}</p>
                </div>
                <div className="annot-foot">
                  {t.hero.mockChips.map((c) => (
                    <span className="chip" key={c}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="trust" aria-label={t.trust.label}>
        <div className="container trust-inner">
          <span className="trust-label">{t.trust.label}</span>
          <div className="logo-row">
            {t.trust.logos.map((l) => (
              <span className="logo-ph" key={l}>
                {l}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Problems */}
      <section className="problems" aria-labelledby="prob-h">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t.problems.eyebrow}</span>
            <h2 id="prob-h" className="h1">
              {t.problems.h2}
            </h2>
            <p className="lead">{t.problems.lead}</p>
          </div>
          <div className="problem-grid">
            {t.problems.cards.map((c, i) => (
              <div className="problem-card" key={i}>
                <span className="label">{t.problems.instead}</span>
                <p className="before">{c.before}</p>
                <span className="label">{t.problems.youGet}</span>
                <p className="after">{c.after}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How */}
      <section className="how" id="how" aria-labelledby="how-h">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t.how.eyebrow}</span>
            <h2 id="how-h" className="h1">
              {t.how.h2}
            </h2>
            <p className="lead">{t.how.lead}</p>
          </div>
          <div className="steps">
            {t.how.steps.map((s, i) => (
              <div className="step" key={i}>
                <span className="n">{i + 1}</span>
                <h3>{s.h}</h3>
                <p>{s.p}</p>
                <span className="who">{s.who}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features" id="features" aria-labelledby="feat-h">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t.features.eyebrow}</span>
            <h2 id="feat-h" className="h1">
              {t.features.h2}
            </h2>
          </div>
          <div className="feature-grid">
            {t.features.items.map((f, i) => (
              <div className={`feature ${FEATURE_TONE[i] ?? ""}`} key={i}>
                <div className="icon" aria-hidden="true">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {FEATURE_ICONS[i]}
                  </svg>
                </div>
                <h3>{f.h}</h3>
                <p>{f.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* State machines */}
      <section className="state" aria-labelledby="state-h">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t.state.eyebrow}</span>
            <h2 id="state-h" className="h1">
              {t.state.h2}
            </h2>
            <p className="lead">{t.state.lead}</p>
          </div>
          <div className="state-grid">
            {(
              [
                { title: t.state.annotation, nodes: t.state.annNodes, note: t.state.annNote },
                { title: t.state.task, nodes: t.state.taskNodes, note: t.state.taskNote },
              ] as const
            ).map((c) => (
              <div className="state-card" key={c.title}>
                <h3 className="h3">{c.title}</h3>
                <div className="state-flow">
                  {c.nodes.map((n, i) => (
                    <Fragment key={n}>
                      <div className={`state-node ${i === 0 ? "start" : i === 1 ? "mid" : "end"}`}>
                        {n}
                      </div>
                      {i < c.nodes.length - 1 ? <Arrow /> : null}
                    </Fragment>
                  ))}
                </div>
                <p>{c.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compare */}
      <section className="compare" id="compare" aria-labelledby="cmp-h">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t.compare.eyebrow}</span>
            <h2 id="cmp-h" className="h1">
              {t.compare.h2}
            </h2>
            <p className="lead">{t.compare.lead}</p>
          </div>
          <div className="compare-table" role="table" aria-label={t.compare.h2}>
            <div className="compare-row head" role="row">
              <div role="columnheader">{t.compare.colFeature}</div>
              <div className="speqify" role="columnheader">
                {t.compare.colSpeqify}
              </div>
              <div role="columnheader">{t.compare.colOther}</div>
            </div>
            {t.compare.rows.map((r, i) => (
              <div className="compare-row" role="row" key={i}>
                <div className="feat" role="cell">
                  {r.f}
                </div>
                <div className={`speqify ${r.sk}`} role="cell">
                  {r.s}
                </div>
                <div className={r.ok} role="cell">
                  {r.o}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="privacy" id="privacy" aria-labelledby="priv-h">
        <div className="container">
          <div className="privacy-card">
            <div>
              <span
                className="eyebrow"
                style={{ background: "rgba(255,255,255,.08)", color: "#fff" }}
              >
                {t.privacy.eyebrow}
              </span>
              <h2 id="priv-h" className="h1" style={{ color: "#fff", marginTop: 16 }}>
                {t.privacy.h2}
              </h2>
              <p>{t.privacy.p}</p>
            </div>
            <ul className="privacy-list">
              {t.privacy.points.map((pt) => (
                <li key={pt.strong}>
                  <Check w={20} />
                  <span>
                    <strong>{pt.strong}</strong> {pt.rest}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bottom-cta" id="cta" aria-labelledby="cta-h">
        <div className="container">
          <span className="eyebrow">{t.bottom.eyebrow}</span>
          <h2 id="cta-h" className="h1" style={{ marginTop: 16 }}>
            {t.bottom.h2}
          </h2>
          <p className="lead">{t.bottom.lead}</p>
          <form className="row" onSubmit={onSubmit}>
            <label htmlFor="email" className="sr-only">
              {t.bottom.placeholder}
            </label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder={t.bottom.placeholder}
              required
              disabled={submitted}
            />
            <button className="btn btn-cta-hero" type="submit" disabled={submitted}>
              {submitted ? t.bottom.thanks : t.bottom.button}
            </button>
          </form>
          <p className="body-sm" style={{ marginTop: 16 }}>
            {t.bottom.fine}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="brand-block">
              <a href="#" className="logo">
                <Logo />
                <span>Speqify</span>
              </a>
              <p>{t.footer.tagline}</p>
            </div>
            <div>
              <h4>{t.footer.productH}</h4>
              <ul>
                {t.footer.product.map((x, i) => (
                  <li key={x}>
                    <a href={["#how", "#features", "#compare", "#cta"][i]}>{x}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>{t.footer.resourcesH}</h4>
              <ul>
                {t.footer.resources.map((x) => (
                  <li key={x}>
                    <a href="#">{x}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>{t.footer.companyH}</h4>
              <ul>
                {t.footer.company.map((x, i) => (
                  <li key={x}>
                    <a href={i === 0 ? "#privacy" : i === 3 ? `mailto:${x}` : "#"}>{x}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>{t.footer.rights}</span>
            <span>{t.footer.made}</span>
          </div>
        </div>
      </footer>
    </>
  );
}
