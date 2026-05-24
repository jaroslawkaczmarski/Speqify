import { useState, type ReactNode } from "react";
import { Icons, SpeqifyLogo, SpeqifyWordmark, Trackers } from "@speqify/ui";
import { trackerDisplay, useSettings } from "@/store";

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === step ? 24 : 6,
            height: 6,
            borderRadius: 999,
            background: i === step ? "var(--sp-indigo-600)" : i < step ? "var(--sp-indigo-300)" : "var(--sp-border-2)",
            transition: "all .2s",
          }}
        />
      ))}
    </div>
  );
}

const FEATURES: { icon: ReactNode; label: string }[] = [
  { icon: <Icons.Mic size={14} />, label: "Voice notes" },
  { icon: <Icons.Image size={14} />, label: "Element capture" },
  { icon: <Icons.Sparkles size={14} />, label: "Auto-structure" },
  { icon: <Icons.Send size={14} />, label: "4 trackers" },
];

export function Onboarding({ onFinish, onOpenSettings }: { onFinish: () => void; onOpenSettings: () => void }) {
  const [step, setStep] = useState(0);
  const [micAllowed, setMicAllowed] = useState(false);
  const tracker = useSettings((s) => s.tracker);
  const dest = trackerDisplay(tracker);
  const total = 4;

  const allowMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicAllowed(true);
    } catch {
      setMicAllowed(false);
    }
  };

  return (
    <div className="sp" style={{ width: "100%", height: "100%", background: "var(--sp-bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 14px", borderBottom: "1px solid var(--sp-border)", background: "var(--sp-surface)" }}>
        <SpeqifyWordmark height={18} />
        <div style={{ flex: 1 }} />
        <button onClick={onFinish} className="sp-btn sp-btn-ghost sp-btn-sm">Skip</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {step === 0 && (
          <div style={{ padding: 32, textAlign: "center", display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
              <SpeqifyLogo size={56} />
              <div>
                <div style={{ fontSize: 24, fontWeight: 650, letterSpacing: "-0.015em" }}>Welcome to Speqify</div>
                <div style={{ fontSize: 14, color: "var(--sp-text-3)", marginTop: 6, maxWidth: 340 }}>
                  Turn voice + screenshots into well-structured tickets in any tracker your team uses.
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", maxWidth: 380, marginTop: 8 }}>
                {FEATURES.map((f) => (
                  <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--sp-surface-2)", border: "1px solid var(--sp-border)", borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>
                    <span style={{ color: "var(--sp-indigo-600)" }}>{f.icon}</span>
                    {f.label}
                  </div>
                ))}
              </div>
            </div>
            <ProgressDots step={step} total={total} />
            <button onClick={() => setStep(1)} className="sp-btn sp-btn-primary sp-btn-lg" style={{ marginTop: 14, width: "100%", justifyContent: "center" }}>
              Get started <Icons.Arrow size={14} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div style={{ padding: 28, display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--sp-indigo-700)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Step 1 of 3</div>
              <div style={{ fontSize: 20, fontWeight: 650, letterSpacing: "-0.01em", marginTop: 4 }}>Connect your tracker</div>
              <div style={{ fontSize: 13, color: "var(--sp-text-3)", marginTop: 4 }}>
                Paste your own API token in Settings. Credentials stay in your browser — Speqify has no account.
              </div>
              <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(["Jira", "GitHub", "Linear", "GitLab"] as const).map((k) => {
                  const L = Trackers[k];
                  return (
                    <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 999, border: "1px solid var(--sp-border)", background: "var(--sp-surface)", fontSize: 12.5, fontWeight: 600 }}>
                      <L size={16} /> {k}
                    </span>
                  );
                })}
              </div>
              <div style={{ marginTop: 18 }}>
                {dest ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--sp-surface)", border: "1px solid var(--sp-indigo-200)", borderRadius: 10, boxShadow: "0 0 0 3px var(--sp-indigo-50)" }}>
                    <Icons.Check size={16} style={{ color: "var(--sp-success)" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{dest.name} connected</div>
                      <div style={{ fontSize: 11.5, color: "var(--sp-text-3)" }}>{dest.sub}</div>
                    </div>
                  </div>
                ) : (
                  <button onClick={onOpenSettings} className="sp-btn sp-btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
                    <Icons.Layers size={14} /> Open Settings to connect
                  </button>
                )}
              </div>
            </div>
            <ProgressDots step={step} total={total} />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => setStep(0)} className="sp-btn sp-btn-ghost" style={{ flex: 1, justifyContent: "center" }}>Back</button>
              <button onClick={() => setStep(2)} className="sp-btn sp-btn-primary" style={{ flex: 2, justifyContent: "center" }}>
                Continue <Icons.Arrow size={13} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ padding: 28, display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--sp-indigo-700)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Step 2 of 3</div>
              <div style={{ fontSize: 20, fontWeight: 650, letterSpacing: "-0.01em", marginTop: 4 }}>Allow the microphone</div>
              <div style={{ fontSize: 13, color: "var(--sp-text-3)", marginTop: 4 }}>
                Needed to record voice notes. With local models, audio is transcribed on-device and never uploaded.
              </div>
              <div style={{ marginTop: 18, display: "flex", alignItems: "flex-start", gap: 14, padding: 16, background: "var(--sp-surface)", border: `1px solid ${micAllowed ? "var(--sp-indigo-200)" : "var(--sp-border)"}`, borderRadius: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: "var(--sp-indigo-50)", color: "var(--sp-indigo-700)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icons.Mic size={20} />
                </div>
                <div style={{ flex: 1, paddingTop: 2 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Microphone</div>
                  <div style={{ fontSize: 12, color: "var(--sp-text-3)", marginTop: 2, lineHeight: 1.45 }}>Speqify never listens in the background — only while you're recording.</div>
                </div>
                {micAllowed ? (
                  <span className="sp-chip sp-chip-success" style={{ flexShrink: 0 }}>
                    <Icons.Check size={10} stroke={2.4} /> Allowed
                  </span>
                ) : (
                  <button onClick={allowMic} className="sp-btn sp-btn-secondary sp-btn-sm" style={{ flexShrink: 0 }}>Allow</button>
                )}
              </div>
              <div style={{ marginTop: 14, padding: 12, background: "var(--sp-surface-2)", borderRadius: 8, fontSize: 11.5, color: "var(--sp-text-3)", display: "flex", gap: 8 }}>
                <Icons.Lock size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>Local-first · no account · your audio and keys never leave your browser.</div>
              </div>
            </div>
            <ProgressDots step={step} total={total} />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => setStep(1)} className="sp-btn sp-btn-ghost" style={{ flex: 1, justifyContent: "center" }}>Back</button>
              <button onClick={() => setStep(3)} className="sp-btn sp-btn-primary" style={{ flex: 2, justifyContent: "center" }}>
                Continue <Icons.Arrow size={13} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ padding: 28, display: "flex", flexDirection: "column", height: "100%", textAlign: "center" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: 999, background: "var(--sp-success-bg)", color: "var(--sp-success)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icons.Check size={32} stroke={2.4} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 650, letterSpacing: "-0.01em" }}>You're all set</div>
                <div style={{ fontSize: 13.5, color: "var(--sp-text-3)", marginTop: 4, maxWidth: 360 }}>
                  Open Speqify on any page, hit record, and ship your first ticket.
                </div>
              </div>
            </div>
            <ProgressDots step={step} total={total} />
            <button onClick={onFinish} className="sp-btn sp-btn-primary sp-btn-lg" style={{ width: "100%", justifyContent: "center", marginTop: 14 }}>
              Try your first capture <Icons.Crosshair size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
