import type { CSSProperties } from "react";
import { Icons, SpeqifyWordmark, Trackers } from "@speqify/ui";

const navLinkS: CSSProperties = {
  fontSize: 16,
  color: "var(--sp-text-2)",
  fontWeight: 500,
  cursor: "pointer",
  textDecoration: "none",
};

const GITHUB_URL = "https://github.com/jaroslawkaczmarski/Speqify";
const noUnderline: CSSProperties = { textDecoration: "none" };

const NAV_LINKS = [
  { label: "Product", href: "#features" },
  { label: "Integrations", href: "#integrations" },
  { label: "Open source", href: "#open-source" },
  { label: "FAQ", href: "#faq" },
];

export function App() {
  return (
    <div
      className="sp"
      style={{ width: "100%", minHeight: "100%", background: "var(--sp-bg)", color: "var(--sp-text)" }}
    >
      <Nav />
      <Hero />
      <OpenSourceBand />
      <CrossBrowserSection />
      <Features />
      <Demo />
      <Integrations />
      <HowItWorks />
      <OpenSource />
      <Faq />
      <Cta />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 29,
        padding: "22px 67px",
        borderBottom: "1px solid var(--sp-border)",
        background: "rgba(250,250,249,0.85)",
        backdropFilter: "blur(8px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <SpeqifyWordmark height={29} />
      <div style={{ flex: 1 }} />
      {NAV_LINKS.map((l) => (
        <a key={l.label} href={l.href} style={navLinkS}>
          {l.label}
        </a>
      ))}
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        style={{ ...navLinkS, display: "inline-flex", alignItems: "center", gap: 7 }}
      >
        <Trackers.GitHub size={18} /> GitHub
      </a>
      <div style={{ width: 1, height: 22, background: "var(--sp-border)" }} />
      <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="sp-btn sp-btn-primary sp-btn-sm" style={noUnderline}>
        Install — free <Icons.ChevronR size={14} />
      </a>
    </nav>
  );
}

function Hero() {
  return (
    <section style={{ position: "relative", padding: "106px 67px 77px", textAlign: "center", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(28,25,23,0.05) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 80%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", maxWidth: 1104, margin: "0 auto" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 14px",
            background: "var(--sp-indigo-50)",
            border: "1px solid var(--sp-indigo-100)",
            borderRadius: 1199,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--sp-indigo-700)",
          }}
        >
          <Icons.Lock size={14} />
          Open source · No account required · 100% local
        </div>
        <h1 style={{ fontSize: 77, lineHeight: 1.02, fontWeight: 650, letterSpacing: "-0.025em", margin: "24px auto 19px", maxWidth: 1008 }}>
          Talk to your tracker.
          <br />
          <span style={{ color: "var(--sp-indigo-600)" }}>Speqify writes the ticket.</span>
        </h1>
        <p style={{ fontSize: 22, color: "var(--sp-text-2)", maxWidth: 744, margin: "0 auto", lineHeight: 1.5 }}>
          A cross-browser sidebar that captures any element on a page, records your voice, and turns it into a
          structured issue in Jira, GitHub, Linear, or GitLab. No sign-up, no servers — just your own API keys.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 34 }}>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="sp-btn sp-btn-primary sp-btn-lg" style={noUnderline}>
            Install — it's free <Icons.Arrow size={17} />
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="sp-btn sp-btn-secondary sp-btn-lg" style={noUnderline}>
            <Trackers.GitHub size={17} /> View source on GitHub
          </a>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, marginTop: 22, fontSize: 14, color: "var(--sp-text-3)", flexWrap: "wrap" }}>
          {["Chrome · Edge · Brave · Arc · Firefox", "Free & open source (MIT)", "No telemetry by default"].map((t) => (
            <span key={t} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Icons.Check size={14} stroke={2.4} style={{ color: "var(--sp-success)" }} /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* hero product shot */}
      <div
        style={{
          position: "relative",
          marginTop: 67,
          width: "100%",
          maxWidth: 1368,
          marginLeft: "auto",
          marginRight: "auto",
          borderRadius: 24,
          background: "#fff",
          boxShadow: "0 32px 80px rgba(28,25,23,0.16), 0 4px 16px rgba(28,25,23,0.08)",
          border: "1px solid var(--sp-border-2)",
          overflow: "hidden",
        }}
      >
        <HeroShot />
      </div>
    </section>
  );
}

/** Faithful static product shot: browser chrome + app + Speqify sidebar (review state). */
function HeroShot() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: 720 }}>
      {/* window chrome */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 17px", background: "#F5F5F4", borderBottom: "1px solid var(--sp-border)" }}>
        <div style={{ display: "flex", gap: 7 }}>
          {["#F87171", "#FCD34D", "#86EFAC"].map((c) => (
            <div key={c} style={{ width: 14, height: 14, borderRadius: 1199, background: c }} />
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid var(--sp-border)", borderRadius: 10, padding: "6px 14px", fontSize: 14, color: "var(--sp-text-2)", minWidth: 384, fontFamily: "var(--sp-mono)" }}>
            <Icons.Lock size={13} style={{ color: "var(--sp-text-3)" }} />
            console.acme.cloud/networking/lb-prod-eu-west-1
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, background: "var(--sp-indigo-50)", border: "1px solid var(--sp-indigo-100)" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--sp-indigo-700)" }}>Speqify</span>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* mock app */}
        <div style={{ flex: 1, padding: 29, background: "linear-gradient(180deg,#FAFAF9,#F5F5F4)", minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 650, letterSpacing: "-0.01em" }}>lb-prod-eu-west-1</div>
          <div style={{ fontSize: 15, color: "var(--sp-text-3)", marginTop: 2 }}>Response time · last 24h</div>
          <div className="sp-card" style={{ marginTop: 19, padding: 19, height: 240 }}>
            <svg viewBox="0 0 400 150" width="100%" height="100%" preserveAspectRatio="none">
              <path d="M0 110 L60 100 L120 105 L180 60 L240 40 L300 95 L360 50 L400 90" stroke="#4F46E5" strokeWidth="2" fill="none" />
              <path d="M0 110 L60 100 L120 105 L180 60 L240 40 L300 95 L360 50 L400 90 L400 150 L0 150 Z" fill="#A5B4FC" opacity="0.18" />
              <circle cx="240" cy="40" r="4" fill="#DC2626" />
            </svg>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 19 }}>
            {["p95 · 1.4s", "5xx · 2.1%", "RPS · 8.4k"].map((s) => (
              <div key={s} className="sp-card" style={{ flex: 1, padding: 14, fontSize: 15, color: "var(--sp-text-2)" }}>
                {s}
              </div>
            ))}
          </div>
        </div>
        {/* sidebar */}
        <div style={{ width: 432, flexShrink: 0, background: "var(--sp-bg)", borderLeft: "1px solid var(--sp-border)" }}>
          <ReviewPreview />
        </div>
      </div>
    </div>
  );
}

function ReviewPreview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "14px 17px", borderBottom: "1px solid var(--sp-border)", background: "var(--sp-surface)" }}>
        <SpeqifyWordmark height={22} />
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: "var(--sp-text-3)" }}>Review</div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", padding: "17px 19px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "var(--sp-surface-2)", borderRadius: 12, border: "1px solid var(--sp-border)", marginBottom: 17 }}>
          <div style={{ width: 67, height: 48, borderRadius: 7, background: "#fff", border: "1px solid var(--sp-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="44" height="28" viewBox="0 0 100 60">
              <path d="M0 40 L20 35 L40 38 L60 18 L80 14 L100 36" stroke="#4F46E5" strokeWidth="1.5" fill="none" />
              <circle cx="60" cy="18" r="2.5" fill="#DC2626" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Recording · 0:47</div>
            <div style={{ fontSize: 13, color: "var(--sp-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>console.acme.cloud/…/lb-prod-eu-west-1</div>
          </div>
          <span className="sp-chip sp-chip-success" style={{ height: 24, fontSize: 13 }}>
            <Icons.Check size={11} stroke={2.4} /> Attached
          </span>
        </div>

        <FieldLabel>Issue type</FieldLabel>
        <div style={{ display: "flex", gap: 5, background: "var(--sp-surface-2)", borderRadius: 10, padding: 4, border: "1px solid var(--sp-border)", marginBottom: 17 }}>
          <span style={{ flex: 1, padding: "6px 12px", borderRadius: 6, fontSize: 14, fontWeight: 600, textAlign: "center", background: "#FEE2E2", color: "#DC2626" }}>Bug</span>
          <span style={{ flex: 1, padding: "6px 12px", borderRadius: 6, fontSize: 14, fontWeight: 600, textAlign: "center", color: "var(--sp-text-3)" }}>Task</span>
          <span style={{ flex: 1, padding: "6px 12px", borderRadius: 6, fontSize: 14, fontWeight: 600, textAlign: "center", color: "var(--sp-text-3)" }}>Feature</span>
        </div>

        <FieldLabel>Title</FieldLabel>
        <div className="sp-input" style={{ fontWeight: 600, fontSize: 17, marginBottom: 17 }}>
          p95 latency spikes to 1.4s on lb-prod-eu-west-1 after v2.18.2
        </div>

        <FieldLabel>Description</FieldLabel>
        <div className="sp-textarea" style={{ fontSize: 16, lineHeight: 1.5, color: "var(--sp-text-2)" }}>
          After the v2.18.2 deploy the EU-west load balancer returns sub-second response-time spikes (~1.4s) around
          15:00, well above the 200ms SLA. Correlates with elevated 5xx on targets t-9 and t-11.
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--sp-border)", padding: "14px 19px", background: "var(--sp-surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: "var(--sp-surface-2)", border: "1px solid var(--sp-border)" }}>
          <Trackers.Jira size={22} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Jira</div>
            <div style={{ fontSize: 13, color: "var(--sp-text-3)" }}>ACME · Bugs</div>
          </div>
          <span className="sp-chip sp-chip-success" style={{ height: 24, fontSize: 13 }}>
            <Icons.Check size={12} stroke={2.4} /> From settings
          </span>
        </div>
        <button className="sp-btn sp-btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>
          <Icons.Send size={16} /> Create issue
        </button>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 7 }}>
      {children}
    </div>
  );
}

const OSS_SIGNALS = [
  "Free forever",
  "MIT licensed",
  "No accounts",
  "No telemetry",
  "Self-hostable AI",
  "BYO API keys",
];

function OpenSourceBand() {
  return (
    <section style={{ padding: "48px 67px 29px", textAlign: "center" }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Open source · built in the open
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 24, flexWrap: "wrap" }}>
        {OSS_SIGNALS.map((n) => (
          <span
            key={n}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 1199,
              border: "1px solid var(--sp-border)",
              background: "var(--sp-surface)",
              fontSize: 16,
              fontWeight: 600,
              color: "var(--sp-text-2)",
            }}
          >
            <Icons.Check size={14} stroke={2.4} style={{ color: "var(--sp-success)" }} /> {n}
          </span>
        ))}
      </div>
    </section>
  );
}

const BROWSERS = [
  { name: "Chrome", c: "#4285F4" },
  { name: "Firefox", c: "#FF7139" },  { name: "Edge", c: "#0F8BE9" },
  { name: "Brave", c: "#FB542B" },
  { name: "Arc", c: "#FB5C5C" },
  { name: "Opera", c: "#FF1B2D" },
];

function CrossBrowserStrip() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 17, flexWrap: "wrap" }}>
      {BROWSERS.map((b) => (
        <span
          key={b.name}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 19px",
            borderRadius: 1199,
            border: "1px solid var(--sp-border)",
            background: "var(--sp-surface)",
            fontSize: 16,
            fontWeight: 600,
            color: "var(--sp-text-2)",
          }}
        >
          <span style={{ width: 12, height: 12, borderRadius: 1199, background: b.c }} />
          {b.name}
        </span>
      ))}
    </div>
  );
}

function CrossBrowserSection() {
  return (
    <section style={{ padding: "14px 67px 72px", textAlign: "center" }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 17 }}>
        Available on every major browser
      </div>
      <CrossBrowserStrip />
    </section>
  );
}

const FEATURES = [
  { icon: <Icons.Crosshair size={24} />, title: "Pixel-perfect capture", body: "Click any element on any web page. Speqify attaches a cropped screenshot with the URL, viewport, and DOM path — no manual snipping." },
  { icon: <Icons.Mic size={24} />, title: "Voice notes, transcribed", body: "Talk through it like you would in standup. Speqify transcribes locally in 30+ languages with custom vocabulary for your domain terms." },
  { icon: <Icons.Sparkles size={24} />, title: "AI-drafted structure", body: "Title, description, type, priority, and labels — all auto-filled. Always editable before send." },
  { icon: <Icons.Layers size={24} />, title: "One tool, every tracker", body: "Route the issue to Jira, GitHub, Linear, or GitLab. One sidebar, every backlog." },
  { icon: <Icons.Globe size={24} />, title: "Auto-translate", body: "Record in Polish, French, or German. Speqify ships the final ticket in your working language so nothing gets lost." },
  { icon: <Icons.Bolt size={24} />, title: "One-keystroke flow", body: "⌥ S to capture, talk, stop. Speqify ships the issue while you're moving to the next problem." },
];

function Features() {
  return (
    <section id="features" style={{ padding: "72px 67px 96px" }}>
      <div style={{ textAlign: "center", maxWidth: 864, margin: "0 auto 58px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--sp-indigo-600)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Features</div>
        <h2 style={{ fontSize: 48, fontWeight: 650, letterSpacing: "-0.02em", margin: 0 }}>
          The fastest path from “this is broken” to a real ticket
        </h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 19, maxWidth: 1368, margin: "0 auto" }}>
        {FEATURES.map((f) => (
          <div key={f.title} className="sp-card" style={{ padding: 26 }}>
            <div style={{ width: 43, height: 43, borderRadius: 11, background: "var(--sp-indigo-50)", color: "var(--sp-indigo-700)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 17 }}>
              {f.icon}
            </div>
            <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 7 }}>{f.title}</div>
            <div style={{ fontSize: 16, color: "var(--sp-text-3)", lineHeight: 1.55 }}>{f.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Demo() {
  return (
    <section style={{ padding: "96px 67px", background: "#1C1917", color: "#FAFAF9" }}>
      <div style={{ maxWidth: 1368, margin: "0 auto", display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 67, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#A5B4FC", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>See it in motion</div>
          <h2 style={{ fontSize: 48, fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1.1, margin: "0 0 19px" }}>
            60 seconds of voice
            <br />
            becomes a 4-field ticket.
          </h2>
          <p style={{ fontSize: 19, lineHeight: 1.55, color: "rgba(250,250,249,0.7)", margin: 0 }}>
            Watch how Speqify turns a rambling voice note about a latency spike into a structured Jira bug — with the
            chart screenshot, repro steps, and acceptance criteria attached.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 29 }}>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="sp-btn sp-btn-lg" style={{ background: "#fff", color: "#1C1917", textDecoration: "none" }}>
              View source on GitHub
            </a>
          </div>
        </div>
        <div style={{ position: "relative", aspectRatio: "16 / 10", background: "linear-gradient(135deg, #312E81, #4F46E5)", borderRadius: 19, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.4)" }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 91, height: 91, borderRadius: 1199, background: "rgba(255,255,255,0.95)", color: "var(--sp-indigo-700)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
              <Icons.Play size={38} />
            </div>
          </div>
          <div style={{ position: "absolute", top: 29, left: 29, right: 29, display: "flex", alignItems: "center", gap: 2, opacity: 0.4 }}>
            {Array.from({ length: 60 }).map((_, i) => (
              <div key={i} style={{ width: 2, height: `${10 + Math.abs(Math.sin(i * 0.4)) * 30}px`, background: "#fff", borderRadius: 1 }} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const INTEGRATIONS = [
  { name: "Jira", logo: "Jira", detail: "Cloud & Data Center" },
  { name: "GitHub Issues", logo: "GitHub", detail: "Public & private repos" },
  { name: "Linear", logo: "Linear", detail: "Workspace API" },
  { name: "GitLab Issues", logo: "GitLab", detail: "gitlab.com & self-hosted" },
] as const;

function Integrations() {
  return (
    <section id="integrations" style={{ padding: "96px 67px" }}>
      <div style={{ textAlign: "center", maxWidth: 864, margin: "0 auto 48px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--sp-indigo-600)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Integrations</div>
        <h2 style={{ fontSize: 43, fontWeight: 650, letterSpacing: "-0.02em", margin: 0 }}>Works with the tracker you already use</h2>
        <p style={{ fontSize: 18, color: "var(--sp-text-3)", marginTop: 14, lineHeight: 1.5 }}>
          Connect once in Settings. Every captured issue goes to your active tracker — switch any time.
        </p>
      </div>
      <div style={{ maxWidth: 1176, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {INTEGRATIONS.map((t) => {
          const L = Trackers[t.logo];
          return (
            <div key={t.name} className="sp-card" style={{ padding: 26, textAlign: "center" }}>
              <div style={{ display: "inline-flex", width: 58, height: 58, borderRadius: 14, background: "var(--sp-surface-2)", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <L size={31} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 14, color: "var(--sp-text-3)", marginTop: 2 }}>{t.detail}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", t: "Pick an element", d: "Click anywhere on the page. Speqify grabs a cropped screenshot and the URL." },
  { n: "02", t: "Talk it out", d: "Hit record and explain it in your own words. We transcribe in real time, on-device." },
  { n: "03", t: "Review the draft", d: "AI-suggested title, description, labels, and type. Tweak anything you want." },
  { n: "04", t: "Ship the ticket", d: "One click to create the issue in Jira, GitHub, Linear, or GitLab." },
];

function HowItWorks() {
  return (
    <section style={{ padding: "96px 67px", background: "var(--sp-surface-2)" }}>
      <div style={{ textAlign: "center", maxWidth: 864, margin: "0 auto 48px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--sp-indigo-600)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>How it works</div>
        <h2 style={{ fontSize: 43, fontWeight: 650, letterSpacing: "-0.02em", margin: 0 }}>Four steps. About forty seconds.</h2>
      </div>
      <div style={{ maxWidth: 1368, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 19 }}>
        {STEPS.map((s) => (
          <div key={s.n} className="sp-card" style={{ padding: 26 }}>
            <div style={{ fontFamily: "var(--sp-mono)", fontSize: 14, color: "var(--sp-indigo-600)", fontWeight: 600, marginBottom: 14 }}>{s.n}</div>
            <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 7 }}>{s.t}</div>
            <div style={{ fontSize: 16, color: "var(--sp-text-3)", lineHeight: 1.55 }}>{s.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const OSS_CARDS = [
  {
    icon: <Icons.Bolt size={24} />,
    title: "$0 — free forever",
    body: "No subscriptions, no seats, no paywalled features. Run the on-device models and the whole flow costs nothing.",
  },
  {
    icon: <Icons.Layers size={24} />,
    title: "MIT licensed",
    body: "Read every line, fork it, audit it, ship your own build. Extension, core, and UI are all open on GitHub.",
  },
  {
    icon: <Icons.Lock size={24} />,
    title: "Your keys, your data",
    body: "Tracker tokens and AI keys live only in your browser. No Speqify account, no server, no telemetry by default.",
  },
  {
    icon: <Icons.Cog size={24} />,
    title: "Self-host the AI",
    body: "Run Whisper + Qwen on-device, or point Speqify at any OpenAI-compatible endpoint you control.",
  },
];

function OpenSource() {
  return (
    <section id="open-source" style={{ padding: "96px 67px" }}>
      <div style={{ textAlign: "center", maxWidth: 864, margin: "0 auto 48px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--sp-indigo-600)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          Open source
        </div>
        <h2 style={{ fontSize: 43, fontWeight: 650, letterSpacing: "-0.02em", margin: 0 }}>Free, and free to inspect</h2>
        <p style={{ fontSize: 18, color: "var(--sp-text-3)", marginTop: 14, lineHeight: 1.5 }}>
          Speqify has no paid tiers and no catch. There's no backend and no account — you bring your own tracker keys,
          and the AI runs locally or against an endpoint you choose. The whole thing is on GitHub under the MIT license.
        </p>
      </div>
      <div style={{ maxWidth: 1176, margin: "0 auto 38px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {OSS_CARDS.map((c) => (
          <div key={c.title} className="sp-card" style={{ padding: 26 }}>
            <div style={{ width: 43, height: 43, borderRadius: 11, background: "var(--sp-indigo-50)", color: "var(--sp-indigo-700)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 17 }}>
              {c.icon}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 7 }}>{c.title}</div>
            <div style={{ fontSize: 15, color: "var(--sp-text-3)", lineHeight: 1.55 }}>{c.body}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="sp-btn sp-btn-primary sp-btn-lg" style={noUnderline}>
          View on GitHub <Icons.Arrow size={17} />
        </a>
        <a href={`${GITHUB_URL}#readme`} target="_blank" rel="noreferrer" className="sp-btn sp-btn-secondary sp-btn-lg" style={noUnderline}>
          Read the README
        </a>
      </div>
    </section>
  );
}

const FAQ = [
  { q: "Do you keep my audio?", a: "No — by default the raw audio never leaves your machine. With local models, transcription happens entirely on-device; the audio is discarded after transcription." },
  { q: "Which browsers do you support?", a: "Chromium browsers (Chrome, Edge, Brave, Arc, Opera) today, plus a Firefox build. Safari is planned." },
  { q: "Can I use Speqify on internal apps?", a: "Yes. Speqify works on any page you can open, including localhost, staging environments, and intranet apps behind SSO." },
  { q: "Where do my tracker keys live?", a: "Only in your browser's local storage. There is no Speqify account and no server — nothing leaves except the ticket you create." },
  { q: "Do I need an account?", a: "No. Speqify works straight out of the install. You paste your own tracker API key and everything stays in your browser." },
  { q: "Is it free? What does it cost?", a: "It's free — there are no paid tiers and no accounts. Speqify is open source under the MIT license, so it's $0 forever. Run the models locally at no cost, or bring your own API key for a cloud endpoint." },
  { q: "Is Speqify open source?", a: "Yes. The extension, the shared core, and the UI are all on GitHub under the MIT license. Read the code, audit it, fork it, self-host it, or open a pull request." },
];

function Faq() {
  return (
    <section id="faq" style={{ padding: "96px 67px" }}>
      <div style={{ maxWidth: 912, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 38 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--sp-indigo-600)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>FAQ</div>
          <h2 style={{ fontSize: 43, fontWeight: 650, letterSpacing: "-0.02em", margin: 0 }}>Common questions</h2>
        </div>
        {FAQ.map((f, i) => (
          <details key={i} style={{ borderTop: "1px solid var(--sp-border)", padding: "22px 5px" }}>
            <summary style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", listStyle: "none", fontSize: 19, fontWeight: 600 }}>
              {f.q}
              <Icons.Plus size={19} style={{ color: "var(--sp-text-3)" }} />
            </summary>
            <div style={{ fontSize: 17, color: "var(--sp-text-3)", lineHeight: 1.55, marginTop: 12 }}>{f.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section style={{ padding: "72px 67px 120px" }}>
      <div style={{ maxWidth: 1296, margin: "0 auto", background: "linear-gradient(135deg, var(--sp-indigo-600), var(--sp-indigo-800))", borderRadius: 29, padding: "77px 58px", color: "#fff", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15), transparent 40%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1), transparent 40%)" }} />
        <div style={{ position: "relative" }}>
          <h2 style={{ fontSize: 53, fontWeight: 650, letterSpacing: "-0.02em", margin: "0 0 14px" }}>Stop typing tickets. Start talking.</h2>
          <p style={{ fontSize: 20, opacity: 0.85, maxWidth: 648, margin: "0 auto 34px" }}>
            Install Speqify and your next captured bug ships before your coffee gets cold.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="sp-btn sp-btn-lg" style={{ background: "#fff", color: "var(--sp-indigo-700)", textDecoration: "none" }}>
              Install — it's free <Icons.Arrow size={17} />
            </a>
            <a href={`${GITHUB_URL}#readme`} target="_blank" rel="noreferrer" className="sp-btn sp-btn-lg" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", textDecoration: "none" }}>
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ padding: "48px 67px 38px", borderTop: "1px solid var(--sp-border)", background: "var(--sp-surface)" }}>
      <div style={{ maxWidth: 1368, margin: "0 auto", display: "flex", alignItems: "center", gap: 29, flexWrap: "wrap" }}>
        <SpeqifyWordmark height={22} />
        <span style={{ fontSize: 14, color: "var(--sp-text-3)" }}>© 2026 Speqify · MIT licensed</span>
        <div style={{ flex: 1 }} />
        {[
          { label: "Product", href: "#features" },
          { label: "Integrations", href: "#integrations" },
          { label: "Open source", href: "#open-source" },
          { label: "FAQ", href: "#faq" },
          { label: "GitHub", href: GITHUB_URL },
        ].map((l) => (
          <a
            key={l.label}
            href={l.href}
            {...(l.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
            style={{ fontSize: 15, color: "var(--sp-text-3)", textDecoration: "none", cursor: "pointer" }}
          >
            {l.label}
          </a>
        ))}
      </div>
    </footer>
  );
}
