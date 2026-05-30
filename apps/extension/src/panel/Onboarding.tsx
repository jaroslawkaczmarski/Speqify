import { useEffect, useState, type ReactNode } from "react";
import { Icons, SpeqifyLogo, SpeqifyWordmark, Trackers } from "@speqify/ui";
import { trackerDisplay, useSettings } from "@/store";

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 7, justifyContent: "center" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === step ? 24 : 6,
            height: 7,
            borderRadius: 1199,
            background: i === step ? "var(--sp-indigo-600)" : i < step ? "var(--sp-indigo-300)" : "var(--sp-border-2)",
            transition: "all .2s",
          }}
        />
      ))}
    </div>
  );
}

const FEATURES: { icon: ReactNode; label: string }[] = [
  { icon: <Icons.Mic size={17} />, label: "Voice notes" },
  { icon: <Icons.Image size={17} />, label: "Element capture" },
  { icon: <Icons.Sparkles size={17} />, label: "Auto-structure" },
  { icon: <Icons.Send size={17} />, label: "4 trackers" },
];

export function Onboarding({ onFinish, onOpenSettings }: { onFinish: () => void; onOpenSettings: (section?: string) => void }) {
  const [step, setStep] = useState(0);
  // Chrome never shows the mic permission prompt from the side panel, so we can't
  // grant it here — we only observe the current state and send the user to Settings
  // (a real extension tab, where the prompt works) to allow it. The onchange handler
  // flips this to "Allowed" the moment they grant it there, since both pages share
  // the same extension origin.
  const [micState, setMicState] = useState<string>("unknown");
  const tracker = useSettings((s) => s.tracker);
  const dest = trackerDisplay(tracker);
  const total = 4;
  const micGranted = micState === "granted";

  useEffect(() => {
    const perms = (navigator as Navigator & {
      permissions?: { query?: (d: { name: PermissionName }) => Promise<PermissionStatus> };
    }).permissions;
    perms
      ?.query?.({ name: "microphone" as PermissionName })
      .then((p) => {
        setMicState(p.state);
        p.onchange = () => setMicState(p.state);
      })
      .catch(() => setMicState("unknown"));
  }, []);

  return (
    <div className="sp" style={{ width: "100%", height: "100%", background: "var(--sp-bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "14px 17px", borderBottom: "1px solid var(--sp-border)", background: "var(--sp-surface)" }}>
        <SpeqifyWordmark height={22} />
        <div style={{ flex: 1 }} />
        <button onClick={onFinish} className="sp-btn sp-btn-ghost sp-btn-sm">Skip</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {step === 0 && (
          <div style={{ padding: 38, textAlign: "center", display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
              <SpeqifyLogo size={67} />
              <div>
                <div style={{ fontSize: 29, fontWeight: 650, letterSpacing: "-0.015em" }}>Welcome to Speqify</div>
                <div style={{ fontSize: 17, color: "var(--sp-text-3)", marginTop: 7, maxWidth: 408 }}>
                  Turn voice + screenshots into well-structured tickets in any tracker your team uses.
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%", maxWidth: 456, marginTop: 10 }}>
                {FEATURES.map((f) => (
                  <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--sp-surface-2)", border: "1px solid var(--sp-border)", borderRadius: 10, fontSize: 15, fontWeight: 500 }}>
                    <span style={{ color: "var(--sp-indigo-600)" }}>{f.icon}</span>
                    {f.label}
                  </div>
                ))}
              </div>
            </div>
            <ProgressDots step={step} total={total} />
            <button onClick={() => setStep(1)} className="sp-btn sp-btn-primary sp-btn-lg" style={{ marginTop: 17, width: "100%", justifyContent: "center" }}>
              Get started <Icons.Arrow size={17} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div style={{ padding: 34, display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sp-indigo-700)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Step 1 of 3</div>
              <div style={{ fontSize: 24, fontWeight: 650, letterSpacing: "-0.01em", marginTop: 5 }}>Connect your tracker</div>
              <div style={{ fontSize: 16, color: "var(--sp-text-3)", marginTop: 5 }}>
                Paste your own API token in Settings. Credentials stay in your browser — Speqify has no account.
              </div>
              <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 10 }}>
                {(["Jira", "GitHub", "Linear", "GitLab"] as const).map((k) => {
                  const L = Trackers[k];
                  return (
                    <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 1199, border: "1px solid var(--sp-border)", background: "var(--sp-surface)", fontSize: 15, fontWeight: 600 }}>
                      <L size={19} /> {k}
                    </span>
                  );
                })}
              </div>
              <div style={{ marginTop: 22 }}>
                {dest ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 17px", background: "var(--sp-surface)", border: "1px solid var(--sp-indigo-200)", borderRadius: 12, boxShadow: "0 0 0 3px var(--sp-indigo-50)" }}>
                    <Icons.Check size={19} style={{ color: "var(--sp-success)" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{dest.name} connected</div>
                      <div style={{ fontSize: 14, color: "var(--sp-text-3)" }}>{dest.sub}</div>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => onOpenSettings()} className="sp-btn sp-btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
                    <Icons.Layers size={17} /> Open Settings to connect
                  </button>
                )}
              </div>
            </div>
            <ProgressDots step={step} total={total} />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={() => setStep(0)} className="sp-btn sp-btn-ghost" style={{ flex: 1, justifyContent: "center" }}>Back</button>
              <button onClick={() => setStep(2)} className="sp-btn sp-btn-primary" style={{ flex: 2, justifyContent: "center" }}>
                Continue <Icons.Arrow size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ padding: 34, display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sp-indigo-700)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Step 2 of 3</div>
              <div style={{ fontSize: 24, fontWeight: 650, letterSpacing: "-0.01em", marginTop: 5 }}>Allow the microphone</div>
              <div style={{ fontSize: 16, color: "var(--sp-text-3)", marginTop: 5 }}>
                Needed to record voice notes. With local models, audio is transcribed on-device and never uploaded.
              </div>
              <div style={{ marginTop: 22, display: "flex", alignItems: "flex-start", gap: 17, padding: 19, background: "var(--sp-surface)", border: `1px solid ${micGranted ? "var(--sp-indigo-200)" : "var(--sp-border)"}`, borderRadius: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 11, background: "var(--sp-indigo-50)", color: "var(--sp-indigo-700)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icons.Mic size={24} />
                </div>
                <div style={{ flex: 1, paddingTop: 2 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>Microphone</div>
                  <div style={{ fontSize: 14, color: "var(--sp-text-3)", marginTop: 2, lineHeight: 1.45 }}>
                    {micGranted
                      ? "Allowed — Speqify only listens while you're recording."
                      : "Chrome can't show the mic prompt in the side panel — grant it once in Settings."}
                  </div>
                </div>
                {micGranted ? (
                  <span className="sp-chip sp-chip-success" style={{ flexShrink: 0 }}>
                    <Icons.Check size={12} stroke={2.4} /> Allowed
                  </span>
                ) : (
                  <button onClick={() => onOpenSettings("voice:mic")} className="sp-btn sp-btn-secondary sp-btn-sm" style={{ flexShrink: 0 }}>
                    <Icons.Layers size={15} /> Open Settings
                  </button>
                )}
              </div>
              <div style={{ marginTop: 17, padding: 14, background: "var(--sp-surface-2)", borderRadius: 10, fontSize: 14, color: "var(--sp-text-3)", display: "flex", gap: 10 }}>
                <Icons.Lock size={17} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>Local-first · no account · your audio and keys never leave your browser.</div>
              </div>
            </div>
            <ProgressDots step={step} total={total} />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={() => setStep(1)} className="sp-btn sp-btn-ghost" style={{ flex: 1, justifyContent: "center" }}>Back</button>
              <button onClick={() => setStep(3)} className="sp-btn sp-btn-primary" style={{ flex: 2, justifyContent: "center" }}>
                Continue <Icons.Arrow size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ padding: 34, display: "flex", flexDirection: "column", height: "100%", textAlign: "center" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 19 }}>
              <div style={{ width: 77, height: 77, borderRadius: 1199, background: "var(--sp-success-bg)", color: "var(--sp-success)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icons.Check size={38} stroke={2.4} />
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 650, letterSpacing: "-0.01em" }}>You're all set</div>
                <div style={{ fontSize: 16, color: "var(--sp-text-3)", marginTop: 5, maxWidth: 432 }}>
                  Open Speqify on any page, hit record, and ship your first ticket.
                </div>
              </div>
            </div>
            <ProgressDots step={step} total={total} />
            <button onClick={onFinish} className="sp-btn sp-btn-primary sp-btn-lg" style={{ width: "100%", justifyContent: "center", marginTop: 17 }}>
              Try your first capture <Icons.Crosshair size={17} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
