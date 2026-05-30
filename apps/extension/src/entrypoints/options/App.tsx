import { useEffect, useRef, useState, type ReactNode } from "react";
import { browser } from "#imports";
import { Icons, SpeqifyWordmark, Trackers, type TrackerLogoName } from "@speqify/ui";
import type { TicketType, TrackerConfig, TrackerKind } from "@speqify/core";
import { useSettings, type AiConfig, type AiMode, type LocalTier, type RemoteEndpoint } from "@/store";
import { useLocalDownload, type DownloadKind } from "@/ai/download-store";
import { probeNano, type NanoStatus } from "@/ai/chrome-ai";
import { SHORTCUTS } from "@/lib/shortcuts";
import { Toggle } from "@/panel/controls";

type Section = "integrations" | "voice" | "templates" | "shortcuts" | "privacy" | "about";

const SECTIONS: { id: Section; label: string; icon: ReactNode }[] = [
  { id: "integrations", label: "Integrations", icon: <Icons.Layers size={17} /> },
  { id: "voice", label: "Voice & AI", icon: <Icons.Sparkles size={17} /> },
  { id: "templates", label: "Templates", icon: <Icons.Edit size={17} /> },
  { id: "shortcuts", label: "Shortcuts", icon: <Icons.Bolt size={17} /> },
  { id: "privacy", label: "Privacy & data", icon: <Icons.Lock size={17} /> },
  { id: "about", label: "About", icon: <Icons.Sparkles size={17} /> },
];

/**
 * Map the URL hash to a settings section + optional focus target. The hash is
 * `#<section>` or `#<section>:<focus>` (e.g. `#voice:mic` deep-links to Voice & AI
 * and highlights the microphone control).
 */
function parseHash(): { section: Section | null; focus: string | null } {
  if (typeof location === "undefined") return { section: null, focus: null };
  const [h, focus] = location.hash.replace(/^#/, "").split(":");
  return { section: SECTIONS.some((s) => s.id === h) ? (h as Section) : null, focus: focus || null };
}

function closeSettingsTab() {
  browser.tabs
    .getCurrent()
    .then((t) => {
      if (t?.id != null) void browser.tabs.remove(t.id);
      else window.close();
    })
    .catch(() => window.close());
}

export function SettingsApp() {
  const [section, setSection] = useState<Section>(() => parseHash().section ?? "integrations");
  const [focus, setFocus] = useState<string | null>(() => parseHash().focus);
  const hydrated = useSettings((s) => s.hydrated);

  // Honour deep-links like options.html#voice:mic, including when the panel re-points an
  // already-open settings tab (which only changes the hash → fires hashchange).
  useEffect(() => {
    const onHash = () => {
      const { section: s, focus: f } = parseHash();
      if (s) setSection(s);
      setFocus(f);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="sp" style={{ width: "100%", minHeight: "100vh", background: "var(--sp-bg)", display: "flex", color: "var(--sp-text)" }}>
      {/* sidenav */}
      <div style={{ width: 264, background: "var(--sp-surface)", borderRight: "1px solid var(--sp-border)", padding: "24px 14px", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "0 10px 19px" }}>
          <SpeqifyWordmark height={24} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "10px 12px 5px" }}>Settings</div>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setSection(s.id);
              setFocus(null);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 7,
              border: "none",
              background: section === s.id ? "var(--sp-indigo-50)" : "transparent",
              color: section === s.id ? "var(--sp-indigo-700)" : "var(--sp-text-2)",
              fontSize: 16,
              fontWeight: section === s.id ? 600 : 500,
              cursor: "pointer",
              textAlign: "left",
              marginBottom: 2,
            }}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: 14, background: "var(--sp-surface-2)", borderRadius: 12, border: "1px solid var(--sp-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}>
            <Icons.Lock size={13} style={{ color: "var(--sp-success)" }} /> Local-first
          </div>
          <div style={{ fontSize: 13, color: "var(--sp-text-3)", marginTop: 5, lineHeight: 1.4 }}>
            No Speqify account. Your tracker API keys stay in your browser.
          </div>
        </div>
      </div>

      {/* content */}
      <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 29px", background: "var(--sp-bg)", borderBottom: "1px solid var(--sp-border)" }}>
          <button onClick={closeSettingsTab} className="sp-btn sp-btn-secondary sp-btn-sm">
            <Icons.X size={14} /> Close settings
          </button>
        </div>
        <div style={{ padding: "34px 48px 58px" }}>
          {!hydrated ? (
            <div style={{ color: "var(--sp-text-3)", fontSize: 16 }}>Loading…</div>
          ) : section === "integrations" ? (
            <IntegrationsSection />
          ) : section === "voice" ? (
            <VoiceSection focusTarget={focus} />
          ) : section === "templates" ? (
            <TemplatesSection />
          ) : (
            <SimpleSection id={section} />
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <div style={{ fontSize: 26, fontWeight: 650, letterSpacing: "-0.01em" }}>{title}</div>
      <div style={{ fontSize: 16, color: "var(--sp-text-3)", marginTop: 5 }}>{sub}</div>
    </>
  );
}

const TRACKER_META: Record<TrackerKind, { name: string; logo: TrackerLogoName }> = {
  jira: { name: "Jira", logo: "Jira" },
  github: { name: "GitHub Issues", logo: "GitHub" },
  linear: { name: "Linear", logo: "Linear" },
  gitlab: { name: "GitLab Issues", logo: "GitLab" },
};

function subOf(t: TrackerConfig): string {
  switch (t.kind) {
    case "jira":
      return `${t.site} · ${t.projectKey}`;
    case "github":
      return `${t.owner}/${t.repo}`;
    case "linear":
      return t.teamId;
    case "gitlab":
      return t.projectId;
  }
}

function IntegrationsSection() {
  const { tracker, setTracker } = useSettings();
  const [connecting, setConnecting] = useState<TrackerKind | null>(null);

  const others = (Object.keys(TRACKER_META) as TrackerKind[]).filter((k) => k !== tracker?.kind);

  return (
    <div style={{ maxWidth: 864 }}>
      <SectionHeading title="Integration" sub="One active tracker at a time. Every new ticket goes here." />

      {tracker && (
        <div style={{ marginTop: 29 }}>
          <Label>Active tracker</Label>
          {(() => {
            const meta = TRACKER_META[tracker.kind];
            const L = Trackers[meta.logo];
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 17, padding: "19px 22px", background: "var(--sp-surface)", border: "1px solid var(--sp-indigo-100)", borderRadius: 12, boxShadow: "0 0 0 2px var(--sp-indigo-50)" }}>
                <div style={{ width: 53, height: 53, borderRadius: 12, background: "var(--sp-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <L size={29} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 17, fontWeight: 650 }}>{meta.name}</span>
                    <span className="sp-chip sp-chip-success">
                      <Icons.Check size={12} stroke={2.4} /> Connected
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--sp-text-3)", marginTop: 2 }}>{subOf(tracker)}</div>
                </div>
                <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => setConnecting(tracker.kind)}>Configure</button>
                <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={() => setTracker(null)}>Disconnect</button>
              </div>
            );
          })()}
        </div>
      )}

      <div style={{ marginTop: 34 }}>
        <Label>{tracker ? "Switch to another tracker" : "Connect a tracker"}</Label>
        <div style={{ fontSize: 14, color: "var(--sp-text-3)", marginBottom: 12, lineHeight: 1.4 }}>
          {tracker
            ? "Connecting another tracker replaces the current active destination. Switch any time."
            : "Pick where Speqify should create your issues. Credentials stay in your browser."}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {others.map((k) => {
            const meta = TRACKER_META[k];
            const L = Trackers[meta.logo];
            return (
              <button
                key={k}
                onClick={() => setConnecting(k)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 17px", cursor: "pointer", textAlign: "left", background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 12 }}
              >
                <L size={24} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{meta.name}</div>
                  <div style={{ fontSize: 13, color: "var(--sp-text-3)" }}>Connect…</div>
                </div>
                <Icons.Plus size={14} style={{ color: "var(--sp-text-3)" }} />
              </button>
            );
          })}
        </div>
      </div>

      {connecting && (
        <ConnectForm
          kind={connecting}
          initial={tracker?.kind === connecting ? tracker : undefined}
          onCancel={() => setConnecting(null)}
          onSave={(cfg) => {
            setTracker(cfg);
            setConnecting(null);
          }}
        />
      )}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function field(f: Record<string, string>, k: string) {
  return (f[k] ?? "").trim();
}

function buildConfig(kind: TrackerKind, f: Record<string, string>): TrackerConfig | null {
  const v = (k: string) => field(f, k);
  switch (kind) {
    case "github":
      return v("owner") && v("repo") && v("token") ? { kind, owner: v("owner"), repo: v("repo"), token: v("token") } : null;
    case "jira":
      return v("site") && v("email") && v("token") && v("projectKey")
        ? { kind, site: v("site"), email: v("email"), token: v("token"), projectKey: v("projectKey"), issueType: v("issueType") || "Task" }
        : null;
    case "linear":
      return v("apiKey") && v("teamId") ? { kind, apiKey: v("apiKey"), teamId: v("teamId") } : null;
    case "gitlab":
      return v("projectId") && v("token") ? { kind, baseUrl: v("baseUrl") || undefined, projectId: v("projectId"), token: v("token") } : null;
  }
}

function toFields(t: TrackerConfig | undefined): Record<string, string> {
  if (!t) return {};
  switch (t.kind) {
    case "github":
      return { owner: t.owner, repo: t.repo, token: t.token };
    case "jira":
      return { site: t.site, email: t.email, token: t.token, projectKey: t.projectKey, issueType: t.issueType };
    case "linear":
      return { apiKey: t.apiKey, teamId: t.teamId };
    case "gitlab":
      return { baseUrl: t.baseUrl ?? "", projectId: t.projectId, token: t.token };
  }
}

const FIELDS: Record<TrackerKind, { key: string; label: string; hint?: string; password?: boolean }[]> = {
  github: [
    { key: "owner", label: "Owner", hint: "octocat" },
    { key: "repo", label: "Repository", hint: "hello-world" },
    { key: "token", label: "Token", hint: "Fine-grained PAT · Issues: Read and write", password: true },
  ],
  jira: [
    { key: "site", label: "Site", hint: "your-team (→ your-team.atlassian.net)" },
    { key: "email", label: "Email" },
    { key: "token", label: "API token", password: true },
    { key: "projectKey", label: "Project key", hint: "PROJ" },
    { key: "issueType", label: "Issue type", hint: "Task" },
  ],
  linear: [
    { key: "apiKey", label: "API key", hint: "Personal API key", password: true },
    { key: "teamId", label: "Team ID", hint: "UUID or key" },
  ],
  gitlab: [
    { key: "baseUrl", label: "Base URL", hint: "Leave blank for gitlab.com" },
    { key: "projectId", label: "Project ID", hint: "numeric id or group/project" },
    { key: "token", label: "Access token", hint: "Scope: api", password: true },
  ],
};

function ConnectForm({
  kind,
  initial,
  onSave,
  onCancel,
}: {
  kind: TrackerKind;
  initial?: TrackerConfig;
  onSave: (cfg: TrackerConfig) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<Record<string, string>>(() => toFields(initial));
  const meta = TRACKER_META[kind];
  const L = Trackers[meta.logo];
  const cfg = buildConfig(kind, f);

  return (
    <div style={{ marginTop: 24, padding: 22, background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 17 }}>
        <L size={26} />
        <div style={{ fontSize: 18, fontWeight: 650 }}>Connect {meta.name}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {FIELDS[kind].map((fd) => (
          <div key={fd.key} style={{ gridColumn: fd.key === "token" || fd.key === "apiKey" ? "1 / -1" : undefined }}>
            <Label>{fd.label}</Label>
            <input
              className="sp-input"
              type={fd.password ? "password" : "text"}
              value={f[fd.key] ?? ""}
              placeholder={fd.hint}
              onChange={(e) => setF((prev) => ({ ...prev, [fd.key]: e.target.value }))}
            />
            {fd.hint && <div style={{ fontSize: 13, color: "var(--sp-text-4)", marginTop: 5 }}>{fd.hint}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 19 }}>
        <button className="sp-btn sp-btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="sp-btn sp-btn-primary" disabled={!cfg} onClick={() => cfg && onSave(cfg)}>
          <Icons.Check size={16} /> Save &amp; connect
        </button>
      </div>
    </div>
  );
}

// ── Voice & AI ──────────────────────────────────────────────
// Each local tier bundles a Whisper (speech) + Qwen (drafting) size. We download
// only the half a given section actually uses, so the sizes are listed separately.
const LOCAL_TIERS: {
  id: LocalTier;
  name: string;
  whisper: string;
  qwen: string;
  speechSize: string;
  llmSize: string;
  memory: string;
  desc: string;
}[] = [
  { id: "light", name: "Fast", whisper: "Whisper tiny", qwen: "Qwen2.5 0.5B", speechSize: "~0.1 GB", llmSize: "~0.6 GB", memory: "~1 GB RAM", desc: "Runs on most laptops." },
  { id: "medium", name: "Accurate", whisper: "Whisper base", qwen: "Qwen2.5 1.5B", speechSize: "~0.2 GB", llmSize: "~1.4 GB", memory: "~2.5 GB RAM · WebGPU recommended", desc: "Sharper drafts & multilingual." },
];

// Remote presets per role. Voice needs an /audio/transcriptions-capable endpoint
// (in practice OpenAI's whisper-1); drafting speaks /chat/completions, which every
// OpenAI-compatible gateway (OpenRouter for Claude/Gemini, Ollama, …) supports.
type Preset = { id: string; name: string; url: string; model: string };
const VOICE_PRESETS: Preset[] = [
  { id: "openai", name: "OpenAI", url: "https://api.openai.com/v1", model: "whisper-1" },
  { id: "custom", name: "Custom", url: "", model: "" },
];
const DRAFT_PRESETS: Preset[] = [
  { id: "openai", name: "OpenAI", url: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { id: "openrouter", name: "OpenRouter", url: "https://openrouter.ai/api/v1", model: "anthropic/claude-3.5-haiku" },
  { id: "ollama", name: "Ollama (local)", url: "http://localhost:11434/v1", model: "llama3.1" },
  { id: "custom", name: "Custom", url: "", model: "" },
];

function VoiceSection({ focusTarget }: { focusTarget?: string | null }) {
  const { ai, setAi } = useSettings();
  const anyLocal = ai.voiceMode === "local" || ai.draftMode === "local";
  return (
    <div style={{ maxWidth: 864 }}>
      <SectionHeading title="Voice & AI" sub="Speqify uses two models — one turns your recording into text (Voice), the other writes the ticket (AI). Choose local or your own API for each, independently." />

      <VoiceModelCard ai={ai} setAi={setAi} />
      <DraftModelCard ai={ai} setAi={setAi} />

      {anyLocal && (
        <div style={{ marginTop: 17 }}>
          <GpuStatus />
        </div>
      )}

      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 34, marginBottom: 10 }}>Microphone</div>
      <MicAccess highlight={focusTarget === "mic"} />

      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 34, marginBottom: 10 }}>Behaviour</div>
      <div style={{ background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 12, padding: "5px 19px" }}>
        <Row title="Detected language" desc="Whisper auto-detects most languages. Lock it down if you record in one language consistently.">
          <select className="sp-input" style={{ width: 192, height: 38, padding: "0 12px" }} value={ai.detectedLang} onChange={(e) => setAi({ detectedLang: e.target.value })}>
            <option value="auto">Auto-detect</option>
            <option value="en">English</option>
            <option value="pl">Polish</option>
            <option value="de">German</option>
            <option value="es">Spanish</option>
          </select>
        </Row>
        <Row title="Translate transcript to" desc="The final issue body is rewritten in this language, regardless of what you spoke." border>
          <select className="sp-input" style={{ width: 192, height: 38, padding: "0 12px" }} value={ai.translateTo} onChange={(e) => setAi({ translateTo: e.target.value })}>
            <option value="off">Don't translate</option>
            <option value="en">English</option>
            <option value="pl">Polish</option>
            <option value="de">German</option>
          </select>
        </Row>
        <Row title="Auto-suggest labels & type" desc="Speqify infers labels and type from the note. Always editable before send." border>
          <Toggle on={ai.autoLabels} onChange={(autoLabels) => setAi({ autoLabels })} />
        </Row>
      </div>
    </div>
  );
}

// ── Voice & AI model cards ───────────────────────────────────
function ModelCard({ icon, title, flow, children }: { icon: ReactNode; title: string; flow: string; children: ReactNode }) {
  return (
    <div style={{ background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 12, overflow: "hidden", marginTop: 17 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 19px", borderBottom: "1px solid var(--sp-border)" }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--sp-indigo-50)", color: "var(--sp-indigo-600)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 650 }}>{title}</div>
          <div style={{ fontSize: 13, color: "var(--sp-text-3)" }}>{flow}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function ModeToggle({ mode, onMode, localLabel }: { mode: AiMode; onMode: (m: AiMode) => void; localLabel: string }) {
  const opts: { id: AiMode; title: string; icon: ReactNode }[] = [
    { id: "local", title: localLabel, icon: <Icons.Lock size={15} /> },
    { id: "remote", title: "Use an API", icon: <Icons.Globe size={15} /> },
  ];
  return (
    <div style={{ display: "flex", gap: 10, padding: 14 }}>
      {opts.map((o) => {
        const sel = mode === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onMode(o.id)}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 14px", cursor: "pointer", fontSize: 14, fontWeight: 600, background: sel ? "var(--sp-indigo-50)" : "var(--sp-surface-2)", border: "1px solid", borderColor: sel ? "var(--sp-indigo-200)" : "var(--sp-border)", borderRadius: 10, color: sel ? "var(--sp-indigo-700)" : "var(--sp-text-2)" }}
          >
            {o.icon}
            {o.title}
          </button>
        );
      })}
    </div>
  );
}

function RemoteForm({
  remote,
  onRemote,
  presets,
  modelLabel,
  modelHint,
  note,
}: {
  remote: RemoteEndpoint;
  onRemote: (p: Partial<RemoteEndpoint>) => void;
  presets: Preset[];
  modelLabel: string;
  modelHint: string;
  note?: ReactNode;
}) {
  return (
    <div style={{ padding: "0 19px 19px" }}>
      <Label>Provider</Label>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${presets.length}, 1fr)`, gap: 7, marginBottom: 17 }}>
        {presets.map((p) => {
          const sel = remote.preset === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onRemote({ preset: p.id, endpoint: p.url || remote.endpoint, model: p.model || remote.model })}
              style={{ padding: "12px 10px", cursor: "pointer", background: sel ? "var(--sp-indigo-50)" : "var(--sp-surface)", border: "1px solid", borderColor: sel ? "var(--sp-indigo-100)" : "var(--sp-border)", borderRadius: 10, fontSize: 14, fontWeight: 600, color: sel ? "var(--sp-indigo-700)" : "var(--sp-text)" }}
            >
              {p.name}
            </button>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <Label>Endpoint URL</Label>
          <input className="sp-input" value={remote.endpoint} placeholder="https://api.example.com/v1" style={{ fontFamily: "var(--sp-mono)", fontSize: 14 }} onChange={(e) => onRemote({ endpoint: e.target.value })} />
        </div>
        <div>
          <Label>{modelLabel}</Label>
          <input className="sp-input" value={remote.model} placeholder={modelHint} style={{ fontFamily: "var(--sp-mono)", fontSize: 14 }} onChange={(e) => onRemote({ model: e.target.value })} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Label>API key</Label>
          <input className="sp-input" value={remote.apiKey} type="password" placeholder="sk-…" style={{ fontFamily: "var(--sp-mono)", fontSize: 14 }} onChange={(e) => onRemote({ apiKey: e.target.value })} />
          <div style={{ fontSize: 13, color: "var(--sp-text-3)", marginTop: 5 }}>Stored locally in your browser. Never sent anywhere except this endpoint.</div>
        </div>
      </div>
      {note && <div style={{ fontSize: 13, color: "var(--sp-text-3)", marginTop: 12, lineHeight: 1.45 }}>{note}</div>}
    </div>
  );
}

function VoiceModelCard({ ai, setAi }: { ai: AiConfig; setAi: (p: Partial<AiConfig>) => void }) {
  const setRemote = (p: Partial<RemoteEndpoint>) => setAi({ voiceRemote: { ...ai.voiceRemote, ...p } });
  return (
    <ModelCard icon={<Icons.Wave size={17} />} title="Voice" flow="speech → text · transcribes your recording">
      <ModeToggle mode={ai.voiceMode} onMode={(voiceMode) => setAi({ voiceMode })} localLabel="Local Whisper" />
      {ai.voiceMode === "local" ? (
        <div style={{ padding: "0 19px 19px" }}>
          <div style={{ fontSize: 14, color: "var(--sp-text-3)", marginBottom: 14, lineHeight: 1.5 }}>
            Whisper transcribes your voice note entirely on-device. Nothing downloads until you click below.
          </div>
          <LocalQuality ai={ai} setAi={setAi} />
          <LocalStatus kind="speech" tier={ai.localTier} downloaded={ai.speechDownloaded} />
        </div>
      ) : (
        <RemoteForm
          remote={ai.voiceRemote}
          onRemote={setRemote}
          presets={VOICE_PRESETS}
          modelLabel="Transcription model · audio → text"
          modelHint="whisper-1"
          note={
            <>
              Calls <code>{"{endpoint}/audio/transcriptions"}</code>. In practice that's OpenAI's <code>whisper-1</code> —
              most other gateways (OpenRouter, Ollama) can't transcribe, so use a local Voice model or type the note on
              the Review screen instead.
            </>
          }
        />
      )}
    </ModelCard>
  );
}

function DraftModelCard({ ai, setAi }: { ai: AiConfig; setAi: (p: Partial<AiConfig>) => void }) {
  const setRemote = (p: Partial<RemoteEndpoint>) => setAi({ draftRemote: { ...ai.draftRemote, ...p } });
  const [nano, setNano] = useState<NanoStatus | null>(null);
  useEffect(() => {
    void probeNano().then(setNano);
  }, []);
  return (
    <ModelCard icon={<Icons.Sparkles size={17} />} title="AI" flow="text → ticket · writes the title, description & labels">
      <ModeToggle mode={ai.draftMode} onMode={(draftMode) => setAi({ draftMode })} localLabel="Local model" />
      {ai.draftMode === "local" ? (
        <div style={{ padding: "0 19px 19px" }}>
          {nano === "available" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 17px", background: "var(--sp-indigo-50)", border: "1px solid var(--sp-indigo-100)", borderRadius: 12 }}>
              <div style={{ width: 41, height: 41, borderRadius: 10, background: "#fff", color: "var(--sp-indigo-600)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icons.Check size={19} stroke={2.4} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--sp-indigo-700)" }}>Chrome Gemini Nano — ready</div>
                <div style={{ fontSize: 13, color: "var(--sp-text-2)", marginTop: 2, lineHeight: 1.45 }}>
                  Drafting runs on Chrome's on-device model (fast, off-thread). Nothing to download. Switch to “Use an
                  API” above for a larger hosted model.
                </div>
              </div>
            </div>
          ) : (
            <>
              <NanoBanner />
              <div style={{ fontSize: 14, color: "var(--sp-text-3)", marginBottom: 14, lineHeight: 1.5 }}>
                Qwen writes the ticket on-device. Nothing downloads until you click below.
              </div>
              {/* Tier is shared; when Voice is also local its card already shows the picker. */}
              {ai.voiceMode !== "local" && <LocalQuality ai={ai} setAi={setAi} />}
              <LocalStatus kind="llm" tier={ai.localTier} downloaded={ai.llmDownloaded} />
            </>
          )}
        </div>
      ) : (
        <RemoteForm
          remote={ai.draftRemote}
          onRemote={setRemote}
          presets={DRAFT_PRESETS}
          modelLabel="Drafting model · text → ticket"
          modelHint="provider/model-name"
          note={
            <>
              Calls <code>{"{endpoint}/chat/completions"}</code>. Works with OpenAI, OpenRouter (Claude, Gemini, …),
              Ollama, or any OpenAI-compatible gateway.
            </>
          }
        />
      )}
    </ModelCard>
  );
}

function LocalQuality({ ai, setAi }: { ai: AiConfig; setAi: (p: Partial<AiConfig>) => void }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <Label>Model size · shared by both local models</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {LOCAL_TIERS.map((t) => {
          const sel = ai.localTier === t.id;
          return (
            <button
              key={t.id}
              // Changing size invalidates any already-downloaded models for the old tier.
              onClick={() => setAi({ localTier: t.id, speechDownloaded: false, llmDownloaded: false })}
              style={{ textAlign: "left", cursor: "pointer", padding: 14, borderRadius: 10, background: sel ? "var(--sp-indigo-50)" : "var(--sp-surface)", border: "1px solid", borderColor: sel ? "var(--sp-indigo-300)" : "var(--sp-border)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 15, fontWeight: 650 }}>{t.name}</span>
                {sel && <span className="sp-chip sp-chip-indigo" style={{ height: 20, fontSize: 11 }}>Selected</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--sp-text-3)", marginTop: 4, lineHeight: 1.4 }}>
                {t.desc} · {t.whisper} / {t.qwen}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MicAccess({ highlight }: { highlight?: boolean }) {
  const [state, setState] = useState<string>("unknown");
  const [err, setErr] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const perms = (navigator as Navigator & {
      permissions?: { query?: (d: { name: PermissionName }) => Promise<PermissionStatus> };
    }).permissions;
    perms
      ?.query?.({ name: "microphone" as PermissionName })
      .then((p) => {
        setState(p.state);
        p.onchange = () => setState(p.state);
      })
      .catch(() => setState("unknown"));
  }, []);

  // Deep-linked from onboarding (#voice:mic): scroll the card into view and pulse a
  // ring around the Allow button so the user sees exactly what to click. The button
  // also stays tinted (primary colour) the whole time the deep-link is active.
  useEffect(() => {
    if (!highlight) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setPulse(true);
    const id = setTimeout(() => setPulse(false), 8600);
    return () => clearTimeout(id);
  }, [highlight]);

  const allow = async () => {
    setErr(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      setState("granted");
    } catch (e) {
      setState("denied");
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const granted = state === "granted";
  const blocked = state === "denied";
  return (
    <div ref={cardRef} style={{ background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 12, padding: "14px 19px", scrollMarginTop: 80 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 41, height: 41, borderRadius: 10, background: granted ? "var(--sp-success-bg)" : "var(--sp-surface-2)", color: granted ? "var(--sp-success)" : "var(--sp-text-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icons.Mic size={19} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Microphone access</div>
          <div style={{ fontSize: 14, color: "var(--sp-text-3)", marginTop: 2, lineHeight: 1.45 }}>
            {granted
              ? "Allowed — your voice note will be transcribed."
              : "Needed to record a voice note. Chrome won't prompt from the side panel, so grant it here once."}
          </div>
        </div>
        {granted ? (
          <span className="sp-chip sp-chip-success" style={{ flexShrink: 0 }}>
            <Icons.Check size={12} stroke={2.4} /> Allowed
          </span>
        ) : (
          <button
            className={`sp-btn sp-btn-sm ${highlight ? "sp-btn-primary" : "sp-btn-secondary"}${pulse ? " sp-attn" : ""}`}
            onClick={allow}
            style={{ flexShrink: 0 }}
          >
            <Icons.Mic size={14} /> Allow microphone
          </button>
        )}
      </div>
      {blocked && (
        <div style={{ fontSize: 13, color: "var(--sp-danger)", marginTop: 10, lineHeight: 1.45 }}>
          Blocked. Click the camera/lock icon in the address bar of this Settings tab → allow Microphone, then retry.
          {err ? ` (${err})` : ""}
        </div>
      )}
    </div>
  );
}

function browserKind(): "chrome" | "edge" | "firefox" | "safari" | "other" {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

const GPU_TIPS: Record<ReturnType<typeof browserKind>, ReactNode> = {
  chrome: (
    <>
      Open <code>chrome://flags/#enable-unsafe-webgpu</code> → Enabled (on Linux also{" "}
      <code>#enable-vulkan</code>), then restart Chrome. Verify at <code>chrome://gpu</code> — it should say
      “WebGPU: Hardware accelerated”. Needs Chrome 113+.
    </>
  ),
  edge: (
    <>
      Open <code>edge://flags/#enable-unsafe-webgpu</code> → Enabled, then restart Edge. Verify at{" "}
      <code>edge://gpu</code>.
    </>
  ),
  firefox: (
    <>
      WebGPU ships in Firefox 141+ on Windows. Elsewhere set <code>dom.webgpu.enabled = true</code> in{" "}
      <code>about:config</code> (Nightly recommended).
    </>
  ),
  safari: <>Safari 18+ / Technology Preview: Settings → Advanced → Feature Flags → enable WebGPU.</>,
  other: <>Use a Chromium-based browser (Chrome/Edge 113+) for WebGPU, or pick a remote endpoint above.</>,
};

function GpuStatus() {
  const [state, setState] = useState<"checking" | "ok" | "off">("checking");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
      if (!gpu) {
        if (!cancelled) setState("off");
        return;
      }
      try {
        const adapter = await gpu.requestAdapter();
        if (!cancelled) setState(adapter ? "ok" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "checking") return null;
  if (state === "ok") {
    return (
      <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "var(--sp-success-bg)", border: "1px solid #BBF7D0", color: "var(--sp-success)", fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
        <Icons.Check size={14} stroke={2.4} /> <span><b>GPU acceleration active</b> (WebGPU) — local models run fast.</span>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "var(--sp-warn-bg)", border: "1px solid #FDE68A", color: "var(--sp-warn)", fontSize: 14, lineHeight: 1.5 }}>
      <b>No GPU acceleration (WebGPU off)</b> — local models run on the CPU and can be slow/laggy. Fastest fix: use a
      remote endpoint above. To enable WebGPU: {GPU_TIPS[browserKind()]}
    </div>
  );
}

function NanoBanner() {
  const [status, setStatus] = useState<NanoStatus | null>(null);
  useEffect(() => {
    void probeNano().then(setStatus);
  }, []);
  if (status === "available") {
    return (
      <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "var(--sp-indigo-50)", border: "1px solid var(--sp-indigo-100)", color: "var(--sp-indigo-700)", fontSize: 14, lineHeight: 1.5 }}>
        <b>Chrome Gemini Nano detected</b> — drafting uses Chrome's on-device model (fast, no lag, off-thread), so the
        download below only needs the small <b>speech</b> model.
      </div>
    );
  }
  if (status === "downloadable" || status === "downloading") {
    return (
      <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "var(--sp-indigo-50)", border: "1px solid var(--sp-indigo-100)", color: "var(--sp-indigo-700)", fontSize: 14, lineHeight: 1.5 }}>
        <b>Chrome Gemini Nano can be enabled</b> on this device — Chrome fetches it on first use, then drafting won't
        need our LLM download.
      </div>
    );
  }
  return null;
}

function LocalStatus({ kind, tier, downloaded }: { kind: DownloadKind; tier: LocalTier; downloaded: boolean }) {
  const setAi = useSettings((s) => s.setAi);
  // Download state lives in a standalone store so it survives switching sections.
  const { active, kind: dlKind, progress, error, start, clearError } = useLocalDownload();
  const downloading = active && dlKind === kind;
  const t = LOCAL_TIERS.find((x) => x.id === tier) ?? LOCAL_TIERS[0];
  const modelName = kind === "speech" ? t.whisper : t.qwen;
  const size = kind === "speech" ? t.speechSize : t.llmSize;
  const noun = kind === "speech" ? "speech → text" : "drafting";

  // Warn before the tab is closed mid-download (closing would abort it).
  useEffect(() => {
    if (!downloading) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [downloading]);

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 17px", background: "var(--sp-surface-2)", border: "1px solid var(--sp-border)", borderRadius: 12 }}>
        <div style={{ width: 41, height: 41, borderRadius: 10, background: downloaded ? "var(--sp-success-bg)" : "var(--sp-surface-3)", color: downloaded ? "var(--sp-success)" : "var(--sp-text-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {downloaded ? <Icons.Check size={19} stroke={2.4} /> : <Icons.Layers size={19} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {downloading ? `Downloading ${modelName}… ${progress}%` : downloaded ? `${modelName} installed` : `${modelName} not downloaded`}
          </div>
          <div style={{ fontSize: 13, color: "var(--sp-text-3)", marginTop: 2 }}>
            {downloaded ? `${size} on-device · ${noun} model` : `${size} download · ${t.memory}`}
          </div>
        </div>
        {downloaded ? (
          <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={() => setAi(kind === "speech" ? { speechDownloaded: false } : { llmDownloaded: false })}>Remove</button>
        ) : (
          <button
            className="sp-btn sp-btn-secondary sp-btn-sm"
            disabled={active}
            onClick={() => {
              clearError();
              void start(kind, tier);
            }}
          >
            <Icons.Arrow size={13} style={{ transform: "rotate(90deg)" }} /> {downloading ? "Downloading…" : `Download ${modelName}`}
          </button>
        )}
      </div>
      {downloading && (
        <>
          <div style={{ height: 5, background: "var(--sp-surface-3)", borderRadius: 1199, marginTop: 10, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "var(--sp-indigo-600)", transition: "width .2s" }} />
          </div>
          <div style={{ fontSize: 13, color: "var(--sp-text-3)", marginTop: 7 }}>
            Downloading in the background — you can switch sections, but keep this tab open until it finishes.
          </div>
        </>
      )}
      {error && <div style={{ fontSize: 13, color: "var(--sp-danger)", marginTop: 10 }}>{error}</div>}
    </div>
  );
}

function Row({ title, desc, children, border }: { title: string; desc?: string; children: ReactNode; border?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 19, padding: "19px 0", borderTop: border ? "1px solid var(--sp-border)" : undefined }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
        {desc && <div style={{ fontSize: 14, color: "var(--sp-text-3)", marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

const TEMPLATE_TYPES: { type: TicketType; name: string }[] = [
  { type: "bug", name: "Bug report" },
  { type: "feature", name: "Feature / user story" },
  { type: "task", name: "Task" },
  { type: "improvement", name: "Improvement" },
];

function TemplatesSection() {
  const { templates, setTemplate, resetTemplates } = useSettings();
  return (
    <div style={{ maxWidth: 864 }}>
      <SectionHeading title="Ticket templates" sub="The Markdown structure Speqify asks the model to fill for each issue type. Keep the headings; the model writes each section from your voice note and the page context." />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={resetTemplates}>
          <Icons.Trash size={14} /> Reset to defaults
        </button>
      </div>
      <div style={{ marginTop: 5, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {TEMPLATE_TYPES.map((t) => (
          <div key={t.type} style={{ background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 12, padding: 17 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{t.name}</span>
              <span className="sp-chip">{t.type}</span>
            </div>
            <textarea
              className="sp-textarea"
              rows={5}
              value={templates[t.type]}
              onChange={(e) => setTemplate(t.type, e.target.value)}
              placeholder="Leave blank to let the model structure it freely"
              style={{ fontFamily: "var(--sp-mono)", fontSize: 14, lineHeight: 1.6 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SimpleSection({ id }: { id: Section }) {
  const copy: Record<string, { title: string; sub: string; body: ReactNode }> = {
    shortcuts: {
      title: "Keyboard shortcuts",
      sub: "Shown for your operating system. Open capture is rebindable at chrome://extensions/shortcuts.",
      body: (
        <div style={{ marginTop: 24, background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 12, padding: "5px 19px" }}>
          {Object.values(SHORTCUTS).map((s, i) => (
            <Row key={s.label} title={s.label} border={i > 0}>
              <span style={{ display: "inline-flex", gap: 5 }}>
                {s.keys.map((k, j) => (
                  <span key={j} className="sp-kbd">{k}</span>
                ))}
              </span>
            </Row>
          ))}
        </div>
      ),
    },
    privacy: {
      title: "Privacy & data",
      sub: "Speqify is local-first by design.",
      body: (
        <ul style={{ marginTop: 19, color: "var(--sp-text-2)", fontSize: 16, lineHeight: 1.7, paddingLeft: 22 }}>
          <li>No Speqify account and no Speqify server — there is nothing to sign in to.</li>
          <li>Tracker tokens and AI keys are stored only in your browser's local storage.</li>
          <li>With local models, audio is transcribed on-device and never uploaded.</li>
          <li>Nothing leaves your browser except the issue you explicitly create.</li>
        </ul>
      ),
    },
    about: {
      title: "About Speqify",
      sub: "Talk to your tracker — Speqify writes the ticket.",
      body: (
        <div style={{ marginTop: 19, color: "var(--sp-text-2)", fontSize: 16, lineHeight: 1.7 }}>
          A cross-browser sidebar that turns a voice note + page context into a structured issue in Jira, GitHub,
          Linear, or GitLab. Version 0.0.0.
        </div>
      ),
    },
  };
  const c = copy[id];
  if (!c) return null;
  return (
    <div style={{ maxWidth: 864 }}>
      <SectionHeading title={c.title} sub={c.sub} />
      {c.body}
    </div>
  );
}
