import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/* Convergence-compliant landing. Authority: DESIGN.md. Structure inspired by
   usersnap.com (product-led, utilitarian, integration-forward) — original copy,
   no fabricated logos/testimonials (DESIGN.md §Trust: authentic only). */

const REQUEST_EMAIL =
  (import.meta.env as Record<string, string | undefined>).VITE_REQUEST_ACCESS_EMAIL ??
  "hello@speqify.app";
const REQUEST_HREF = `mailto:${REQUEST_EMAIL}?subject=${encodeURIComponent(
  "Speqify access request",
)}`;

function Section(props: {
  id?: string;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={props.id} aria-labelledby={props.labelledBy} className={props.className ?? ""}>
      <div className="container-page py-3xl">{props.children}</div>
    </section>
  );
}

function Heading(props: { id: string; eyebrow: string; title: string; lede?: string }) {
  return (
    <div className="max-w-3xl">
      <p className="eyebrow">{props.eyebrow}</p>
      <h2 id={props.id} className="mt-md text-h2 text-primary">
        {props.title}
      </h2>
      {props.lede ? <p className="lede mt-md">{props.lede}</p> : null}
    </div>
  );
}

/** Sticky mobile CTA appears once the hero CTA scrolls out of view (DESIGN.md
    §sticky-cta-mobile + thumb-zone). */
function useInView<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? true), {
      threshold: 0,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

function HeroMock() {
  /* Decorative concrete illustration of the overlay (DESIGN.md: concrete beats
     abstract). Pure CSS — no image payload, protects LCP. */
  return (
    <div aria-hidden="true" className="card-elevated select-none">
      <div className="flex items-center gap-xs border-b border-border pb-sm">
        <span className="h-3 w-3 rounded-full bg-surface-sunken" />
        <span className="h-3 w-3 rounded-full bg-surface-sunken" />
        <span className="h-3 w-3 rounded-full bg-surface-sunken" />
        <span className="ml-sm truncate text-caption text-muted">
          app-staging.yourclient.com/checkout
        </span>
      </div>
      <div className="mt-lg grid gap-md">
        <div className="rounded-sm border-2 border-border-focus bg-surface-muted p-md">
          <div className="text-label text-secondary">Place order button</div>
          <div className="mt-xs text-caption text-muted">
            button.checkout-cta · &lt;button class=&quot;checkout-cta&quot;&gt;
          </div>
        </div>
        <div className="flex items-center gap-sm rounded-full bg-primary px-md py-sm text-on-primary">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <span className="text-body-sm">
            Voice note 0:14 — “Make this primary, add a spinner…”
          </span>
        </div>
        <div className="card-flat">
          <div className="text-caption uppercase text-secondary">AI draft · Jira</div>
          <div className="mt-xs text-label text-primary">
            Checkout CTA: promote to primary action + loading state
          </div>
          <div className="mt-xs text-caption text-muted">
            AC · labels: frontend, checkout · component: Cart
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    n: "1",
    t: "Point & annotate",
    d: "Click any element on the live app. Speqify captures the selector, XPath, HTML, a screenshot and the technical context — console, errors, network, build/env.",
  },
  {
    n: "2",
    t: "Talk it through",
    d: "Record a voice note or a narrated screen recording. No writing during the meeting — say what should change and move on.",
  },
  {
    n: "3",
    t: "AI drafts the tickets",
    d: "After the session, AI groups related feedback into clean, scoped tasks — in your template, language, with acceptance criteria.",
  },
  {
    n: "4",
    t: "Review & export",
    d: "Approve each task with keyboard shortcuts, then push to Jira or GitHub (create-only) or export JSON/CSV.",
  },
];

const FEATURES = [
  {
    t: "Annotate the real app — not a screenshot",
    p: "A tiny SDK embedded in your own app gives full-fidelity capture.",
    li: [
      "Selector, XPath and HTML of the exact element",
      "Element + page screenshots, redaction tool for sensitive data",
      "Navigation breadcrumb for reproduction steps",
    ],
  },
  {
    t: "Voice & screen recording, transcribed",
    p: "Built for live sessions where there is no time to write.",
    li: [
      "Voice notes and narrated screen recordings",
      "Async transcription (Whisper) — PL & EN",
      "Re-record before sending; nothing is typed in the meeting",
    ],
  },
  {
    t: "AI tickets in your template",
    p: "Output matches your conventions, not a generic format.",
    li: [
      "User story + acceptance criteria, your output language",
      "Labels, component, version, custom fields",
      "Merges related notes; splits big ones into subtasks",
    ],
  },
  {
    t: "Dev-ready by default",
    p: "Tickets carry the context developers actually need.",
    li: [
      "Console, JS errors, network, build & environment",
      "Screenshots hosted and linked into the ticket",
      "Create-only export — Jira, GitHub Issues, JSON, CSV",
    ],
  },
];

const SDK_SNIPPET = `<!-- Speqify overlay — load ONLY on non-production / review envs -->
<script
  defer
  src="https://speqify.app/sdk/v1/loader.js"
  data-speqify-token="PANEL_TOKEN"
></script>`;

export function App() {
  const hero = useInView<HTMLAnchorElement>();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/* Benefit bar — 40px, persistent (DESIGN.md §benefit-bar) */}
      <div className="benefit-bar">
        <div className="container-page flex items-center justify-center gap-sm text-center">
          <span className="truncate">
            Annotate on the live app · Voice notes, no typing · AI-drafted Jira &amp; GitHub tickets
            · Private beta
          </span>
        </div>
      </div>

      {/* Header — sticky, 64px (DESIGN.md §Header) */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="container-page flex h-16 items-center justify-between gap-lg">
          <a href="#main" className="text-h4 font-semibold text-primary no-underline">
            Speqify
          </a>

          <nav aria-label="Primary" className="hidden items-center gap-lg lg:flex">
            <a href="#how" className="text-label text-secondary no-underline hover:text-primary">
              How it works
            </a>
            <a
              href="#features"
              className="text-label text-secondary no-underline hover:text-primary"
            >
              Features
            </a>
            <a
              href="#integrations"
              className="text-label text-secondary no-underline hover:text-primary"
            >
              Integrations
            </a>
            <a href="#sdk" className="text-label text-secondary no-underline hover:text-primary">
              SDK
            </a>
          </nav>

          <div className="hidden items-center gap-sm lg:flex">
            <a href="/panel" className="btn-link">
              Log in
            </a>
            <a href={REQUEST_HREF} className="btn-primary no-underline">
              Request access
            </a>
          </div>

          <button
            type="button"
            className="btn-secondary lg:hidden"
            aria-expanded={navOpen}
            aria-controls="mobile-nav"
            onClick={() => setNavOpen((v) => !v)}
          >
            {navOpen ? "Close" : "Menu"}
          </button>
        </div>

        {navOpen ? (
          <nav
            id="mobile-nav"
            aria-label="Mobile"
            className="border-t border-border bg-surface lg:hidden"
          >
            <div className="container-page flex flex-col gap-sm py-md">
              <a
                href="#how"
                className="py-sm text-body-md no-underline"
                onClick={() => setNavOpen(false)}
              >
                How it works
              </a>
              <a
                href="#features"
                className="py-sm text-body-md no-underline"
                onClick={() => setNavOpen(false)}
              >
                Features
              </a>
              <a
                href="#integrations"
                className="py-sm text-body-md no-underline"
                onClick={() => setNavOpen(false)}
              >
                Integrations
              </a>
              <a
                href="#sdk"
                className="py-sm text-body-md no-underline"
                onClick={() => setNavOpen(false)}
              >
                SDK
              </a>
              <a href={REQUEST_HREF} className="btn-primary mt-sm no-underline">
                Request access
              </a>
            </div>
          </nav>
        ) : null}
      </header>

      <main id="main">
        {/* Hero */}
        <section aria-labelledby="hero-title" className="bg-surface">
          <div className="container-page grid items-center gap-2xl py-3xl lg:grid-cols-2 lg:py-4xl">
            <div>
              <p className="eyebrow">Requirements gathering for client-app teams</p>
              <h1 id="hero-title" className="mt-md text-display text-primary">
                Turn live-app feedback into shippable tickets.
              </h1>
              <p className="lede mt-lg max-w-xl">
                Your client points at the real app, talks through what they want, and Speqify&apos;s
                AI drafts structured Jira or GitHub tickets — in your template, with screenshots,
                voice transcripts and the technical context developers need.
              </p>
              <div className="mt-2xl flex flex-wrap items-center gap-md">
                <a ref={hero.ref} href={REQUEST_HREF} className="btn-cta-hero no-underline">
                  Request access
                </a>
                <a href="#how" className="btn-secondary no-underline">
                  See how it works
                </a>
              </div>
              <p className="mt-md text-body-sm text-muted">
                Private beta · No credit card · We set up your workspace
              </p>
            </div>
            <HeroMock />
          </div>
        </section>

        {/* Trust strip — honest, no fabricated logos (DESIGN.md §Trust) */}
        <section
          aria-label="Who Speqify is for"
          className="border-y border-border bg-surface-muted"
        >
          <div className="container-page flex flex-col gap-md py-xl text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <p className="text-body-md text-secondary">
              Built for software teams who design, build and ship apps for clients.
            </p>
            <ul className="flex flex-wrap justify-center gap-sm">
              {["PMs & analysts", "Agencies & software houses", "Async client + tester panels"].map(
                (chip) => (
                  <li key={chip} className="eyebrow normal-case">
                    {chip}
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <Section id="how" labelledBy="how-title">
          <Heading
            id="how-title"
            eyebrow="How it works"
            title="From a pointing finger to a scoped ticket."
            lede="Four steps. The client and the product owner work asynchronously — each on their own link."
          />
          <ol className="mt-2xl grid gap-lg md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="card-flat">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-label text-on-primary"
                  aria-hidden="true"
                >
                  {s.n}
                </span>
                <h3 className="mt-md text-h4 text-primary">{s.t}</h3>
                <p className="mt-sm text-body-sm text-secondary">{s.d}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Features — alternating blocks */}
        <section id="features" aria-labelledby="features-title" className="bg-surface">
          <div className="container-page py-3xl">
            <Heading
              id="features-title"
              eyebrow="Features"
              title="Everything a developer needs, captured automatically."
            />
            <div className="mt-2xl grid gap-xl">
              {FEATURES.map((f, i) => (
                <div
                  key={f.t}
                  className={`grid items-center gap-lg lg:grid-cols-2 ${
                    i % 2 === 1 ? "lg:[&>div:first-child]:order-2" : ""
                  }`}
                >
                  <div>
                    <h3 className="text-h3 text-primary">{f.t}</h3>
                    <p className="mt-sm text-body-md text-secondary">{f.p}</p>
                    <ul className="mt-md grid gap-sm">
                      {f.li.map((item) => (
                        <li key={item} className="flex gap-sm text-body-md text-on-surface">
                          <span aria-hidden="true" className="text-success">
                            ✓
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card-elevated">
                    <p className="text-caption uppercase text-secondary">{`0${i + 1}`}</p>
                    <p className="mt-sm text-body-lg text-primary">{f.t}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Integrations */}
        <Section id="integrations" labelledBy="integrations-title" className="bg-surface-muted">
          <Heading
            id="integrations-title"
            eyebrow="Integrations"
            title="Ships where your team already works."
            lede="Create-only in V1 — Speqify drafts and pushes, your tracker stays the source of truth."
          />
          <ul className="mt-2xl grid gap-lg sm:grid-cols-3">
            {[
              { t: "Jira", d: "Issue type, components, versions, field mapping, sub-tasks." },
              { t: "GitHub Issues", d: "Labels, linked issues, screenshots as hosted links." },
              { t: "JSON / CSV", d: "Versioned export when you want the raw structure." },
            ].map((x) => (
              <li key={x.t} className="card-flat">
                <h3 className="text-h4 text-primary">{x.t}</h3>
                <p className="mt-sm text-body-sm text-secondary">{x.d}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* Why Speqify — principles instead of fabricated testimonials */}
        <Section labelledBy="why-title" className="bg-surface">
          <Heading
            id="why-title"
            eyebrow="Why Speqify"
            title="Designed around how requirements actually get collected."
          />
          <div className="mt-2xl grid gap-lg md:grid-cols-3">
            {[
              {
                t: "Async by design",
                d: "PM and client never need to be online together. Each gets their own revocable link.",
              },
              {
                t: "Voice-first",
                d: "Speaking is faster than writing in a review. Transcription and analysis happen after.",
              },
              {
                t: "Your conventions, enforced",
                d: "The template — language, AC, labels, fields — shapes every generated ticket.",
              },
            ].map((c) => (
              <div key={c.t} className="card-flat">
                <h3 className="text-h4 text-primary">{c.t}</h3>
                <p className="mt-sm text-body-md text-secondary">{c.d}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* SDK */}
        <Section id="sdk" labelledBy="sdk-title" className="bg-surface">
          <div className="grid gap-2xl lg:grid-cols-2 lg:items-center">
            <div>
              <Heading
                id="sdk-title"
                eyebrow="For developers"
                title="Drop the SDK into your app."
                lede="It's your app, so you embed a tiny loader. It is inert in production and only activates on review environments — zero overhead for real users."
              />
              <p className="mt-lg text-body-sm text-muted">
                Private beta — your real panel token and full install instructions live in your
                Speqify panel.{" "}
                <a href="/docs/sdk" className="text-link underline underline-offset-4">
                  Read the SDK docs
                </a>
                .
              </p>
            </div>
            <pre className="code-block" aria-label="Speqify SDK embed snippet">
              <code>{SDK_SNIPPET}</code>
            </pre>
          </div>
        </Section>

        {/* Final CTA — primary (not accent): keeps ≤2 accent/viewport, one hero CTA */}
        <section aria-labelledby="cta-title" className="border-t border-border bg-surface-muted">
          <div className="container-page flex flex-col items-start gap-lg py-4xl">
            <h2 id="cta-title" className="text-h1 text-primary">
              Stop translating feedback into tickets by hand.
            </h2>
            <p className="lede max-w-2xl">
              Speqify is in private beta. Tell us about your team and the apps you ship for clients
              — we&apos;ll set up your workspace.
            </p>
            <a href={REQUEST_HREF} className="btn-primary no-underline">
              Request a Speqify invite
            </a>
          </div>
        </section>
      </main>

      <footer className="bg-primary text-on-primary">
        <div className="container-page grid gap-xl py-3xl sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-h4 font-semibold">Speqify</p>
            <p className="mt-sm text-body-sm text-surface-sunken">
              Feedback on your live app, shipped as tickets.
            </p>
          </div>
          <nav aria-label="Product">
            <p className="text-caption uppercase text-surface-sunken">Product</p>
            <ul className="mt-md grid gap-sm text-body-sm">
              <li>
                <a href="#how" className="text-on-primary no-underline hover:underline">
                  How it works
                </a>
              </li>
              <li>
                <a href="#features" className="text-on-primary no-underline hover:underline">
                  Features
                </a>
              </li>
              <li>
                <a href="#integrations" className="text-on-primary no-underline hover:underline">
                  Integrations
                </a>
              </li>
              <li>
                <a href="#sdk" className="text-on-primary no-underline hover:underline">
                  SDK
                </a>
              </li>
            </ul>
          </nav>
          <nav aria-label="Company">
            <p className="text-caption uppercase text-surface-sunken">Company</p>
            <ul className="mt-md grid gap-sm text-body-sm">
              <li>
                <a href="/privacy" className="text-on-primary no-underline hover:underline">
                  Privacy &amp; GDPR
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${REQUEST_EMAIL}`}
                  className="text-on-primary no-underline hover:underline"
                >
                  Contact
                </a>
              </li>
            </ul>
          </nav>
          <div>
            <p className="text-caption uppercase text-surface-sunken">Status</p>
            <p className="mt-md text-body-sm text-surface-sunken">
              Private beta · © {new Date().getFullYear()} Speqify
            </p>
          </div>
        </div>
      </footer>

      {/* Sticky mobile CTA — appears when hero CTA leaves the viewport */}
      {!hero.inView ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface p-sm lg:hidden">
          <a href={REQUEST_HREF} className="btn-primary w-full no-underline">
            Request access
          </a>
        </div>
      ) : null}
    </>
  );
}
