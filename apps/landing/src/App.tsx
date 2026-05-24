import type { CSSProperties } from "react";
import { Icons, SpeqifyWordmark, Trackers } from "@speqify/ui";

const navLinkS: CSSProperties = {
  fontSize: 13,
  color: "var(--sp-text-2)",
  fontWeight: 500,
  cursor: "pointer",
  textDecoration: "none",
};

export function App() {
  return (
    <div
      className="sp"
      style={{ width: "100%", minHeight: "100%", background: "var(--sp-bg)", color: "var(--sp-text)" }}
    >
      <Nav />
      <Hero />
      <Logos />
      <CrossBrowserSection />
      <Features />
      <Demo />
      <Integrations />
      <HowItWorks />
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
        gap: 24,
        padding: "18px 56px",
        borderBottom: "1px solid var(--sp-border)",
        background: "rgba(250,250,249,0.85)",
        backdropFilter: "blur(8px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <SpeqifyWordmark height={24} />
      <div style={{ flex: 1 }} />
      {["Product", "Integrations", "Pricing", "Docs", "Changelog", "GitHub"].map((l) => (
        <a key={l} style={navLinkS}>
          {l}
        </a>
      ))}
      <div style={{ width: 1, height: 18, background: "var(--sp-border)" }} />
      <button className="sp-btn sp-btn-primary sp-btn-sm">
        Install — no signup <Icons.ChevronR size={12} />
      </button>
    </nav>
  );
}

function Hero() {
  return (
    <section style={{ position: "relative", padding: "88px 56px 64px", textAlign: "center", overflow: "hidden" }}>
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
      <div style={{ position: "relative", maxWidth: 920, margin: "0 auto" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            background: "var(--sp-indigo-50)",
            border: "1px solid var(--sp-indigo-100)",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--sp-indigo-700)",
          }}
        >
          <Icons.Lock size={12} />
          No account required · BYO tracker keys · 100% local
        </div>
        <h1 style={{ fontSize: 64, lineHeight: 1.02, fontWeight: 650, letterSpacing: "-0.025em", margin: "20px auto 16px", maxWidth: 840 }}>
          Talk to your tracker.
          <br />
          <span style={{ color: "var(--sp-indigo-600)" }}>Speqify writes the ticket.</span>
        </h1>
        <p style={{ fontSize: 18.5, color: "var(--sp-text-2)", maxWidth: 620, margin: "0 auto", lineHeight: 1.5 }}>
          A cross-browser sidebar that captures any element on a page, records your voice, and turns it into a
          structured issue in Jira, GitHub, Linear, or GitLab. No sign-up, no servers — just your own API keys.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 28 }}>
          <button className="sp-btn sp-btn-primary sp-btn-lg">
            Install — it's free <Icons.Arrow size={14} />
          </button>
          <button className="sp-btn sp-btn-secondary sp-btn-lg">
            <Icons.Play size={12} /> Watch 60s demo
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginTop: 18, fontSize: 12, color: "var(--sp-text-3)", flexWrap: "wrap" }}>
          {["Chrome · Firefox · Safari · Edge · Arc", "No telemetry by default", "Works on any web app"].map((t) => (
            <span key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icons.Check size={12} stroke={2.4} style={{ color: "var(--sp-success)" }} /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* hero product shot */}
      <div
        style={{
          position: "relative",
          marginTop: 56,
          width: "100%",
          maxWidth: 1140,
          marginLeft: "auto",
          marginRight: "auto",
          borderRadius: 20,
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
    <div style={{ display: "flex", flexDirection: "column", height: 600 }}>
      {/* window chrome */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#F5F5F4", borderBottom: "1px solid var(--sp-border)" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#F87171", "#FCD34D", "#86EFAC"].map((c) => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: 999, background: c }} />
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid var(--sp-border)", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "var(--sp-text-2)", minWidth: 320, fontFamily: "var(--sp-mono)" }}>
            <Icons.Lock size={11} style={{ color: "var(--sp-text-3)" }} />
            console.acme.cloud/networking/lb-prod-eu-west-1
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, background: "var(--sp-indigo-50)", border: "1px solid var(--sp-indigo-100)" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--sp-indigo-700)" }}>Speqify</span>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* mock app */}
        <div style={{ flex: 1, padding: 24, background: "linear-gradient(180deg,#FAFAF9,#F5F5F4)", minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 650, letterSpacing: "-0.01em" }}>lb-prod-eu-west-1</div>
          <div style={{ fontSize: 12.5, color: "var(--sp-text-3)", marginTop: 2 }}>Response time · last 24h</div>
          <div className="sp-card" style={{ marginTop: 16, padding: 16, height: 200 }}>
            <svg viewBox="0 0 400 150" width="100%" height="100%" preserveAspectRatio="none">
              <path d="M0 110 L60 100 L120 105 L180 60 L240 40 L300 95 L360 50 L400 90" stroke="#4F46E5" strokeWidth="2" fill="none" />
              <path d="M0 110 L60 100 L120 105 L180 60 L240 40 L300 95 L360 50 L400 90 L400 150 L0 150 Z" fill="#A5B4FC" opacity="0.18" />
              <circle cx="240" cy="40" r="4" fill="#DC2626" />
            </svg>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            {["p95 · 1.4s", "5xx · 2.1%", "RPS · 8.4k"].map((s) => (
              <div key={s} className="sp-card" style={{ flex: 1, padding: 12, fontSize: 12.5, color: "var(--sp-text-2)" }}>
                {s}
              </div>
            ))}
          </div>
        </div>
        {/* sidebar */}
        <div style={{ width: 360, flexShrink: 0, background: "var(--sp-bg)", borderLeft: "1px solid var(--sp-border)" }}>
          <ReviewPreview />
        </div>
      </div>
    </div>
  );
}

function ReviewPreview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 14px", borderBottom: "1px solid var(--sp-border)", background: "var(--sp-surface)" }}>
        <SpeqifyWordmark height={18} />
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "var(--sp-text-3)" }}>Review</div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, background: "var(--sp-surface-2)", borderRadius: 10, border: "1px solid var(--sp-border)", marginBottom: 14 }}>
          <div style={{ width: 56, height: 40, borderRadius: 6, background: "#fff", border: "1px solid var(--sp-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="44" height="28" viewBox="0 0 100 60">
              <path d="M0 40 L20 35 L40 38 L60 18 L80 14 L100 36" stroke="#4F46E5" strokeWidth="1.5" fill="none" />
              <circle cx="60" cy="18" r="2.5" fill="#DC2626" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Recording · 0:47</div>
            <div style={{ fontSize: 10.5, color: "var(--sp-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>console.acme.cloud/…/lb-prod-eu-west-1</div>
          </div>
          <span className="sp-chip sp-chip-success" style={{ height: 20, fontSize: 10.5 }}>
            <Icons.Check size={9} stroke={2.4} /> Attached
          </span>
        </div>

        <FieldLabel>Issue type</FieldLabel>
        <div style={{ display: "flex", gap: 4, background: "var(--sp-surface-2)", borderRadius: 8, padding: 3, border: "1px solid var(--sp-border)", marginBottom: 14 }}>
          <span style={{ flex: 1, padding: "5px 10px", borderRadius: 5, fontSize: 11.5, fontWeight: 600, textAlign: "center", background: "#FEE2E2", color: "#DC2626" }}>Bug</span>
          <span style={{ flex: 1, padding: "5px 10px", borderRadius: 5, fontSize: 11.5, fontWeight: 600, textAlign: "center", color: "var(--sp-text-3)" }}>Task</span>
          <span style={{ flex: 1, padding: "5px 10px", borderRadius: 5, fontSize: 11.5, fontWeight: 600, textAlign: "center", color: "var(--sp-text-3)" }}>Feature</span>
        </div>

        <FieldLabel>Title</FieldLabel>
        <div className="sp-input" style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>
          p95 latency spikes to 1.4s on lb-prod-eu-west-1 after v2.18.2
        </div>

        <FieldLabel>Description</FieldLabel>
        <div className="sp-textarea" style={{ fontSize: 13, lineHeight: 1.5, color: "var(--sp-text-2)" }}>
          After the v2.18.2 deploy the EU-west load balancer returns sub-second response-time spikes (~1.4s) around
          15:00, well above the 200ms SLA. Correlates with elevated 5xx on targets t-9 and t-11.
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--sp-border)", padding: "12px 16px", background: "var(--sp-surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "var(--sp-surface-2)", border: "1px solid var(--sp-border)" }}>
          <Trackers.Jira size={18} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Jira</div>
            <div style={{ fontSize: 11, color: "var(--sp-text-3)" }}>ACME · Bugs</div>
          </div>
          <span className="sp-chip sp-chip-success" style={{ height: 20, fontSize: 10.5 }}>
            <Icons.Check size={10} stroke={2.4} /> From settings
          </span>
        </div>
        <button className="sp-btn sp-btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 10 }}>
          <Icons.Send size={13} /> Create issue
        </button>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
      {children}
    </div>
  );
}

function Logos() {
  return (
    <section style={{ padding: "40px 56px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Used at companies like
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 48, marginTop: 20, flexWrap: "wrap" }}>
        {["Northwind", "Vector Labs", "Hyperion", "Mercury Co.", "Brightline", "Stentor", "Atlas Foundry"].map((n) => (
          <div key={n} style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--sp-text-3)", opacity: 0.7 }}>
            {n}
          </div>
        ))}
      </div>
    </section>
  );
}

const BROWSERS = [
  { name: "Chrome", c: "#4285F4" },
  { name: "Firefox", c: "#FF7139" },
  { name: "Safari", c: "#1B88F4" },
  { name: "Edge", c: "#0F8BE9" },
  { name: "Brave", c: "#FB542B" },
  { name: "Arc", c: "#FB5C5C" },
  { name: "Opera", c: "#FF1B2D" },
];

function CrossBrowserStrip() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
      {BROWSERS.map((b) => (
        <span
          key={b.name}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 999,
            border: "1px solid var(--sp-border)",
            background: "var(--sp-surface)",
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--sp-text-2)",
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 999, background: b.c }} />
          {b.name}
        </span>
      ))}
    </div>
  );
}

function CrossBrowserSection() {
  return (
    <section style={{ padding: "12px 56px 60px", textAlign: "center" }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
        Available on every major browser
      </div>
      <CrossBrowserStrip />
    </section>
  );
}

const FEATURES = [
  { icon: <Icons.Crosshair size={20} />, title: "Pixel-perfect capture", body: "Click any element on any web page. Speqify attaches a cropped screenshot with the URL, viewport, and DOM path — no manual snipping." },
  { icon: <Icons.Mic size={20} />, title: "Voice notes, transcribed", body: "Talk through it like you would in standup. Speqify transcribes locally in 30+ languages with custom vocabulary for your domain terms." },
  { icon: <Icons.Sparkles size={20} />, title: "AI-drafted structure", body: "Title, description, type, priority, and labels — all auto-filled. Always editable before send." },
  { icon: <Icons.Layers size={20} />, title: "One tool, every tracker", body: "Route the issue to Jira, GitHub, Linear, or GitLab. One sidebar, every backlog." },
  { icon: <Icons.Globe size={20} />, title: "Auto-translate", body: "Record in Polish, French, or German. Speqify ships the final ticket in your working language so nothing gets lost." },
  { icon: <Icons.Bolt size={20} />, title: "One-keystroke flow", body: "⌥ S to capture, talk, stop. Speqify ships the issue while you're moving to the next problem." },
];

function Features() {
  return (
    <section style={{ padding: "60px 56px 80px" }}>
      <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 48px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sp-indigo-600)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Features</div>
        <h2 style={{ fontSize: 40, fontWeight: 650, letterSpacing: "-0.02em", margin: 0 }}>
          The fastest path from “this is broken” to a real ticket
        </h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 1140, margin: "0 auto" }}>
        {FEATURES.map((f) => (
          <div key={f.title} className="sp-card" style={{ padding: 22 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--sp-indigo-50)", color: "var(--sp-indigo-700)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              {f.icon}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 13.5, color: "var(--sp-text-3)", lineHeight: 1.55 }}>{f.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Demo() {
  return (
    <section style={{ padding: "80px 56px", background: "#1C1917", color: "#FAFAF9" }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 56, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#A5B4FC", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>See it in motion</div>
          <h2 style={{ fontSize: 40, fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1.1, margin: "0 0 16px" }}>
            60 seconds of voice
            <br />
            becomes a 4-field ticket.
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.55, color: "rgba(250,250,249,0.7)", margin: 0 }}>
            Watch how Speqify turns a rambling voice note about a latency spike into a structured Jira bug — with the
            chart screenshot, repro steps, and acceptance criteria attached.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button className="sp-btn sp-btn-lg" style={{ background: "#fff", color: "#1C1917" }}>
              <Icons.Play size={12} /> Play 60s demo
            </button>
            <button className="sp-btn sp-btn-lg" style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>
              Read the case study
            </button>
          </div>
        </div>
        <div style={{ position: "relative", aspectRatio: "16 / 10", background: "linear-gradient(135deg, #312E81, #4F46E5)", borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.4)" }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 76, height: 76, borderRadius: 999, background: "rgba(255,255,255,0.95)", color: "var(--sp-indigo-700)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
              <Icons.Play size={32} />
            </div>
          </div>
          <div style={{ position: "absolute", top: 24, left: 24, right: 24, display: "flex", alignItems: "center", gap: 2, opacity: 0.4 }}>
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
    <section style={{ padding: "80px 56px" }}>
      <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 40px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sp-indigo-600)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Integrations</div>
        <h2 style={{ fontSize: 36, fontWeight: 650, letterSpacing: "-0.02em", margin: 0 }}>Works with the tracker you already use</h2>
        <p style={{ fontSize: 15, color: "var(--sp-text-3)", marginTop: 12, lineHeight: 1.5 }}>
          Connect once in Settings. Every captured issue goes to your active tracker — switch any time.
        </p>
      </div>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {INTEGRATIONS.map((t) => {
          const L = Trackers[t.logo];
          return (
            <div key={t.name} className="sp-card" style={{ padding: 22, textAlign: "center" }}>
              <div style={{ display: "inline-flex", width: 48, height: 48, borderRadius: 12, background: "var(--sp-surface-2)", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <L size={26} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: "var(--sp-text-3)", marginTop: 2 }}>{t.detail}</div>
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
    <section style={{ padding: "80px 56px", background: "var(--sp-surface-2)" }}>
      <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 40px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sp-indigo-600)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>How it works</div>
        <h2 style={{ fontSize: 36, fontWeight: 650, letterSpacing: "-0.02em", margin: 0 }}>Four steps. About forty seconds.</h2>
      </div>
      <div style={{ maxWidth: 1140, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {STEPS.map((s) => (
          <div key={s.n} className="sp-card" style={{ padding: 22 }}>
            <div style={{ fontFamily: "var(--sp-mono)", fontSize: 11.5, color: "var(--sp-indigo-600)", fontWeight: 600, marginBottom: 12 }}>{s.n}</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{s.t}</div>
            <div style={{ fontSize: 13, color: "var(--sp-text-3)", lineHeight: 1.55 }}>{s.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const FAQ = [
  { q: "Do you keep my audio?", a: "No — by default the raw audio never leaves your machine. With local models, transcription happens entirely on-device; the audio is discarded after transcription." },
  { q: "Which browsers do you support?", a: "Chrome, Edge, Brave, and Arc today. Firefox and Safari are supported via the same cross-browser build." },
  { q: "Can I use Speqify on internal apps?", a: "Yes. Speqify works on any page you can open, including localhost, staging environments, and intranet apps behind SSO." },
  { q: "Where do my tracker keys live?", a: "Only in your browser's local storage. There is no Speqify account and no server — nothing leaves except the ticket you create." },
  { q: "Do I need an account?", a: "No. Speqify works straight out of the install. You paste your own tracker API key and everything stays in your browser." },
  { q: "Is it free?", a: "Yes — the extension is free. Run models locally at no cost, or bring your own API key for a cloud endpoint." },
];

function Faq() {
  return (
    <section style={{ padding: "80px 56px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sp-indigo-600)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>FAQ</div>
          <h2 style={{ fontSize: 36, fontWeight: 650, letterSpacing: "-0.02em", margin: 0 }}>Common questions</h2>
        </div>
        {FAQ.map((f, i) => (
          <details key={i} style={{ borderTop: "1px solid var(--sp-border)", padding: "18px 4px" }}>
            <summary style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", listStyle: "none", fontSize: 16, fontWeight: 600 }}>
              {f.q}
              <Icons.Plus size={16} style={{ color: "var(--sp-text-3)" }} />
            </summary>
            <div style={{ fontSize: 14, color: "var(--sp-text-3)", lineHeight: 1.55, marginTop: 10 }}>{f.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section style={{ padding: "60px 56px 100px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", background: "linear-gradient(135deg, var(--sp-indigo-600), var(--sp-indigo-800))", borderRadius: 24, padding: "64px 48px", color: "#fff", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15), transparent 40%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1), transparent 40%)" }} />
        <div style={{ position: "relative" }}>
          <h2 style={{ fontSize: 44, fontWeight: 650, letterSpacing: "-0.02em", margin: "0 0 12px" }}>Stop typing tickets. Start talking.</h2>
          <p style={{ fontSize: 17, opacity: 0.85, maxWidth: 540, margin: "0 auto 28px" }}>
            Install Speqify and your next captured bug ships before your coffee gets cold.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="sp-btn sp-btn-lg" style={{ background: "#fff", color: "var(--sp-indigo-700)" }}>
              Install for your browser <Icons.Arrow size={14} />
            </button>
            <button className="sp-btn sp-btn-lg" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)" }}>
              Read the docs
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ padding: "40px 56px 32px", borderTop: "1px solid var(--sp-border)", background: "var(--sp-surface)" }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <SpeqifyWordmark height={18} />
        <span style={{ fontSize: 12, color: "var(--sp-text-3)" }}>© 2026 Speqify, Inc.</span>
        <div style={{ flex: 1 }} />
        {["Product", "Pricing", "Docs", "Security", "Privacy", "Status"].map((l) => (
          <a key={l} style={{ fontSize: 12.5, color: "var(--sp-text-3)", textDecoration: "none", cursor: "pointer" }}>
            {l}
          </a>
        ))}
      </div>
    </footer>
  );
}
