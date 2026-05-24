import { useState, type ReactNode } from "react";
import { browser } from "#imports";
import { Icons, SpeqifyWordmark, Trackers, type TrackerLogoName } from "@speqify/ui";
import type { TrackerConfig, TrackerKind } from "@speqify/core";
import { useSettings, type AiConfig, type LocalTier, type RemoteAi } from "@/store";
import { loadLocal, type LoadProgress } from "@/ai";
import { SHORTCUTS } from "@/lib/shortcuts";
import { Toggle } from "@/panel/controls";

type Section = "integrations" | "voice" | "templates" | "shortcuts" | "privacy" | "about";

const SECTIONS: { id: Section; label: string; icon: ReactNode }[] = [
  { id: "integrations", label: "Integrations", icon: <Icons.Layers size={14} /> },
  { id: "voice", label: "Voice & AI", icon: <Icons.Sparkles size={14} /> },
  { id: "templates", label: "Templates", icon: <Icons.Edit size={14} /> },
  { id: "shortcuts", label: "Shortcuts", icon: <Icons.Bolt size={14} /> },
  { id: "privacy", label: "Privacy & data", icon: <Icons.Lock size={14} /> },
  { id: "about", label: "About", icon: <Icons.Sparkles size={14} /> },
];

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
  const [section, setSection] = useState<Section>("integrations");
  const hydrated = useSettings((s) => s.hydrated);

  return (
    <div className="sp" style={{ width: "100%", minHeight: "100vh", background: "var(--sp-bg)", display: "flex", color: "var(--sp-text)" }}>
      {/* sidenav */}
      <div style={{ width: 220, background: "var(--sp-surface)", borderRight: "1px solid var(--sp-border)", padding: "20px 12px", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "0 8px 16px" }}>
          <SpeqifyWordmark height={20} />
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 10px 4px" }}>Settings</div>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 6,
              border: "none",
              background: section === s.id ? "var(--sp-indigo-50)" : "transparent",
              color: section === s.id ? "var(--sp-indigo-700)" : "var(--sp-text-2)",
              fontSize: 13,
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
        <div style={{ padding: 12, background: "var(--sp-surface-2)", borderRadius: 10, border: "1px solid var(--sp-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600 }}>
            <Icons.Lock size={11} style={{ color: "var(--sp-success)" }} /> Local-first
          </div>
          <div style={{ fontSize: 10.5, color: "var(--sp-text-3)", marginTop: 4, lineHeight: 1.4 }}>
            No Speqify account. Your tracker API keys stay in your browser.
          </div>
        </div>
      </div>

      {/* content */}
      <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 24px", background: "var(--sp-bg)", borderBottom: "1px solid var(--sp-border)" }}>
          <button onClick={closeSettingsTab} className="sp-btn sp-btn-secondary sp-btn-sm">
            <Icons.X size={12} /> Close settings
          </button>
        </div>
        <div style={{ padding: "28px 40px 48px" }}>
          {!hydrated ? (
            <div style={{ color: "var(--sp-text-3)", fontSize: 13 }}>Loading…</div>
          ) : section === "integrations" ? (
            <IntegrationsSection />
          ) : section === "voice" ? (
            <VoiceSection />
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
      <div style={{ fontSize: 22, fontWeight: 650, letterSpacing: "-0.01em" }}>{title}</div>
      <div style={{ fontSize: 13.5, color: "var(--sp-text-3)", marginTop: 4 }}>{sub}</div>
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
    <div style={{ maxWidth: 720 }}>
      <SectionHeading title="Integration" sub="One active tracker at a time. Every new ticket goes here." />

      {tracker && (
        <div style={{ marginTop: 24 }}>
          <Label>Active tracker</Label>
          {(() => {
            const meta = TRACKER_META[tracker.kind];
            const L = Trackers[meta.logo];
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background: "var(--sp-surface)", border: "1px solid var(--sp-indigo-100)", borderRadius: 10, boxShadow: "0 0 0 2px var(--sp-indigo-50)" }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--sp-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <L size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 650 }}>{meta.name}</span>
                    <span className="sp-chip sp-chip-success">
                      <Icons.Check size={10} stroke={2.4} /> Connected
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--sp-text-3)", marginTop: 2 }}>{subOf(tracker)}</div>
                </div>
                <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => setConnecting(tracker.kind)}>Configure</button>
                <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={() => setTracker(null)}>Disconnect</button>
              </div>
            );
          })()}
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <Label>{tracker ? "Switch to another tracker" : "Connect a tracker"}</Label>
        <div style={{ fontSize: 12, color: "var(--sp-text-3)", marginBottom: 10, lineHeight: 1.4 }}>
          {tracker
            ? "Connecting another tracker replaces the current active destination. Switch any time."
            : "Pick where Speqify should create your issues. Credentials stay in your browser."}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {others.map((k) => {
            const meta = TRACKER_META[k];
            const L = Trackers[meta.logo];
            return (
              <button
                key={k}
                onClick={() => setConnecting(k)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left", background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 10 }}
              >
                <L size={20} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{meta.name}</div>
                  <div style={{ fontSize: 11, color: "var(--sp-text-3)" }}>Connect…</div>
                </div>
                <Icons.Plus size={12} style={{ color: "var(--sp-text-3)" }} />
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
    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--sp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
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
    <div style={{ marginTop: 20, padding: 18, background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <L size={22} />
        <div style={{ fontSize: 15, fontWeight: 650 }}>Connect {meta.name}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
            {fd.hint && <div style={{ fontSize: 11, color: "var(--sp-text-4)", marginTop: 4 }}>{fd.hint}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button className="sp-btn sp-btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="sp-btn sp-btn-primary" disabled={!cfg} onClick={() => cfg && onSave(cfg)}>
          <Icons.Check size={13} /> Save &amp; connect
        </button>
      </div>
    </div>
  );
}

// ── Voice & AI ──────────────────────────────────────────────
const LOCAL_TIERS: {
  id: LocalTier;
  name: string;
  stt: string;
  llm: string;
  download: string;
  memory: string;
  desc: string;
}[] = [
  {
    id: "light",
    name: "Light",
    stt: "Whisper tiny",
    llm: "Qwen2.5 0.5B",
    download: "~0.7 GB",
    memory: "~1 GB RAM",
    desc: "Fast, runs on most laptops. Great for short notes.",
  },
  {
    id: "medium",
    name: "Medium",
    stt: "Whisper base",
    llm: "Qwen2.5 1.5B",
    download: "~1.6 GB",
    memory: "~2.5 GB RAM · WebGPU recommended",
    desc: "Sharper drafts and better multilingual transcription.",
  },
];

const REMOTE_PRESETS: { id: string; name: string; url: string; model: string; stt: string }[] = [
  { id: "openrouter", name: "OpenRouter", url: "https://openrouter.ai/api/v1", model: "anthropic/claude-3.5-haiku", stt: "" },
  { id: "openai", name: "OpenAI", url: "https://api.openai.com/v1", model: "gpt-4o-mini", stt: "whisper-1" },
  { id: "anthropic", name: "Anthropic", url: "https://api.anthropic.com/v1", model: "claude-3-5-haiku-latest", stt: "" },
  { id: "custom", name: "Custom", url: "", model: "", stt: "" },
];

function VoiceSection() {
  const { ai, setAi } = useSettings();
  return (
    <div style={{ maxWidth: 720 }}>
      <SectionHeading title="Voice & AI" sub="Run models locally inside the extension, or point Speqify at a cloud endpoint you control." />
      <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>Models</div>
      <ModelProvider ai={ai} setAi={setAi} />

      <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>Behaviour</div>
      <div style={{ background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 10, padding: "4px 16px" }}>
        <Row title="Detected language" desc="Whisper auto-detects most languages. Lock it down if you record in one language consistently.">
          <select className="sp-input" style={{ width: 160, height: 32, padding: "0 10px" }} value={ai.detectedLang} onChange={(e) => setAi({ detectedLang: e.target.value })}>
            <option value="auto">Auto-detect</option>
            <option value="en">English</option>
            <option value="pl">Polish</option>
            <option value="de">German</option>
            <option value="es">Spanish</option>
          </select>
        </Row>
        <Row title="Translate transcript to" desc="The final issue body is rewritten in this language, regardless of what you spoke." border>
          <select className="sp-input" style={{ width: 160, height: 32, padding: "0 10px" }} value={ai.translateTo} onChange={(e) => setAi({ translateTo: e.target.value })}>
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

function ModelProvider({ ai, setAi }: { ai: AiConfig; setAi: (p: Partial<AiConfig>) => void }) {
  const setRemote = (p: Partial<RemoteAi>) => setAi({ remote: { ...ai.remote, ...p } });
  return (
    <div style={{ background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", padding: 12, gap: 8, borderBottom: "1px solid var(--sp-border)" }}>
        {[
          { id: "local" as const, title: "Run locally", sub: "Models bundled into the extension. No data leaves your browser.", icon: <Icons.Lock size={13} /> },
          { id: "remote" as const, title: "Use an API endpoint", sub: "OpenRouter, OpenAI, Anthropic — or your own gateway.", icon: <Icons.Globe size={13} /> },
        ].map((opt) => {
          const sel = ai.mode === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setAi({ mode: opt.id })}
              style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", textAlign: "left", cursor: "pointer", background: sel ? "var(--sp-indigo-50)" : "var(--sp-surface-2)", border: "1px solid", borderColor: sel ? "var(--sp-indigo-100)" : "var(--sp-border)", borderRadius: 8 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: sel ? "var(--sp-indigo-700)" : "var(--sp-text)" }}>
                {opt.icon}
                {opt.title}
              </div>
              <div style={{ fontSize: 11, color: "var(--sp-text-3)", lineHeight: 1.4 }}>{opt.sub}</div>
            </button>
          );
        })}
      </div>

      {ai.mode === "local" ? (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: "var(--sp-text-3)", marginBottom: 12, lineHeight: 1.5 }}>
            Nothing is downloaded by default. Pick a tier and download it — then transcription and drafting run
            entirely on your device.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {LOCAL_TIERS.map((t) => {
              const sel = ai.localTier === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setAi({ localTier: t.id, localDownloaded: false })}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    padding: 16,
                    borderRadius: 10,
                    background: sel ? "var(--sp-indigo-50)" : "var(--sp-surface)",
                    border: "1px solid",
                    borderColor: sel ? "var(--sp-indigo-300)" : "var(--sp-border)",
                    boxShadow: sel ? "0 0 0 3px var(--sp-indigo-100)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 650 }}>{t.name}</span>
                    {sel && (
                      <span className="sp-chip sp-chip-indigo" style={{ height: 18, fontSize: 10 }}>
                        Selected
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--sp-text-3)", marginTop: 4, lineHeight: 1.45 }}>{t.desc}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    <span className="sp-chip" style={{ height: 20, fontSize: 10.5 }}>
                      <Icons.Wave size={10} /> {t.stt}
                    </span>
                    <span className="sp-chip" style={{ height: 20, fontSize: 10.5 }}>
                      <Icons.Sparkles size={10} /> {t.llm}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11.5, color: "var(--sp-text-2)" }}>
                    <span>
                      <span style={{ color: "var(--sp-text-3)" }}>Download</span> <b style={{ fontWeight: 600 }}>{t.download}</b>
                    </span>
                    <span>
                      <span style={{ color: "var(--sp-text-3)" }}>Memory</span> <b style={{ fontWeight: 600 }}>{t.memory}</b>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <LocalStatus ai={ai} setAi={setAi} />
        </div>
      ) : (
        <div style={{ padding: 16 }}>
          <Label>Provider</Label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 16 }}>
            {REMOTE_PRESETS.map((p) => {
              const sel = ai.remote.preset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setRemote({ preset: p.id, endpoint: p.url || ai.remote.endpoint, model: p.model || ai.remote.model, sttModel: p.stt })}
                  style={{ padding: "10px 8px", cursor: "pointer", background: sel ? "var(--sp-indigo-50)" : "var(--sp-surface)", border: "1px solid", borderColor: sel ? "var(--sp-indigo-100)" : "var(--sp-border)", borderRadius: 8, fontSize: 12, fontWeight: 600, color: sel ? "var(--sp-indigo-700)" : "var(--sp-text)" }}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <Label>Endpoint URL</Label>
              <input className="sp-input" value={ai.remote.endpoint} placeholder="https://api.example.com/v1" style={{ fontFamily: "var(--sp-mono)", fontSize: 12 }} onChange={(e) => setRemote({ endpoint: e.target.value })} />
            </div>
            <div>
              <Label>Drafting model · text → ticket</Label>
              <input className="sp-input" value={ai.remote.model} placeholder="provider/model-name" style={{ fontFamily: "var(--sp-mono)", fontSize: 12 }} onChange={(e) => setRemote({ model: e.target.value })} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Label>Transcription model · audio → text</Label>
              <input className="sp-input" value={ai.remote.sttModel} placeholder="whisper-1 (leave blank if unsupported)" style={{ fontFamily: "var(--sp-mono)", fontSize: 12 }} onChange={(e) => setRemote({ sttModel: e.target.value })} />
              <div style={{ fontSize: 11, color: "var(--sp-text-3)", marginTop: 4, lineHeight: 1.45 }}>
                Calls <code>{"{endpoint}/audio/transcriptions"}</code>. Works with OpenAI (<code>whisper-1</code>). OpenRouter
                &amp; Anthropic don't transcribe audio — leave blank and either pick a Light local model for speech, or
                just type the note on the Review screen.
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Label>API key</Label>
              <input className="sp-input" value={ai.remote.apiKey} type="password" placeholder="sk-…" style={{ fontFamily: "var(--sp-mono)", fontSize: 12 }} onChange={(e) => setRemote({ apiKey: e.target.value })} />
              <div style={{ fontSize: 11, color: "var(--sp-text-3)", marginTop: 4 }}>Stored locally in your browser. Never sent anywhere except your chosen endpoint.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LocalStatus({ ai, setAi }: { ai: AiConfig; setAi: (p: Partial<AiConfig>) => void }) {
  const t = LOCAL_TIERS.find((x) => x.id === ai.localTier) ?? LOCAL_TIERS[0];
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const download = async () => {
    setErr(null);
    setDownloading(true);
    setProgress(0);
    try {
      await loadLocal(ai.localTier, (p: LoadProgress) => {
        if (typeof p.progress === "number") setProgress(Math.min(100, Math.round(p.progress)));
      });
      setAi({ localDownloaded: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--sp-surface-2)", border: "1px solid var(--sp-border)", borderRadius: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: ai.localDownloaded ? "var(--sp-success-bg)" : "var(--sp-surface-3)", color: ai.localDownloaded ? "var(--sp-success)" : "var(--sp-text-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {ai.localDownloaded ? <Icons.Check size={16} stroke={2.4} /> : <Icons.Layers size={16} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>
            {downloading ? `Downloading ${t.name} models… ${progress}%` : ai.localDownloaded ? `${t.name} models installed` : `${t.name} models not downloaded`}
          </div>
          <div style={{ fontSize: 11, color: "var(--sp-text-3)", marginTop: 2 }}>
            {ai.localDownloaded ? `${t.download} on-device · ${t.stt} + ${t.llm}` : `${t.download} download · ${t.memory}`}
          </div>
        </div>
        {ai.localDownloaded ? (
          <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={() => setAi({ localDownloaded: false })}>Remove</button>
        ) : (
          <button className="sp-btn sp-btn-secondary sp-btn-sm" disabled={downloading} onClick={download}>
            <Icons.Arrow size={11} style={{ transform: "rotate(90deg)" }} /> {downloading ? "Downloading…" : `Download ${t.name}`}
          </button>
        )}
      </div>
      {downloading && (
        <div style={{ height: 4, background: "var(--sp-surface-3)", borderRadius: 999, marginTop: 8, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "var(--sp-indigo-600)", transition: "width .2s" }} />
        </div>
      )}
      {err && <div style={{ fontSize: 11, color: "var(--sp-danger)", marginTop: 8 }}>{err}</div>}
    </div>
  );
}

function Row({ title, desc, children, border }: { title: string; desc?: string; children: ReactNode; border?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0", borderTop: border ? "1px solid var(--sp-border)" : undefined }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</div>
        {desc && <div style={{ fontSize: 12, color: "var(--sp-text-3)", marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function TemplatesSection() {
  const templates = [
    { name: "Bug report", type: "Bug", body: "Steps to reproduce\nExpected\nActual\nEnvironment" },
    { name: "User story", type: "Feature", body: "As a {role}\nI want {action}\nSo that {benefit}\nAcceptance criteria" },
    { name: "Task", type: "Task", body: "Outcome\nContext\nNotes" },
    { name: "Design feedback", type: "Task", body: "Element\nObservation\nProposed change" },
  ];
  return (
    <div style={{ maxWidth: 720 }}>
      <SectionHeading title="Ticket templates" sub="Pick the structure Speqify outputs for each issue type. Variables are replaced from your voice note." />
      <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {templates.map((tpl) => (
          <div key={tpl.name} style={{ background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{tpl.name}</span>
              <span className="sp-chip">{tpl.type}</span>
            </div>
            <div style={{ marginTop: 10, padding: 10, background: "var(--sp-surface-2)", borderRadius: 6, fontFamily: "var(--sp-mono)", fontSize: 11, color: "var(--sp-text-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{tpl.body}</div>
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
        <div style={{ marginTop: 20, background: "var(--sp-surface)", border: "1px solid var(--sp-border)", borderRadius: 10, padding: "4px 16px" }}>
          {Object.values(SHORTCUTS).map((s, i) => (
            <Row key={s.label} title={s.label} border={i > 0}>
              <span style={{ display: "inline-flex", gap: 4 }}>
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
        <ul style={{ marginTop: 16, color: "var(--sp-text-2)", fontSize: 13.5, lineHeight: 1.7, paddingLeft: 18 }}>
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
        <div style={{ marginTop: 16, color: "var(--sp-text-2)", fontSize: 13.5, lineHeight: 1.7 }}>
          A cross-browser sidebar that turns a voice note + page context into a structured issue in Jira, GitHub,
          Linear, or GitLab. Version 0.0.0.
        </div>
      ),
    },
  };
  const c = copy[id];
  if (!c) return null;
  return (
    <div style={{ maxWidth: 720 }}>
      <SectionHeading title={c.title} sub={c.sub} />
      {c.body}
    </div>
  );
}
